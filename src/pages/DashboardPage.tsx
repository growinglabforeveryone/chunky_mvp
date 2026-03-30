import { useChunkStore } from "@/store/chunkStore";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Link } from "react-router-dom";
import { BookOpen, Flame, Library, Layers, Trophy, CheckCircle2, Circle } from "lucide-react";
import { motion } from "framer-motion";
import { useMemo } from "react";
import ActivityHeatmap from "@/components/ActivityHeatmap";

function isSameDay(d1: Date, d2: Date) {
  return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
}

function getStreak(chunks: { createdAt: string; status?: string; reviewStage?: number; nextReviewAt?: string }[]) {
  // Build a set of dates where user did activity (created or reviewed = stage advanced)
  const activityDates = new Set<string>();
  for (const c of chunks) {
    activityDates.add(new Date(c.createdAt).toDateString());
    // If review stage > 0, they reviewed it — approximate review dates from nextReviewAt
    if (c.nextReviewAt) {
      const reviewDate = new Date(c.nextReviewAt);
      // The review happened STAGE_INTERVALS days before nextReviewAt
      activityDates.add(reviewDate.toDateString());
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

export default function DashboardPage() {
  const { savedChunks, isLoadingSaved } = useChunkStore();

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
      studiedToday: reviewedToday.length > 0 || addedToday.length > 0,
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
          {stats.studiedToday ? "오늘도 학습 완료! 🎉" : "오늘 학습을 시작해볼까요?"}
        </h1>
        <p className="mt-1 text-muted-foreground">
          {stats.total === 0
            ? "아직 저장된 표현이 없어요. 텍스트에서 표현을 추출해보세요!"
            : `총 ${stats.total}개의 표현 중 ${stats.mastered}개를 마스터했어요.`}
        </p>
      </motion.div>

      {/* Streak & Today Status */}
      <div className="mb-6 grid grid-cols-2 gap-4">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <Card className="border-none bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/30">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                <Flame className="h-6 w-6" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.streak}일</p>
                <p className="text-sm text-muted-foreground">연속 학습</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className={`border-none ${stats.reviewDoneToday ? "bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30" : "bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30"}`}>
            <CardContent className="flex items-center gap-4 p-5">
              <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${stats.reviewDoneToday ? "bg-green-500/10 text-green-600" : "bg-primary/10 text-primary"}`}>
                {stats.reviewDoneToday ? <CheckCircle2 className="h-6 w-6" /> : <BookOpen className="h-6 w-6" />}
              </div>
              <div>
                {stats.reviewDoneToday ? (
                  <>
                    <p className="text-2xl font-bold text-green-600">완료 ✓</p>
                    <p className="text-sm text-muted-foreground">오늘 {stats.reviewedToday}개 복습 완료</p>
                  </>
                ) : (
                  <>
                    <p className="text-2xl font-bold text-foreground">{stats.dueToday}개</p>
                    <p className="text-sm text-muted-foreground">오늘 복습할 표현</p>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
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
            <p className="mt-2 text-xs text-muted-foreground">
              {stats.mastered} / {stats.total} 표현 마스터
            </p>
          </CardContent>
        </Card>
      </motion.div>

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
    </div>
  );
}
