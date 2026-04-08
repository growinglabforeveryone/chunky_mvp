import { useState, useEffect, useMemo } from "react";
import { useChunkStore } from "@/store/chunkStore";
import { useWritingStore } from "@/store/writingStore";
import { useLevelStore } from "@/store/levelStore";
import { Chunk } from "@/types/chunk";
import { WritingPracticeResult } from "@/types/writing";
import { motion, AnimatePresence } from "framer-motion";
import { PenLine, RotateCcw, ChevronRight, Loader2, AlertCircle, Check } from "lucide-react";
import { XP_REWARDS } from "@/store/levelStore";
import { WRITING_DAILY_LIMIT } from "@/store/writingStore";
import { toast } from "sonner";

type Phase = "start" | "practice" | "feedback" | "complete";

export default function WritePracticePage() {
  const { savedChunks } = useChunkStore();
  const {
    todayCount,
    todayPracticedIds,
    isLoading,
    loadTodayPractice,
    getPracticeableChunks,
    getKoreanTranslation,
    submitPractice,
    graduateVocab,
  } = useWritingStore();
  const { totalXP, level, isLoaded: xpLoaded } = useLevelStore();

  const [phase, setPhase] = useState<Phase>("start");
  const [queue, setQueue] = useState<Chunk[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [exampleKo, setExampleKo] = useState("");
  const [loadingKo, setLoadingKo] = useState(false);
  const [userAnswer, setUserAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<WritingPracticeResult | null>(null);
  const [sessionCount, setSessionCount] = useState(0);
  // XP 로드 완료 후 세션 시작 XP 캡처
  const [xpStart, setXpStart] = useState<number | null>(null);
  useEffect(() => {
    if (xpLoaded && xpStart === null) setXpStart(totalXP);
  }, [xpLoaded, totalXP, xpStart]);

  useEffect(() => {
    loadTodayPractice();
  }, [loadTodayPractice]);

  const practiceableChunks = useMemo(
    () => getPracticeableChunks(savedChunks),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [savedChunks, todayCount, todayPracticedIds]
  );

  const remainingToday = WRITING_DAILY_LIMIT - todayCount;
  const availableCount = Math.min(practiceableChunks.length, remainingToday);
  const current = queue[currentIndex];

  const handleStart = async () => {
    if (availableCount === 0) return;
    const selected = [...practiceableChunks].slice(0, availableCount);
    setQueue(selected);
    setCurrentIndex(0);
    setSessionCount(0);
    setPhase("practice");
    await loadKoreanFor(selected[0]);
  };

  const loadKoreanFor = async (chunk: Chunk) => {
    setLoadingKo(true);
    setExampleKo("");
    setUserAnswer("");
    setResult(null);
    try {
      const ko = await getKoreanTranslation(chunk);
      setExampleKo(ko);
    } catch {
      toast.error("한글 번역을 불러오지 못했어요.");
    } finally {
      setLoadingKo(false);
    }
  };

  const handleSubmit = async () => {
    if (!current || !userAnswer.trim() || submitting) return;
    setSubmitting(true);
    try {
      const res = await submitPractice({ chunk: current, userAnswer: userAnswer.trim(), exampleKo });
      setResult(res);
      setSessionCount((prev) => prev + 1);
      setPhase("feedback");
    } catch (err: unknown) {
      if (err instanceof Error && err.message === "monthly_limit") {
        toast.error("이번 달 쓰기 연습 한도(30회)에 도달했어요.");
      } else {
        toast.error("평가 중 오류가 발생했어요. 다시 시도해주세요.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleNext = async () => {
    const nextIndex = currentIndex + 1;
    if (nextIndex >= queue.length) {
      setPhase("complete");
      return;
    }
    setCurrentIndex(nextIndex);
    setPhase("practice");
    await loadKoreanFor(queue[nextIndex]);
  };

  const handleGraduateAndNext = async () => {
    if (!current) return;
    try {
      await graduateVocab(current.id);
    } catch {
      toast.error("졸업 처리 중 오류가 발생했어요.");
    }
    await handleNext();
  };

  const handleRestart = () => {
    setPhase("start");
    setQueue([]);
    setCurrentIndex(0);
    setResult(null);
    setSessionCount(0);
    setUserAnswer("");
    setExampleKo("");
    loadTodayPractice();
  };

  // ── Complete screen ──────────────────────────────────────────
  if (phase === "complete") {
    const earnedXP = xpStart !== null ? totalXP - xpStart : 0;

    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="text-center space-y-5 max-w-sm w-full">
          <p className="font-serif text-2xl font-semibold text-foreground">연습 완료 ✓</p>
          <div className="rounded-xl border bg-card px-8 py-5 space-y-2 text-sm">
            <p className="text-muted-foreground">{sessionCount}개 표현 연습 완료</p>
            {earnedXP > 0 && (
              <p className="text-primary font-semibold">+{earnedXP} XP (Lv.{level})</p>
            )}
          </div>
          <button
            onClick={handleRestart}
            className="flex items-center gap-1.5 mx-auto rounded-xl px-5 py-2 text-sm text-muted-foreground hover:bg-secondary transition-colors"
          >
            <RotateCcw className="h-4 w-4" />
            처음으로
          </button>
        </div>
      </div>
    );
  }

  // ── Start screen ─────────────────────────────────────────────
  if (phase === "start") {
    const doneToday = todayCount >= WRITING_DAILY_LIMIT;

    return (
      <div className="mx-auto max-w-xl px-6 py-10">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <div>
            <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
              <PenLine className="h-6 w-6 text-primary" />
              예문 번역 연습
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              한글 문장을 보고 영어로 써보세요. 목표 표현을 정확하게 써야 해요.
            </p>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="rounded-xl border bg-card p-6 space-y-4">
              {doneToday ? (
                <>
                  <div className="flex items-center gap-2 text-green-600">
                    <span className="text-2xl font-bold">완료 ✓</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    오늘 {todayCount}개 연습을 모두 완료했어요. 내일 다시 도전해보세요!
                  </p>
                </>
              ) : availableCount === 0 ? (
                <>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <AlertCircle className="h-5 w-5" />
                    <span className="font-medium">연습 가능한 표현이 없어요</span>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    복습(SRS)을 1회 이상 완료한 표현부터 연습할 수 있어요.
                    표현을 더 추가하거나 복습을 먼저 해보세요.
                  </p>
                </>
              ) : (
                <>
                  <div>
                    <p className="text-3xl font-bold text-foreground">{availableCount}개</p>
                    <p className="text-sm text-muted-foreground mt-0.5">오늘 연습 가능한 표현</p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    오늘 {todayCount}/{WRITING_DAILY_LIMIT}개 완료 · 7일 쿨다운 적용
                  </p>
                  <button
                    onClick={handleStart}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    <PenLine className="h-4 w-4" />
                    연습 시작
                  </button>
                </>
              )}
            </div>
          )}
        </motion.div>
      </div>
    );
  }

  // ── Feedback screen ──────────────────────────────────────────
  if (phase === "feedback" && result) {
    const showLiteralVersion = result.literalVersion !== result.naturalVersion;

    return (
      <div className="mx-auto max-w-xl px-6 py-10">
        <AnimatePresence mode="wait">
          <motion.div
            key="feedback"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-4"
          >
            {/* Progress */}
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>{currentIndex + 1} / {queue.length}</span>
              <span className="text-xs">+{XP_REWARDS.WRITING_PRACTICE} XP</span>
            </div>

            {/* Korean feedback */}
            <div className="rounded-xl border bg-card p-5">
              <p className="text-xs font-medium text-muted-foreground mb-2">핵심 피드백</p>
              <p className="text-sm text-foreground leading-relaxed">{result.feedback}</p>
            </div>

            {/* Natural version */}
            <div className="rounded-xl border bg-card p-5 space-y-2">
              <p className="text-xs font-medium text-muted-foreground">자연스럽게 다듬은 버전</p>
              <p className="text-sm text-green-700 dark:text-green-400 leading-relaxed font-medium">
                {result.naturalVersion}
              </p>
            </div>

            {/* Literal version — only if different */}
            {showLiteralVersion && (
              <div className="rounded-xl border bg-card p-5 space-y-2">
                <p className="text-xs font-medium text-muted-foreground">원문 느낌을 살린 버전</p>
                <p className="text-sm text-blue-700 dark:text-blue-400 leading-relaxed font-medium">
                  {result.literalVersion}
                </p>
              </div>
            )}

            {/* User's answer */}
            <div className="rounded-lg bg-secondary/40 px-4 py-3 space-y-1">
              <p className="text-xs text-muted-foreground">내 답변</p>
              <p className="text-sm text-foreground leading-relaxed">{userAnswer}</p>
            </div>

            {/* Target phrase chip */}
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium text-foreground">
                {current?.phrase}
              </span>
              <span className="text-xs text-muted-foreground">{current?.meaning}</span>
            </div>

            {/* Action buttons */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                onClick={handleGraduateAndNext}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm font-medium text-primary hover:bg-primary/20 transition-colors"
              >
                <Check className="h-4 w-4" />
                충분해요
              </button>
              <button
                onClick={handleNext}
                className="flex items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                더 연습할게요
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    );
  }

  // ── Practice screen ──────────────────────────────────────────
  if (phase === "practice" && current) {
    return (
      <div className="mx-auto max-w-xl px-6 py-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={current.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            {/* Progress */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{currentIndex + 1} / {queue.length}</span>
              <div className="flex gap-1">
                {queue.map((_, i) => (
                  <div
                    key={i}
                    className={`h-1.5 w-8 rounded-full transition-colors ${i <= currentIndex ? "bg-primary" : "bg-border"}`}
                  />
                ))}
              </div>
            </div>

            {/* Target phrase context */}
            <div className="rounded-xl border bg-secondary/30 px-4 py-3 flex items-center gap-3">
              <div className="shrink-0 h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <PenLine className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-sm text-foreground truncate">{current.phrase}</p>
                <p className="text-xs text-muted-foreground truncate">{current.meaning}</p>
              </div>
            </div>

            {/* Korean sentence to translate */}
            <div className="rounded-xl border bg-card p-5 space-y-2 min-h-[100px] flex flex-col justify-center">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">이 문장을 영어로</p>
              {loadingKo ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">번역 불러오는 중...</span>
                </div>
              ) : (
                <p className="text-lg font-medium text-foreground leading-relaxed">{exampleKo}</p>
              )}
            </div>

            {/* Input */}
            <div className="space-y-2">
              <textarea
                value={userAnswer}
                onChange={(e) => setUserAnswer(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && userAnswer.trim()) {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
                placeholder="여기에 영어로 써보세요..."
                rows={3}
                disabled={loadingKo || submitting}
                className="w-full resize-none rounded-xl border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50 transition"
              />
              <p className="text-xs text-muted-foreground text-right">Enter로 제출, Shift+Enter로 줄바꿈</p>
            </div>

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={!userAnswer.trim() || submitting || loadingKo}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-all"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  평가 중...
                </>
              ) : (
                <>
                  제출하기
                  <ChevronRight className="h-4 w-4" />
                </>
              )}
            </button>
          </motion.div>
        </AnimatePresence>
      </div>
    );
  }

  return null;
}
