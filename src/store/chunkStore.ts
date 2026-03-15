import { Chunk } from "@/types/chunk";
import { create } from "zustand";
import { supabase } from "@/lib/supabaseClient";

// 단계별 다음 복습까지 일수
const STAGE_INTERVALS = [0, 1, 7, 30]; // stage 0→1: 1일, 1→2: 7일, 2→3: 30일

function daysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

interface ChunkStore {
  chunks: Chunk[];
  savedChunks: Chunk[];
  sourceText: string;
  sourceName: string;
  isLoadingSaved: boolean;
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
  loadSavedChunks: () => Promise<void>;
}

export const useChunkStore = create<ChunkStore>((set, get) => ({
  chunks: [],
  savedChunks: [],
  sourceText: "",
  sourceName: "",
  isLoadingSaved: false,

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

    const { data: { user } } = await supabase.auth.getUser();

    const rows = newChunks.map((c) => ({
      id: c.id,
      phrase: c.phrase,
      meaning: c.meaning,
      example_sentence: c.exampleSentence,
      reuse_example: c.reuseExample ?? null,
      source_text: c.sourceText ?? null,
      source_name: sourceName || null,
      created_at: c.createdAt,
      review_stage: 0,
      next_review_at: null,
      user_id: user?.id ?? null,
    }));

    const { error } = await supabase.from("vocabulary").insert(rows);
    if (error) throw error;

    const committed = newChunks.map((c) => ({
      ...c,
      sourceName: sourceName || undefined,
      reviewStage: 0,
      nextReviewAt: undefined,
    }));

    set((s) => ({
      savedChunks: [...s.savedChunks, ...committed],
      chunks: [],
      sourceText: "",
      sourceName: "",
    }));
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
      .update({ mastered: true, review_stage: 4, next_review_at: null })
      .eq("id", id);
    if (error) throw error;
    set((s) => ({
      savedChunks: s.savedChunks.map((c) =>
        c.id === id ? { ...c, mastered: true, reviewStage: 4 } : c
      ),
    }));
  },

  // 알았어요 — 다음 단계로 진급
  advanceChunk: async (id) => {
    const chunk = get().savedChunks.find((c) => c.id === id);
    if (!chunk) return;

    const currentStage = chunk.reviewStage ?? 0;
    const newStage = currentStage + 1;

    if (newStage >= 4) {
      // 4단계 완료 → 마스터
      await get().masterChunk(id);
      return;
    }

    const nextReviewAt = daysFromNow(STAGE_INTERVALS[newStage]);
    const { error } = await supabase
      .from("vocabulary")
      .update({ review_stage: newStage, next_review_at: nextReviewAt })
      .eq("id", id);
    if (error) throw error;

    set((s) => ({
      savedChunks: s.savedChunks.map((c) =>
        c.id === id ? { ...c, reviewStage: newStage, nextReviewAt } : c
      ),
    }));
  },

  // 몰랐어요
  // stage 0 (신규): 변경 없이 이번 세션에서 다시 보여주기
  // stage 1+: 1단계로 초기화, 내일 다시
  resetChunk: async (id) => {
    const chunk = get().savedChunks.find((c) => c.id === id);
    if (!chunk) return;

    if ((chunk.reviewStage ?? 0) === 0) return; // 신규 카드 → 세션 내 재등장

    const nextReviewAt = daysFromNow(1);
    const { error } = await supabase
      .from("vocabulary")
      .update({ review_stage: 1, next_review_at: nextReviewAt })
      .eq("id", id);
    if (error) throw error;

    set((s) => ({
      savedChunks: s.savedChunks.map((c) =>
        c.id === id ? { ...c, reviewStage: 1, nextReviewAt } : c
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
      createdAt: row.created_at,
    }));

    set({ savedChunks: chunks, isLoadingSaved: false });
  },
}));
