import { Chunk } from "@/types/chunk";
import { create } from "zustand";
import { supabase } from "@/lib/supabaseClient";
import { useUsageStore, FREE_VOCAB_LIMIT } from "@/store/usageStore";
import { useLevelStore, XP_REWARDS } from "@/store/levelStore";

export class VocabLimitError extends Error {
  current: number;
  limit: number;
  constructor(current: number, limit: number) {
    super("vocab_limit");
    this.current = current;
    this.limit = limit;
  }
}

// 단계별 다음 복습까지 일수
const STAGE_INTERVALS = [0, 1, 7, 30]; // stage 0→1: 1일, 1→2: 7일, 2→3: 30일

function daysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

interface ChunkStore {
  chunks: Chunk[];
  savedChunks: Chunk[];
  sourceText: string;
  sourceName: string;
  isLoadingSaved: boolean;
  miniSessionCards: Chunk[];
  setSourceText: (text: string) => void;
  setSourceName: (name: string) => void;
  setChunks: (chunks: Chunk[]) => void;
  updateChunk: (id: string, updates: Partial<Chunk>) => void;
  removeChunk: (id: string) => void;
  addChunk: (chunk: Chunk) => void;
  commitChunks: () => Promise<void>;
  updateSavedChunk: (id: string, updates: Partial<Chunk>) => Promise<void>;
  removeSavedChunk: (id: string) => Promise<void>;
  masterChunk: (id: string) => Promise<void>;
  advanceChunk: (id: string) => Promise<void>;
  resetChunk: (id: string) => Promise<void>;
  excludeChunk: (id: string) => Promise<void>;
  restoreChunk: (id: string) => Promise<void>;
  loadSavedChunks: () => Promise<void>;
  setMiniSessionCards: (cards: Chunk[]) => void;
  clearMiniSession: () => void;
  scheduleTomorrow: (ids: string[]) => Promise<void>;
  updateExampleKo: (id: string, ko: string) => void;
}

