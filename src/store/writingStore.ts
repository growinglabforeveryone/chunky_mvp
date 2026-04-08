import { create } from "zustand";
import { supabase } from "@/lib/supabaseClient";
import { Chunk } from "@/types/chunk";
import { WritingPracticeResult } from "@/types/writing";
import { useChunkStore } from "@/store/chunkStore";
import { useLevelStore, XP_REWARDS } from "@/store/levelStore";

export const WRITING_DAILY_LIMIT = 5;
const COOLDOWN_DAYS = 7;

function getTodayStart(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

interface WritingStore {
  todayCount: number;
  todayPracticedIds: Set<string>;
  isLoading: boolean;
  loadTodayPractice: () => Promise<void>;
  getPracticeableChunks: (allChunks: Chunk[]) => Chunk[];
  getKoreanTranslation: (chunk: Chunk) => Promise<string>;
  submitPractice: (params: {
    chunk: Chunk;
    userAnswer: string;
    exampleKo: string;
  }) => Promise<WritingPracticeResult>;
  graduateVocab: (vocabularyId: string) => Promise<void>;
  resetGraduation: (vocabularyId: string) => Promise<void>;
}

export const useWritingStore = create<WritingStore>((set, get) => ({
  todayCount: 0,
  todayPracticedIds: new Set(),
  isLoading: false,

  loadTodayPractice: async () => {
    set({ isLoading: true });
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const todayStart = getTodayStart();
      const { data, error } = await supabase
        .from("writing_practice")
        .select("vocabulary_id")
        .eq("user_id", user.id)
        .gte("created_at", todayStart);

      if (error) throw error;

      const rows = data ?? [];
      const ids = new Set(rows.map((r) => r.vocabulary_id as string));
      set({ todayCount: rows.length, todayPracticedIds: ids });
    } finally {
      set({ isLoading: false });
    }
  },

  getPracticeableChunks: (allChunks) => {
    const state = get();
    const todayPracticedIds = state.todayPracticedIds;
    const todayCount = state.todayCount;
    if (todayCount >= WRITING_DAILY_LIMIT) return [];

    const now = new Date();
    const cooldownDate = new Date(now);
    cooldownDate.setDate(cooldownDate.getDate() - COOLDOWN_DAYS);

    return allChunks.filter((c) => {
      if (c.status !== "active") return false;
      if ((c.reviewStage ?? 0) < 1) return false;
      if (c.writingGraduated) return false;
      if (todayPracticedIds.has(c.id)) return false;
      if (c.lastWritingAt && new Date(c.lastWritingAt) > cooldownDate) return false;
      return true;
    });
  },

  getKoreanTranslation: async (chunk) => {
    // Return cached translation if available
    if (chunk.exampleKo) return chunk.exampleKo;

    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) throw new Error("unauthorized");

    const res = await fetch("/api/translate-example", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        vocabularyId: chunk.id,
        sentence: chunk.exampleSentence,
        phrase: chunk.phrase,
        meaning: chunk.meaning,
      }),
    });

    if (!res.ok) throw new Error("번역 생성 실패");
    const data = await res.json();
    const korean = data.korean as string;

    // Update local store cache
    useChunkStore.getState().updateExampleKo(chunk.id, korean);
    return korean;
  },

  submitPractice: async ({ chunk, userAnswer, exampleKo }) => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) throw new Error("unauthorized");

    // Evaluate via API
    const res = await fetch("/api/evaluate-writing", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        userAnswer,
        referenceSentence: chunk.exampleSentence,
        phrase: chunk.phrase,
        meaning: chunk.meaning,
      }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      if (errData.error === "monthly_limit") {
        throw Object.assign(new Error("monthly_limit"), { used: errData.used, limit: errData.limit });
      }
      throw new Error("평가 실패");
    }

    const result: WritingPracticeResult = await res.json();

    // Save to writing_practice table
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("unauthorized");

    await supabase.from("writing_practice").insert({
      user_id: user.id,
      vocabulary_id: chunk.id,
      user_answer: userAnswer,
      reference_sentence: chunk.exampleSentence,
      score: 3, // neutral placeholder (NOT NULL constraint)
      feedback: {
        feedback: result.feedback,
        naturalVersion: result.naturalVersion,
        literalVersion: result.literalVersion,
      },
    });

    // Update vocabulary: last_writing_at only (graduation is now manual)
    const lastWritingAt = new Date().toISOString();
    await supabase.from("vocabulary").update({ last_writing_at: lastWritingAt }).eq("id", chunk.id);

    // Update local chunk store
    useChunkStore.setState((s) => ({
      savedChunks: s.savedChunks.map((c) =>
        c.id === chunk.id
          ? { ...c, lastWritingAt }
          : c
      ),
    }));

    // Update today's count
    set((s) => ({
      todayCount: s.todayCount + 1,
      todayPracticedIds: new Set([...s.todayPracticedIds, chunk.id]),
    }));

    // XP reward
    await useLevelStore.getState().addXP(XP_REWARDS.WRITING_PRACTICE, "writing");

    return result;
  },

  graduateVocab: async (vocabularyId) => {
    await supabase
      .from("vocabulary")
      .update({ writing_graduated: true })
      .eq("id", vocabularyId);

    useChunkStore.setState((s) => ({
      savedChunks: s.savedChunks.map((c) =>
        c.id === vocabularyId ? { ...c, writingGraduated: true } : c
      ),
    }));
  },

  resetGraduation: async (vocabularyId) => {
    await supabase
      .from("vocabulary")
      .update({ writing_graduated: false })
      .eq("id", vocabularyId);

    useChunkStore.setState((s) => ({
      savedChunks: s.savedChunks.map((c) =>
        c.id === vocabularyId ? { ...c, writingGraduated: false } : c
      ),
    }));
  },
}));
