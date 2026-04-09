import { useChunkStore } from "@/store/chunkStore";
import { useWritingStore, WRITING_DAILY_LIMIT } from "@/store/writingStore";
import { useUsageStore } from "@/store/usageStore";
import { useLevelStore, getSlimeForLevel, getXPForNextLevel, getCurrentLevelThreshold } from "@/store/levelStore";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Link } from "react-router-dom";
import { BookOpen, CheckCircle2, PenLine, Trophy } from "lucide-react";
import { motion } from "framer-motion";
import { useMemo, useState, useEffect } from "react";
import ActivityHeatmap from "@/components/ActivityHeatmap";
import OnboardingWelcome, { ONBOARDING_KEY } from "@/components/OnboardingWelcome";

const MOTIVATIONAL_COPIES = [
  "꾸준함이 쌓여 실력이 돼요.",
  "오늘 복습이 모여 언젠가 자신감이 될 거예요.",
  "작은 습관이 큰 변화를 만들어요.",
  "오늘도 영어가 한 발 성장했어요.",
  "매일의 선택이 모여 내일의 나를 만들어요.",
  "뇌는 반복할수록 더 잘 기억해요.",
  "오늘의 노력은 절대 사라지지 않아요.",
];

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

export default function DashboardPage() {
  const { savedChunks, isLoadingSaved } = useChunkStore();
  const { tier, isLoaded: usageLoaded } = useUsageStore();
  const { totalXP, level, isLoaded: levelLoaded, backfillXP } = useLevelStore();
  const { todayCount, getPracticeableChunks, loadTodayPractice } = useWritingStore();

  const [showOnboarding, setShowOnboarding] = useState(() => {
    return !localStorage.getItem(ONBOARDING_KEY);
  });

  useEffect(() => {
    if (levelLoaded && !isLoadingSaved && savedChunks.length > 0 && totalXP === 0) {
      backfillXP(savedChunks);
    }
  }, [levelLoaded, isLoadingSaved, savedChunks, totalXP, backfillXP]);

  useEffect(() => {
    if (!isLoadingSaved) loadTodayPractice();
  }, [isLoadingSaved, loadTodayPractice]);

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
      if (c.lastReviewedAt) {
        const d = new Date(c.lastReviewedAt);
        d.setHours(0, 0, 0, 0);
        if (d >= today) return false;
      }
      if (!c.nextReviewAt) return (c.reviewStage ?? 0) === 0;
      return new Date(c.nextReviewAt) <= new Date();
    });

    const streak = getStreak(savedChunks);
    const reviewDoneToday = reviewedToday.length > 0 && dueToday.length === 0;
    const writingAvailable = getPracticeableChunks(savedChunks).length;
    const writingDoneToday = todayCount >= WRITING_DAILY_LIMIT;

    return {
      total: savedChunks.length,
      active: active.length,
      mastered: mastered.length,
      dueToday: dueToday.length,
      reviewedToday: reviewedToday.length,
      reviewDoneToday,
      streak,
      studiedToday: reviewedToday.length > 0 || todayCount > 0,
      masteredPercent: savedChunks.length > 0 ? Math.round((mastered.length / savedChunks.length) * 100) : 0,
      writingAvailable,
      writingDoneToday,
    };
  }, [savedChunks, todayCount, getPracticeableChunks]);

  if (isLoadingSaved) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-muted-foreground">로딩 중...</p>
      </div>
    );
  }

  const weekDays = ["월", "화", "수", "목", "금", "토", "일"];
  const today = new Date();
  const dayOfWeek = today.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

  const weekActivity = weekDays.map((label, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + mondayOffset + i);
    const hasActivity = savedChunks.some((c) => c.lastReviewedAt && isSameDay(new Date(c.lastReviewedAt), d));
    const isToday = isSameDay(d, today);
    return { label, hasActivity, isToday };
  });

  const slimeImg = getSlimeForLevel(level);
  const currentThreshold = getCurrentLevelThreshold(level);
  const nextThreshold = getXPForNextLevel(level);
  const progressXP = totalXP - currentThreshold;
  const neededXP = nextThreshold - currentThreshold;
  const progressPercent = neededXP > 0 ? Math.min(100, Math.round((progressXP / neededXP) * 100)) : 100;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">

      {/* ── 1. 인사 + 스트릭 ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6 flex items-center justify-between"
      >
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            {stats.studiedToday ? "오늘도 학습 완료!" : "오늘 학습을 시작해볼까요?"}
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {stats.total === 0
              ? "텍스트에서 표현을 추출해보세요!"
              : MOTIVATIONAL_COPIES[new Date().getDate() % MOTIVATIONAL_COPIES.length]}
          </p>
        </div>
        {stats.streak > 0 && (
          <span className="shrink-0 rounded-full bg-orange-100 px-3 py-1 text-sm font-medium text-orange-700 dark:bg-orange-950/40 dark:text-orange-400">
            🔥 {stats.streak}일 연속
          </span>
        )}
      </motion.div>

      {/* ── 2. 복습 히어로 카드 (전체 폭) ── */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="mb-4">
        {stats.reviewDoneToday ? (
          /* 복습 완료 상태 → 쓰기 연습 유도 */
          <Card className="border-none bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30">
            <CardContent className="p-5">
              <div className="flex items-center gap-4">
                <img src="/chunky/great.png" alt="Chunky" className="h-14 w-14 shrink-0 object-contain" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <p className="font-semibold text-green-700 dark:text-green-400">오늘 복습 완료!</p>
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {stats.reviewedToday}개 복습했어요.
                    {!stats.writingDoneToday && " 복습한 표현으로 문장을 만들어볼까요?"}
                  </p>
                  {!stats.writingDoneToday && stats.writingAvailable > 0 && (
                    <Link
                      to="/write"
                      className="mt-3 inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 transition-colors"
                    >
                      <PenLine className="h-3.5 w-3.5" />
                      쓰기 연습 하러 가기
                    </Link>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ) : stats.dueToday > 0 ? (
          /* 복습 대기 상태 */
          <Link to="/review" className="block">
            <Card className="border-none bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 transition-opacity hover:opacity-90">
              <CardContent className="p-5">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <p className="text-xs font-semibold uppercase tracking-widest text-primary/60">오늘의 복습</p>
                    <p className="mt-1 text-3xl font-bold text-foreground">{stats.dueToday}개</p>
                    <p className="mt-1 text-sm text-muted-foreground">잊어버리기 전에 복습하세요</p>
                  </div>
                  <div className="shrink-0 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm">
                    복습 시작 →
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ) : stats.total === 0 ? (
          /* 표현 없는 상태 */
          <Card className="border-none bg-gradient-to-br from-muted/60 to-muted/30">
            <CardContent className="p-5 text-center">
              <img src="/chunky/lv1.png" alt="Chunky" className="mx-auto mb-3 h-14 w-14 object-contain" />
              <p className="font-semibold text-foreground">아직 저장된 표현이 없어요</p>
              <p className="mt-1 text-sm text-muted-foreground">영어 텍스트를 붙여넣고 표현을 추출해보세요!</p>
            </CardContent>
          </Card>
        ) : (
          /* 복습 대기 없음 (아직 복습 안 한 날) */
          <Card className="border-none bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30">
            <CardContent className="p-5 text-center">
              <BookOpen className="mx-auto mb-2 h-8 w-8 text-primary/50" />
              <p className="font-semibold text-foreground">오늘 복습할 표현이 없어요</p>
              <p className="mt-1 text-sm text-muted-foreground">새 표현을 추출하거나, 쓰기 연습을 해볼까요?</p>
            </CardContent>
          </Card>
        )}
      </motion.div>

      {/* ── 3. 쓰기 연습 + 레벨 카드 (2-column) ── */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mb-4 grid grid-cols-2 gap-3">
        {/* 쓰기 연습 */}
        <Link to="/write" className="block">
          <Card className={`h-full border-none transition-opacity hover:opacity-80 ${stats.writingDoneToday ? "bg-gradient-to-br from-purple-50 to-fuchsia-50 dark:from-purple-950/30 dark:to-fuchsia-950/30" : "bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30"}`}>
            <CardContent className="p-4 flex flex-col justify-between h-full">
              <div className="flex items-center gap-2.5">
                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${stats.writingDoneToday ? "bg-purple-500/10" : "bg-violet-500/10"}`}>
                  <PenLine className={`h-6 w-6 ${stats.writingDoneToday ? "text-purple-600" : "text-violet-600"}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-muted-foreground">쓰기 연습</p>
                  {stats.writingDoneToday ? (
                    <p className="text-lg font-bold text-purple-600">완료 ✓</p>
                  ) : (
                    <p className="text-lg font-bold text-foreground">
                      {stats.writingAvailable > 0 ? `${Math.min(stats.writingAvailable, WRITING_DAILY_LIMIT - todayCount)}개` : "없음"}
                    </p>
                  )}
                </div>
              </div>
              <p className="mt-3 text-[10px] text-muted-foreground">
                {stats.writingDoneToday ? `오늘 ${todayCount}개 완료` : stats.writingAvailable > 0 ? "탭해서 시작 →" : "표현을 먼저 추출해요"}
              </p>
            </CardContent>
          </Card>
        </Link>

        {/* 내 레벨 + 캐릭터 */}
        <Card className="border-none bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-2.5">
              <img src={slimeImg} alt="청키" className="h-12 w-12 shrink-0 object-contain" />
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground">내 레벨</p>
                <p className="text-lg font-bold text-foreground">Lv.{level}</p>
              </div>
            </div>
            <div className="mt-3">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
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
      </motion.div>

      {/* ── 4. 주간 활동 + 숙달 진행률 (통합 섹션) ── */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
        <Card className="mb-6">
          <CardContent className="p-5">
            {/* 주간 활동 */}
            <p className="mb-4 text-sm font-medium text-foreground">이번 주 활동</p>
            <div className="flex items-center justify-between gap-1">
              {weekActivity.map(({ label, hasActivity, isToday }) => (
                <div key={label} className="flex flex-col items-center gap-1.5">
                  <span className={`text-xs ${isToday ? "font-bold text-primary" : "text-muted-foreground"}`}>
                    {label}
                  </span>
                  <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all ${
                    isToday && hasActivity
                      ? "bg-primary text-primary-foreground shadow-md ring-2 ring-primary/30"
                      : isToday
                        ? "border-2 border-primary text-primary"
                        : hasActivity
                          ? "bg-primary/15 text-primary"
                          : "bg-muted/40 text-muted-foreground/30"
                  }`}>
                    {hasActivity ? "✓" : "·"}
                  </div>
                </div>
              ))}
            </div>

            {/* 학습 히트맵 */}
            <div className="mt-5 border-t pt-4">
              <ActivityHeatmap chunks={savedChunks} />
            </div>

            {/* 숙달 진행률 */}
            {stats.total > 0 && (
              <div className="mt-5 border-t pt-4">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Trophy className="h-3.5 w-3.5 text-amber-500" />
                    <span className="text-xs font-medium text-foreground">숙달 진행률</span>
                  </div>
                  <span className="text-xs font-semibold text-primary">{stats.mastered}/{stats.total}개</span>
                </div>
                <Progress value={stats.masteredPercent} className="h-1.5" />
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      <OnboardingWelcome
        open={showOnboarding && !isLoadingSaved && savedChunks.length === 0}
        onClose={() => setShowOnboarding(false)}
      />
    </div>
  );
}