export const useChunkStore = create<ChunkStore>((set, get) => ({
  chunks: [],
  savedChunks: [],
  sourceText: "",
  sourceName: "",
  isLoadingSaved: false,
  miniSessionCards: [],

  setSourceText: (text) => set({ sourceText: text }),
  setSourceName: (name) => set({ sourceName: name }),
  setChunks: (chunks) => set({ chunks }),

  updateChunk: (id, updates) =>
    set((s) => ({
      chunks: s.chunks.map((c) => (c.id === id ? { ...c, ...updates } : c)),
    })),

  removeChunk: (id) =>
    set((s) => ({ chunks: s.chunks.filter((c) => c.id !== id) })),

  addChunk: (chunk) => set((s) => ({ chunks: [...s.chunks, chunk] })),

  commitChunks: async () => {
    const { chunks, savedChunks, sourceName } = get();
    const newChunks = chunks.filter(
      (c) => !savedChunks.find((sc) => sc.id === c.id)
    );

    if (newChunks.length === 0) return;

    // Vocab limit check for free tier
    const { tier } = useUsageStore.getState();
    if (tier === "free") {
      const activeCount = savedChunks.filter((c) => c.status === "active").length;
      if (activeCount + newChunks.length > FREE_VOCAB_LIMIT) {
        throw new VocabLimitError(activeCount, FREE_VOCAB_LIMIT);
      }
    }

    const { data: { user } } = await supabase.auth.getUser();

    const rows = newChunks.map((c) => ({
      id: c.id,
      phrase: c.phrase,
      meaning: c.meaning,
      example_sentence: c.exampleSentence,
      example_ko: c.exampleKo ?? null,
      source_text: c.sourceText ?? null,
      source_name: sourceName || null,
      created_at: c.createdAt,
      review_stage: 0,
      next_review_at: null,
      status: "active",
      user_id: user?.id ?? null,
    }));

    const { error } = await supabase.from("vocabulary").insert(rows);
    if (error) throw error;

    const committed = newChunks.map((c) => ({
      ...c,
      sourceName: sourceName || undefined,
      reviewStage: 0,
      nextReviewAt: undefined,
      status: "active" as const,
    }));

    set((s) => ({
      savedChunks: [...s.savedChunks, ...committed],
      chunks: [],
      sourceText: "",
      sourceName: "",
    }));

    // XP 부여: 저장한 청크 수 × 5
    useLevelStore.getState().addXP(newChunks.length * XP_REWARDS.SAVE_CHUNK, "save");
  },

  updateSavedChunk: async (id, updates) => {
    const { error } = await supabase
      .from("vocabulary")
      .update({
        ...(updates.phrase !== undefined && { phrase: updates.phrase }),
        ...(updates.meaning !== undefined && { meaning: updates.meaning }),
        ...(updates.exampleSentence !== undefined && { example_sentence: updates.exampleSentence }),
      })
      .eq("id", id);
    if (error) throw error;
    set((s) => ({
      savedChunks: s.savedChunks.map((c) => (c.id === id ? { ...c, ...updates } : c)),
    }));
  },

  removeSavedChunk: async (id) => {
    const { error } = await supabase.from("vocabulary").delete().eq("id", id);
    if (error) throw error;
    set((s) => ({ savedChunks: s.savedChunks.filter((c) => c.id !== id) }));
  },

  masterChunk: async (id) => {
    const { error } = await supabase
      .from("vocabulary")
      .update({ mastered: true, review_stage: 4, next_review_at: null, status: "mastered" })
      .eq("id", id);
    if (error) throw error;
    set((s) => ({
      savedChunks: s.savedChunks.map((c) =>
        c.id === id ? { ...c, mastered: true, reviewStage: 4, status: "mastered" as const } : c
      ),
    }));

    // XP 부여: 마스터 달성
    useLevelStore.getState().addXP(XP_REWARDS.MASTER, "master");
  },

  // 알았어요 — 다음 단계로 진급
  advanceChunk: async (id) => {
    const chunk = get().savedChunks.find((c) => c.id === id);
    if (!chunk) return;

    const currentStage = chunk.reviewStage ?? 0;
    const newStage = currentStage + 1;

    if (newStage >= 4) {
      // 4단계 완료 → 마스터 (masterChunk 안에서 마스터 XP 부여)
      await get().masterChunk(id);
      // 복습 XP도 부여
      useLevelStore.getState().addXP(XP_REWARDS.REVIEW, "review");
      return;
    }

    const nextReviewAt = daysFromNow(STAGE_INTERVALS[newStage]);
    const lastReviewedAt = new Date().toISOString();
    const { error } = await supabase
      .from("vocabulary")
      .update({ review_stage: newStage, next_review_at: nextReviewAt, last_reviewed_at: lastReviewedAt, status: "active" })
      .eq("id", id);
    if (error) throw error;

    set((s) => ({
      savedChunks: s.savedChunks.map((c) =>
        c.id === id ? { ...c, reviewStage: newStage, nextReviewAt, lastReviewedAt, status: "active" as const } : c
      ),
    }));

    // XP 부여: 복습 완료
    useLevelStore.getState().addXP(XP_REWARDS.REVIEW, "review");
  },

  // 몰랐어요
  resetChunk: async (id) => {
    const chunk = get().savedChunks.find((c) => c.id === id);
    if (!chunk) return;

    if ((chunk.reviewStage ?? 0) === 0) {
      const lastReviewedAt = new Date().toISOString();
      await supabase.from("vocabulary").update({ last_reviewed_at: lastReviewedAt }).eq("id", id);
      set((s) => ({
        savedChunks: s.savedChunks.map((c) =>
          c.id === id ? { ...c, lastReviewedAt } : c
        ),
      }));
      useLevelStore.getState().addXP(XP_REWARDS.REVIEW, "review");
      return;
    }

    const nextReviewAt = daysFromNow(1);
    const lastReviewedAt = new Date().toISOString();
    const { error } = await supabase
      .from("vocabulary")
      .update({ review_stage: 1, next_review_at: nextReviewAt, last_reviewed_at: lastReviewedAt, status: "active" })
      .eq("id", id);
    if (error) throw error;

    set((s) => ({
      savedChunks: s.savedChunks.map((c) =>
        c.id === id ? { ...c, reviewStage: 1, nextReviewAt, lastReviewedAt, status: "active" as const } : c
      ),
    }));

    useLevelStore.getState().addXP(XP_REWARDS.REVIEW, "review");
  },

  // 이 단어 제외 (소프트 삭제)
  excludeChunk: async (id) => {
    const { error } = await supabase
      .from("vocabulary")
      .update({ status: "excluded", next_review_at: null })
      .eq("id", id);
    if (error) throw error;
    set((s) => ({
      savedChunks: s.savedChunks.map((c) =>
        c.id === id ? { ...c, status: "excluded" as const, nextReviewAt: undefined } : c
      ),
    }));
  },

  // 제외된 단어 복구
  restoreChunk: async (id) => {
    const { error } = await supabase
      .from("vocabulary")
      .update({ status: "active", review_stage: 0, next_review_at: null })
      .eq("id", id);
    if (error) throw error;
    set((s) => ({
      savedChunks: s.savedChunks.map((c) =>
        c.id === id ? { ...c, status: "active" as const, reviewStage: 0, nextReviewAt: undefined } : c
      ),
    }));
  },

  setMiniSessionCards: (cards) => set({ miniSessionCards: cards }),
  clearMiniSession: () => set({ miniSessionCards: [] }),

  updateExampleKo: (id, ko) =>
    set((s) => ({
      savedChunks: s.savedChunks.map((c) => (c.id === id ? { ...c, exampleKo: ko } : c)),
    })),

  scheduleTomorrow: async (ids) => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const nextReviewAt = tomorrow.toISOString();
    const { error } = await supabase
      .from("vocabulary")
      .update({ next_review_at: nextReviewAt })
      .in("id", ids);
    if (error) throw error;
    set((s) => ({
      savedChunks: s.savedChunks.map((c) =>
        ids.includes(c.id) ? { ...c, nextReviewAt } : c
      ),
    }));
  },

  loadSavedChunks: async () => {
    set({ isLoadingSaved: true });
    const { data, error } = await supabase
      .from("vocabulary")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      set({ isLoadingSaved: false });
      throw error;
    }

    const chunks: Chunk[] = (data ?? []).map((row) => ({
      id: row.id,
      phrase: row.phrase,
      meaning: row.meaning,
      exampleSentence: row.example_sentence,
      reuseExample: row.reuse_example ?? undefined,
      sourceText: row.source_text ?? undefined,
      sourceName: row.source_name ?? undefined,
      mastered: row.mastered ?? false,
      reviewStage: row.review_stage ?? 0,
      nextReviewAt: row.next_review_at ?? undefined,
      lastReviewedAt: row.last_reviewed_at ?? undefined,
      status: (row.status ?? "active") as "active" | "mastered" | "excluded",
      exampleKo: row.example_ko ?? undefined,
      lastWritingAt: row.last_writing_at ?? undefined,
      writingGraduated: row.writing_graduated ?? false,
      createdAt: row.created_at,
    }));

    set({ savedChunks: chunks, isLoadingSaved: false });
  },
}));
