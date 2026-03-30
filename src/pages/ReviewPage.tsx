import { useState, useMemo, useEffect } from "react";
import { useChunkStore } from "@/store/chunkStore";
import { Chunk } from "@/types/chunk";
import { motion, AnimatePresence } from "framer-motion";
import { RotateCcw, Shuffle, X, Check, ChevronDown, MinusCircle } from "lucide-react";
import { toast } from "sonner";
import { findRelatedPhrases } from "@/utils/relatedPhrases";

type Mode = "kr-to-en" | "en-to-kr";

const STAGE_LABELS = ["신규", "1일", "7일", "30일", "완료"];
const NEXT_REVIEW_LABELS = ["", "1일 뒤", "7일 뒤", "30일 뒤"];

function isDue(chunk: { reviewStage?: number; nextReviewAt?: string; mastered?: boolean; status?: string }) {
  if (chunk.mastered) return false;
  if (chunk.status === "excluded") return false;
  if ((chunk.reviewStage ?? 0) === 0) return true;
  if (!chunk.nextReviewAt) return true;
  return new Date(chunk.nextReviewAt) <= new Date();
}

export default function ReviewPage() {
  const { savedChunks, advanceChunk, resetChunk, excludeChunk } = useChunkStore();

  // Session queue — managed independently from dueCards after initialization
  const [sessionQueue, setSessionQueue] = useState<Chunk[]>([]);
  const [failedIds, setFailedIds] = useState<Set<string>>(new Set());
  const [sessionInitialized, setSessionInitialized] = useState(false);
  const [sessionTotal, setSessionTotal] = useState(0);

  const [isFlipped, setIsFlipped] = useState(false);
  const [mode, setMode] = useState<Mode>("kr-to-en");
  const [shuffled, setShuffled] = useState(false);
  const [relatedOpen, setRelatedOpen] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  const dueCards = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const due = savedChunks.filter((c) => {
      if (!isDue(c)) return false;
      if (c.lastReviewedAt) {
        const reviewed = new Date(c.lastReviewedAt);
        reviewed.setHours(0, 0, 0, 0);
        if (reviewed >= today) return false;
      }
      return true;
    });

    return due.sort((a, b) => {
      if ((a.reviewStage ?? 0) === 0 && (b.reviewStage ?? 0) !== 0) return -1;
      if ((a.reviewStage ?? 0) !== 0 && (b.reviewStage ?? 0) === 0) return 1;
      return new Date(a.nextReviewAt ?? 0).getTime() - new Date(b.nextReviewAt ?? 0).getTime();
    });
  }, [savedChunks]);

  // Initialize session once when dueCards become available
  useEffect(() => {
    if (!sessionInitialized && dueCards.length > 0) {
      setSessionQueue([...dueCards]);
      setSessionTotal(dueCards.length);
      setSessionInitialized(true);
    }
  }, [dueCards, sessionInitialized]);

  const current = sessionQueue[0];

  const related = useMemo(
    () => (current ? findRelatedPhrases(current, savedChunks) : []),
    [current, savedChunks]
  );

  const advance = (newQueue: Chunk[]) => {
    setIsFlipped(false);
    setRelatedOpen(false);
    setTimeout(() => {
      setSessionQueue(newQueue);
      if (newQueue.length === 0) setIsComplete(true);
    }, 150);
  };

  const handleKnew = async () => {
    if (!current) return;
    const card = current;
    const wasFailed = failedIds.has(card.id);
    const newQueue = sessionQueue.slice(1);

    advance(newQueue);

    if (wasFailed) {
      await resetChunk(card.id);
      if (newQueue.length > 0) toast("재시도 성공! 내일 다시 복습할게요 💪");
    } else {
      await advanceChunk(card.id);
      if (newQueue.length > 0) {
        const newStage = (card.reviewStage ?? 0) + 1;
        if (newStage >= 4) {
          toast.success("완료! 장기 기억으로 전환됐어요 🎉");
        } else {
          toast.success(`다음 복습: ${NEXT_REVIEW_LABELS[newStage]}`);
        }
      }
    }
  };

  const handleDidntKnow = async () => {
    if (!current) return;
    const card = current;

    setFailedIds((prev) => new Set([...prev, card.id]));
    // Move to end of queue
    advance([...sessionQueue.slice(1), card]);
    toast("다시 한 번 해봐요 💪");
  };

  // 키보드 단축키: Space=뒤집기, →=알았어요(뒤집힌 상태), ←=몰랐어요(뒤집힌 상태)
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (!current || isComplete) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.code === "Space") {
        e.preventDefault();
        setIsFlipped((f) => !f);
      } else if (e.code === "ArrowRight" && isFlipped) {
        e.preventDefault();
        handleKnew();
      } else if (e.code === "ArrowLeft" && isFlipped) {
        e.preventDefault();
        handleDidntKnow();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, isFlipped, isComplete]);

  const handleExclude = async () => {
    if (!current) return;
    const card = current;
    const newQueue = sessionQueue.filter((c) => c.id !== card.id);

    await excludeChunk(card.id);
    toast("라이브러리에서 복구할 수 있어요");
    advance(newQueue);
  };

  const handleRestart = () => {
    setIsComplete(false);
    setSessionInitialized(false);
    setSessionQueue([]);
    setFailedIds(new Set());
    setIsFlipped(false);
    setRelatedOpen(false);
  };

  const handleShuffle = () => {
    const next = !shuffled;
    setShuffled(next);
    if (next) {
      setSessionQueue((prev) => [...prev].sort(() => Math.random() - 0.5));
    }
  };

  // ── Screens ──────────────────────────────────────────────

  if (isComplete) {
    const retriedCount = failedIds.size;
    const perfectCount = sessionTotal - retriedCount;
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center space-y-5">
          <p className="font-serif text-2xl font-semibold text-foreground">복습 완료 ✓</p>
          <div className="rounded-xl border bg-card px-8 py-5 space-y-2 text-sm">
            <p className="text-muted-foreground">총 {sessionTotal}개 완료</p>
            <p className="text-green-600 font-medium">처음부터 알았어요 {perfectCount}개</p>
            {retriedCount > 0 && (
              <p className="text-amber-600">재시도 후 성공 {retriedCount}개</p>
            )}
          </div>
          <button
            onClick={handleRestart}
            className="flex items-center gap-1.5 mx-auto rounded-xl px-5 py-2 text-sm text-muted-foreground hover:bg-secondary transition-colors"
          >
            <RotateCcw className="h-4 w-4" />
            처음부터 다시
          </button>
        </div>
      </div>
    );
  }

  if (savedChunks.length > 0 && dueCards.length === 0 && !sessionInitialized) {
    const nextDue = savedChunks
      .filter((c) => !c.mastered && c.status !== "excluded" && c.nextReviewAt)
      .sort((a, b) => new Date(a.nextReviewAt!).getTime() - new Date(b.nextReviewAt!).getTime())[0];

    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center space-y-3">
          <p className="font-serif text-2xl font-semibold text-foreground">오늘 복습 완료 ✓</p>
          {nextDue && (
            <p className="text-sm text-muted-foreground">
              다음 복습:{" "}
              {new Date(nextDue.nextReviewAt!).toLocaleDateString("ko-KR", { month: "long", day: "numeric" })}
            </p>
          )}
        </div>
      </div>
    );
  }

  if (savedChunks.length === 0) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center space-y-3">
          <p className="font-serif text-xl text-foreground">아직 저장된 단어뭉치가 없습니다</p>
          <p className="text-sm text-muted-foreground">추출 탭에서 텍스트를 분석하고 단어뭉치를 저장하세요</p>
        </div>
      </div>
    );
  }

  if (!current) return null;

  const isRetry = failedIds.has(current.id);
  const frontContent = mode === "kr-to-en" ? current.meaning : current.phrase;
  const backContent = mode === "kr-to-en" ? current.phrase : current.meaning;

  return (
    <div className="mx-auto max-w-xl px-6 py-10">
      {/* 헤더 */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMode("kr-to-en")}
            className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
              mode === "kr-to-en" ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            한→영
          </button>
          <button
            onClick={() => setMode("en-to-kr")}
            className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
              mode === "en-to-kr" ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            영→한
          </button>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            <span className="tabular-nums font-medium text-foreground">{sessionQueue.length}</span>
            <span className="ml-1">개 남음</span>
          </span>
          <button
            onClick={handleShuffle}
            className={`rounded-lg p-1.5 transition-colors ${shuffled ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground"}`}
          >
            <Shuffle className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* 단계 + 재시도 표시 */}
      <div className="mb-4 flex items-center gap-2">
        {[0, 1, 2, 3].map((s) => (
          <div
            key={s}
            className={`h-1 flex-1 rounded-full transition-colors ${
              s < (current.reviewStage ?? 0) ? "bg-primary" : s === (current.reviewStage ?? 0) ? "bg-primary/40" : "bg-border"
            }`}
          />
        ))}
        <span className="ml-1 text-xs text-muted-foreground">
          {STAGE_LABELS[current.reviewStage ?? 0]}
        </span>
        {isRetry && (
          <span className="rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-xs text-amber-700">
            다시
          </span>
        )}
      </div>

      {/* 플래시카드 */}
      <div
        className="cursor-pointer"
        style={{ perspective: "1000px" }}
        onClick={() => setIsFlipped((f) => !f)}
      >
        <motion.div
          animate={{ rotateY: isFlipped ? 180 : 0 }}
          transition={{ type: "spring", duration: 0.6, bounce: 0.1 }}
          className="preserve-3d relative"
          style={{ minHeight: "300px" }}
        >
          {/* Front */}
          <div className="backface-hidden absolute inset-0 flex flex-col items-center justify-center rounded-2xl border bg-card p-8 shadow-md">
            <p className={`text-center text-2xl font-semibold ${mode === "en-to-kr" ? "" : "font-serif"}`}>
              {frontContent}
            </p>
            <p className="mt-8 text-xs text-muted-foreground/60">클릭 또는 Space</p>
          </div>

          {/* Back */}
          <div className="backface-hidden rotate-y-180 absolute inset-0 flex flex-col items-center justify-center rounded-2xl border bg-card p-8 shadow-md">
            <p className={`text-center text-2xl font-semibold ${mode === "kr-to-en" ? "" : "font-serif"}`}>
              {backContent}
            </p>
            <div className="mt-5 rounded-lg bg-secondary/50 px-4 py-3">
              <p className="font-serif text-sm leading-relaxed text-muted-foreground italic text-center">
                "{current.exampleSentence}"
              </p>
            </div>

            {/* 알았어요 / 몰랐어요 */}
            <div className="mt-6 flex gap-3" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={handleDidntKnow}
                className="flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-5 py-2 text-sm text-red-600 hover:bg-red-100 transition-colors"
              >
                <X className="h-3.5 w-3.5" />
                몰랐어요
                <kbd className="ml-1 text-xs text-red-400 font-mono">←</kbd>
              </button>
              <button
                onClick={handleKnew}
                className="flex items-center gap-1.5 rounded-full border border-green-200 bg-green-50 px-5 py-2 text-sm text-green-700 hover:bg-green-100 transition-colors"
              >
                <Check className="h-3.5 w-3.5" />
                알았어요
                <kbd className="ml-1 text-xs text-green-500 font-mono">→</kbd>
              </button>
            </div>

            {/* 제외 버튼 */}
            <button
              onClick={(e) => { e.stopPropagation(); handleExclude(); }}
              className="mt-3 flex items-center gap-1 text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors"
            >
              <MinusCircle className="h-3 w-3" />
              복습 목록에서 제외
            </button>
          </div>
        </motion.div>
      </div>

      {/* 비슷한 표현 */}
      <AnimatePresence>
        {isFlipped && related.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.2 }}
            className="mt-4"
          >
            <button
              onClick={() => setRelatedOpen((o) => !o)}
              className="flex w-full items-center justify-between rounded-xl border bg-secondary/40 px-4 py-2.5 text-sm text-muted-foreground hover:bg-secondary transition-colors"
            >
              <span>비슷한 표현 알아보기</span>
              <span className="flex items-center gap-1.5">
                <span className="tabular-nums text-xs font-medium text-primary">+{related.length}</span>
                <ChevronDown className={`h-4 w-4 transition-transform ${relatedOpen ? "rotate-180" : ""}`} />
              </span>
            </button>
            <AnimatePresence>
              {relatedOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="mt-2 space-y-2">
                    {related.map((r) => (
                      <div key={r.id} className="rounded-xl border bg-card px-4 py-3">
                        <p className="font-medium text-sm text-foreground">{r.phrase}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{r.meaning}</p>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 처음부터 */}
      <div className="mt-6 flex justify-center">
        <button
          onClick={handleRestart}
          className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm text-muted-foreground hover:bg-secondary"
        >
          <RotateCcw className="h-4 w-4" />
          처음부터
        </button>
      </div>
    </div>
  );
}
