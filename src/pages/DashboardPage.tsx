import { useChunkStore } from "@/store/chunkStore";
import { useUsageStore, FREE_AI_LIMIT, FREE_VOCAB_LIMIT } from "@/store/usageStore";
import { useLevelStore, getSlimeForLevel, getXPForNextLevel, getCurrentLevelThreshold } from "@/store/levelStore";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Link } from "react-router-dom";
import { BookOpen, Library, Layers, Trophy, CheckCircle2, Circle, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { useMemo, useState, useEffect } from "react";
import ActivityHeatmap from "@/components/ActivityHeatmap";
import OnboardingWelcome, { ONBOARDING_KEY } from "@/components/OnboardingWelcome";

function isSameDay(d1: Date, d2: Date) {
  return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
}

function getStreak(chunks: { createdAt: string; status?: string; reviewStage?: number; lastReviewedAt?: string }[]) {
  const activityDates = new Set<string>();
  for (const c of chunks) {
    if (c.lastReviewedAt) {
      activityDates.add(new Date(c.lastReviewedAt).toDateString());
    }
  }

  const today = new Date();
  let streak = 0;
  const d = new Date(today);

  // Check today first
  if (activityDates.has(d.toDateString())) {
    streak = 1;
    d.setDate(d.getDate() - 1);
  } else {
    return 0;
  }

  while (activityDates.has(d.toDateString())) {
    streak++;
    d.setDate(d.getDate() - 1);
  }

  return streak;
}

const MOTIVATIONAL_COPIES = [
  "꾸준함이 쌓여 실력이 돼요.",
  "오늘 복습이 모여 언젠가 자신감이 될 거예요.",
  "작은 습관이 큰 변화를 만들어요.",
  "오늘도 영어가 한 발 성장했어요.",
  "매일의 선택이 모여 내일의 나를 만들어요.",
  "뇌는 반복할수록 더 잘 기억해요.",
  "오늘의 노력은 절대 사라지지 않아요.",
];

export default function DashboardPage() {
  const { savedChunks, isLoadingSaved } = useChunkStore();
  const { tier, usedThisMonth, isLoaded: usageLoaded } = useUsageStore();
  const { totalXP, level, isLoaded: levelLoaded, lastLevelUp, clearLevelUp, backfillXP } = useLevelStore();
  const dailySubcopy = MOTIVATIONAL_COPIES[new Date().getDate() % MOTIVATIONAL_COPIES.length];

  const [showOnboarding, setShowOnboarding] = useState(() => {
    return !localStorage.getItem(ONBOARDING_KEY);
  });

  // 기존 사용자 XP 백필
  useEffect(() => {
    if (levelLoaded && !isLoadingSaved && savedChunks.length > 0 && totalXP === 0) {
      backfillXP(savedChunks);
    }
  }, [levelLoaded, isLoadingSaved, savedChunks, totalXP, backfillXP]);


  const stats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const active = savedChunks.filter((c) => c.status === "active" || !c.status);
    const mastered = savedChunks.filter((c) => c.status === "mastered");

    const reviewedToday = savedChunks.filter((c) => {
      if (!c.lastReviewedAt) return false;
      const d = new Date(c.lastReviewedAt);
      d.setHours(0, 0, 0, 0);
      return d >= today;
    });

    const dueToday = active.filter((c) => {
      // 오늘 이미 복습한 카드 제외
      if (c.lastReviewedAt) {
        const d = new Date(c.lastReviewedAt);
        d.setHours(0, 0, 0, 0);
        if (d >= today) return false;
      }
      if (!c.nextReviewAt) return (c.reviewStage ?? 0) === 0;
      return new Date(c.nextReviewAt) <= new Date();
    });

    const addedToday = savedChunks.filter((c) => isSameDay(new Date(c.createdAt), new Date()));
    const streak = getStreak(savedChunks);
    const reviewDoneToday = reviewedToday.length > 0 && dueToday.length === 0;

    return {
      total: savedChunks.length,
      active: active.length,
      mastered: mastered.length,
      dueToday: dueToday.length,
      reviewedToday: reviewedToday.length,
      reviewDoneToday,
      addedToday: addedToday.length,
      streak,
      studiedToday: reviewedToday.length > 0,
      masteredPercent: savedChunks.length > 0 ? Math.round((mastered.length / savedChunks.length) * 100) : 0,
    };
  }, [savedChunks]);

  if (isLoadingSaved) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-muted-foreground">로딩 중...</p>
      </div>
    );
  }

  const weekDays = ["월", "화", "수", "목", "금", "토", "일"];
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0=Sun
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

  const weekActivity = weekDays.map((label, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + mondayOffset + i);
    const hasActivity = savedChunks.some((c) => c.lastReviewedAt && isSameDay(new Date(c.lastReviewedAt), d));
    const isToday = isSameDay(d, today);
    const isPast = d < today && !isToday;
    return { label, hasActivity, isToday, isPast };
  });

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      {/* Greeting */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-2xl font-semibold text-foreground">
          {stats.studiedToday ? "오늘도 학습 완료!" : "오늘 학습을 시작해볼까요?"}
        </h1>
        <p className="mt-1 text-muted-foreground">
          {stats.total === 0
            ? "아직 저장된 표현이 없어요. 텍스트에서 표현을 추출해보세요!"
            : dailySubcopy}
        </p>
      </motion.div>

      {/* Chunky Level & Today Status */}
      <div className="mb-6 grid grid-cols-2 gap-4">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="h-full">
          {(() => {
            const slimeImg = getSlimeForLevel(level);
            const currentThreshold = getCurrentLevelThreshold(level);
            const nextThreshold = getXPForNextLevel(level);
            const progressXP = totalXP - currentThreshold;
            const neededXP = nextThreshold - currentThreshold;
            const progressPercent = neededXP > 0 ? Math.min(100, Math.round((progressXP / neededXP) * 100)) : 100;
            const streakMsg = stats.streak === 0 ? ""
              : stats.streak < 7 ? `🔥 ${stats.streak}일 연속`
              : `🔥 ${stats.streak}일 연속!`;
            return (
              <Card className="border-none bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/30 h-full">
                <CardContent className="flex h-full flex-col justify-between p-4">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/30">
                      <img src={slimeImg} alt="청키" className="w-8 h-8" style={{ imageRendering: "pixelated" }}/>
                    </div>
                    <div className="min-w-0">
                      <p className="text-lg font-bold text-foreground leading-tight">Lv.{level}</p>
                      {streakMsg && <p className="text-xs text-muted-foreground whitespace-nowrap">{streakMsg}</p>}
                    </div>
                  </div>
                  <div>
                    <div className="h-1.5 w-full rounded-full bg-black/5 dark:bg-white/10 overflow-hidden">
                      <motion.div
                        className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500"
                        initial={{ width: 0 }}
                        animate={{ width: `${progressPercent}%` }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                      />
                    </div>
                    <p className="mt-1 text-[10px] text-muted-foreground">{totalXP} / {nextThreshold} XP</p>
                  </div>
                </CardContent>
              </Card>
            );
          })()}
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="h-full">
          <Link to="/review" className="block h-full">
            <Card className={`border-none h-full transition-opacity hover:opacity-80 ${stats.reviewDoneToday ? "bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30" : "bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30"}`}>
              <CardContent className="flex h-full flex-col justify-between p-4">
                <div className="flex items-center gap-2.5">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${stats.reviewDoneToday ? "bg-green-500/10 text-green-600" : "bg-primary/10 text-primary"}`}>
                    {stats.reviewDoneToday ? <CheckCircle2 className="h-5 w-5" /> : <BookOpen className="h-5 w-5" />}
                  </div>
                  <div className="min-w-0">
                    {stats.reviewDoneToday ? (
                      <p className="text-lg font-bold text-green-600 whitespace-nowrap">완료 ✓</p>
                    ) : (
                      <p className="text-lg font-bold text-foreground whitespace-nowrap">{stats.dueToday}개</p>
                    )}
                    <p className="text-xs text-muted-foreground whitespace-nowrap">
                      {stats.reviewDoneToday ? "오늘의 복습 끝!" : "오늘 복습할 표현"}
                    </p>
                  </div>
                </div>
                <p className="text-[10px] font-medium text-muted-foreground">
                  {stats.reviewDoneToday
                    ? `오늘 ${stats.reviewedToday}개 복습 완료`
                    : "탭해서 복습 시작 →"}
                </p>
              </CardContent>
            </Card>
          </Link>
        </motion.div>
      </div>

      {/* Weekly Activity */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
        <Card className="mb-6">
          <CardContent className="p-5">
            <p className="mb-4 text-sm font-medium text-foreground">이번 주 활동</p>
            <div className="flex items-center justify-between gap-2">
              {weekActivity.map(({ label, hasActivity, isToday, isPast }) => (
                <div key={label} className="flex flex-col items-center gap-2">
                  <span className={`text-xs ${isToday ? "font-bold text-primary" : "text-muted-foreground"}`}>
                    {label}
                  </span>
                  <div className={`flex h-9 w-9 items-center justify-center rounded-full ${
                    isToday && hasActivity
                      ? "bg-primary text-primary-foreground shadow-md"
                      : isToday && !hasActivity
                        ? "border-2 border-primary/40 text-primary/40"
                        : hasActivity
                          ? "bg-primary/15 text-primary"
                          : "bg-muted/40 text-muted-foreground/30"
                  }`}>
                    {hasActivity
                      ? <CheckCircle2 className={`h-5 w-5 ${isToday ? "text-primary-foreground" : ""}`} />
                      : <Circle className="h-5 w-5" />
                    }
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Activity Heatmap */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}>
        <Card className="mb-6">
          <CardContent className="p-5">
            <ActivityHeatmap chunks={savedChunks} />
          </CardContent>
        </Card>
      </motion.div>

      {/* Mastery Progress */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <Card className="mb-6">
          <CardContent className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trophy className="h-4 w-4 text-accent-foreground" />
                <span className="text-sm font-medium text-foreground">마스터 진행률</span>
              </div>
              <span className="text-sm font-semibold text-primary">{stats.masteredPercent}%</span>
            </div>
            <Progress value={stats.masteredPercent} className="h-2.5" />
            <div className="mt-2 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {stats.mastered} / {stats.total} 표현 마스터
              </p>
              {usageLoaded && tier === "free" && (
                <p className="text-xs text-muted-foreground">
                  단어장 {stats.active}/{FREE_VOCAB_LIMIT}개
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* AI Usage (free tier only) */}
      {usageLoaded && tier === "free" && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }}>
          <Card className="mb-6">
            <CardContent className="p-5">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-accent-foreground" />
                  <span className="text-sm font-medium text-foreground">이번 달 AI 사용량</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-primary">{usedThisMonth}/{FREE_AI_LIMIT}회</span>
                  <span className="text-xs text-muted-foreground">· 매월 1일 초기화</span>
                </div>
              </div>
              <Progress value={(usedThisMonth / FREE_AI_LIMIT) * 100} className="h-2.5" />
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Quick Actions */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
        <div className="grid grid-cols-3 gap-3">
          <Link
            to="/extract"
            className="flex flex-col items-center gap-2 rounded-xl border bg-card p-4 text-center transition-colors hover:bg-secondary"
          >
            <Layers className="h-5 w-5 text-primary" />
            <span className="text-sm font-medium text-foreground">표현 추출</span>
          </Link>
          <Link
            to="/review"
            className="flex flex-col items-center gap-2 rounded-xl border bg-card p-4 text-center transition-colors hover:bg-secondary"
          >
            <BookOpen className="h-5 w-5 text-primary" />
            <span className="text-sm font-medium text-foreground">복습하기</span>
          </Link>
          <Link
            to="/library"
            className="flex flex-col items-center gap-2 rounded-xl border bg-card p-4 text-center transition-colors hover:bg-secondary"
          >
            <Library className="h-5 w-5 text-primary" />
            <span className="text-sm font-medium text-foreground">라이브러리</span>
          </Link>
        </div>
      </motion.div>

      <OnboardingWelcome
        open={showOnboarding && !isLoadingSaved && savedChunks.length === 0}
        onClose={() => setShowOnboarding(false)}
      />
    </div>
  );
}
