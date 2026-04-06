import { create } from "zustand";
import { supabase } from "@/lib/supabaseClient";

// XP 보상 테이블
export const XP_REWARDS = {
  SAVE_CHUNK: 5,
  REVIEW: 10,
  MASTER: 50,
  WEEKLY_STREAK: 50,
} as const;

// 일일 복습 XP 상한
const DAILY_REVIEW_XP_CAP = 200;

// 레벨 임계값 (누적 XP)
const LEVEL_THRESHOLDS = [0, 50, 200, 500, 1200, 2500, 5000, 10000, 18000, 30000];

// 레벨에 따른 청키 슬라임 이미지
export function getSlimeForLevel(level: number): string {
  if (level <= 2) return "/slimes/basic.svg";
  if (level <= 4) return "/slimes/glasses.svg";
  if (level <= 6) return "/slimes/star.svg";
  if (level <= 8) return "/slimes/crown.svg";
  return "/slimes/unicorn.svg";
}

export function getLevelFromXP(xp: number): number {
  const maxThreshold = LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1];
  if (xp >= maxThreshold) {
    // Lv10 이후 무한 레벨: 매 20,000 XP마다 +1
    return LEVEL_THRESHOLDS.length + Math.floor((xp - maxThreshold) / 20000);
  }
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= LEVEL_THRESHOLDS[i]) return i + 1;
  }
  return 1;
}

export function getXPForNextLevel(level: number): number {
  if (level >= LEVEL_THRESHOLDS.length) {
    // Lv10 이후: 현재 레벨에서 다음 레벨까지 +20,000
    return LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1] + (level - LEVEL_THRESHOLDS.length + 1) * 20000;
  }
  return LEVEL_THRESHOLDS[level];
}

export function getCurrentLevelThreshold(level: number): number {
  if (level <= 1) return 0;
  if (level - 1 < LEVEL_THRESHOLDS.length) return LEVEL_THRESHOLDS[level - 1];
  return LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1] + (level - LEVEL_THRESHOLDS.length) * 20000;
}

interface DailyCap {
  date: string; // YYYY-MM-DD
  reviewXP: number;
}

function getTodayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function loadDailyCap(): DailyCap {
  try {
    const raw = localStorage.getItem("chunky_daily_xp");
    if (raw) {
      const parsed = JSON.parse(raw) as DailyCap;
      if (parsed.date === getTodayKey()) return parsed;
    }
  } catch { /* ignore */ }
  return { date: getTodayKey(), reviewXP: 0 };
}

function saveDailyCap(cap: DailyCap) {
  localStorage.setItem("chunky_daily_xp", JSON.stringify(cap));
}

interface LevelStore {
  totalXP: number;
  level: number;
  isLoaded: boolean;
  lastLevelUp: number | null; // 레벨업 시 새 레벨 번호
  loadXP: () => Promise<void>;
  addXP: (amount: number, type: "save" | "review" | "master" | "streak") => Promise<number>;
  backfillXP: (chunks: { status?: string; reviewStage?: number }[]) => Promise<void>;
  clearLevelUp: () => void;
}

export const useLevelStore = create<LevelStore>((set, get) => ({
  totalXP: 0,
  level: 1,
  isLoaded: false,
  lastLevelUp: null,

  loadXP: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("total_xp")
      .eq("id", user.id)
      .single();

    const xp = profile?.total_xp ?? 0;
    set({
      totalXP: xp,
      level: getLevelFromXP(xp),
      isLoaded: true,
    });
  },

  addXP: async (amount, type) => {
    // 복습인 경우 일일 상한 체크
    if (type === "review") {
      const cap = loadDailyCap();
      const remaining = DAILY_REVIEW_XP_CAP - cap.reviewXP;
      if (remaining <= 0) return 0;
      amount = Math.min(amount, remaining);
      cap.reviewXP += amount;
      saveDailyCap(cap);
    }

    if (amount <= 0) return 0;

    const prevLevel = get().level;
    const newXP = get().totalXP + amount;
    const newLevel = getLevelFromXP(newXP);

    set({
      totalXP: newXP,
      level: newLevel,
      lastLevelUp: newLevel > prevLevel ? newLevel : null,
    });

    // Supabase 업데이트 (fire-and-forget)
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      supabase
        .from("profiles")
        .update({ total_xp: newXP })
        .eq("id", user.id)
        .then();
    }

    return amount;
  },

  backfillXP: async (chunks) => {
    if (get().totalXP > 0) return; // 이미 XP가 있으면 스킵

    let xp = 0;
    for (const c of chunks) {
      xp += XP_REWARDS.SAVE_CHUNK; // 저장 보상
      const stage = c.reviewStage ?? 0;
      xp += stage * XP_REWARDS.REVIEW; // 복습 단계별 보상
      if (c.status === "mastered") {
        xp += XP_REWARDS.MASTER;
      }
    }

    if (xp === 0) return;

    const newLevel = getLevelFromXP(xp);
    set({ totalXP: xp, level: newLevel });

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from("profiles")
        .update({ total_xp: xp })
        .eq("id", user.id);
    }
  },

  clearLevelUp: () => set({ lastLevelUp: null }),
}));
