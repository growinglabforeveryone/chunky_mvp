import { useState, useMemo, useEffect, useRef } from "react";
import { useChunkStore } from "@/store/chunkStore";
import { useLevelStore } from "@/store/levelStore";
import { Chunk } from "@/types/chunk";
import { motion, AnimatePresence } from "framer-motion";
import { RotateCcw, X, Check, ChevronDown, MinusCircle, MessageCircle, Send, Volume2 } from "lucide-react";
import { useTTS, preloadTTS } from "@/hooks/useTTS";
import { toast } from "sonner";
import { findRelatedPhrases } from "@/utils/relatedPhrases";
import { maskPhraseInSentence, parseKoHighlight, findKoreanHighlightRange } from "@/utils/phraseMask";

const STAGE_LABELS = ["신규", "1일", "7일", "30일", "완료"];
const NEXT_REVIEW_LABELS = ["", "1일 뒤", "7일 뒤", "30일 뒤"];

function isDue(chunk: { reviewStage?: number; nextReviewAt?: string; mastered?: boolean; status?: string }, refTime: Date) {
  if (chunk.mastered) return false;
  if (chunk.status === "excluded") return false;
  if ((chunk.reviewStage ?? 0) === 0) {
    if (chunk.nextReviewAt && new Date(chunk.nextReviewAt) > refTime) return false;
    return true;
  }
  if (!chunk.nextReviewAt) return true;
  return new Date(chunk.nextReviewAt) <= refTime;
}

export default function ReviewPage() {
  const { speak, playing } = useTTS();
  const { savedChunks, advanceChunk, resetChunk, excludeChunk, miniSessionCards, clearMiniSession } = useChunkStore();
  const { totalXP, level } = useLevelStore();
  const xpAtStart = useRef(totalXP);

  // Session queue — managed independently from dueCards after initialization
  const [sessionRefTime, setSessionRefTime] = useState(() => new Date());
  const [sessionQueue, setSessionQueue] = useState<Chunk[]>([]);
  const [failedIds, setFailedIds] = useState<Set<string>>(new Set());
  const [sessionInitialized, setSessionInitialized] = useState(false);
  const [sessionTotal, setSessionTotal] = useState(0);

  const [isFlipped, setIsFlipped] = useState(false);
  const [relatedOpen, setRelatedOpen] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  const [askAIOpen, setAskAIOpen] = useState(false);
  const [askAIInput, setAskAIInput] = useState("");
  const [askAIAnswer, setAskAIAnswer] = useState("");
  const [askAILoading, setAskAILoading] = useState(false);

  const dueCards = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const due = savedChunks.filter((c) => {
      if (!isDue(c, sessionRefTime)) return false;
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
  }, [savedChunks, sessionRefTime]);

  // Initialize session
  // miniSessionCards가 있으면 해당 카드만(추출 직후 "지금 한 번 보기"), 없으면 오늘 복습 due 카드
  useEffect(() => {
    if (sessionInitialized) return;

    if (miniSessionCards.length > 0) {
      // 추출 직후 미니 세션: savedChunks에서 ID 매칭해 full 데이터로 사용
      const miniIds = new Set(miniSessionCards.map((c) => c.id));
      const cards = savedChunks.filter((c) => miniIds.has(c.id));
      if (cards.length > 0) {
        setSessionQueue(cards);
        setSessionTotal(cards.length);
        setSessionInitialized(true);
        clearMiniSession();
      }
      return;
    }

    if (dueCards.length > 0) {
      const source = dueCards.filter((c) => (c.cardType ?? "source") === "source").sort(() => Math.random() - 0.5);
      const situation = dueCards.filter((c) => c.cardType === "situation").sort(() => Math.random() - 0.5);
      setSessionQueue([...source, ...situation]);
      setSessionTotal(dueCards.length);
      setSessionInitialized(true);
    }
  }, [dueCards, sessionInitialized, miniSessionCards, savedChunks]);

  const current = sessionQueue[0];

  useEffect(() => {
    if (current) preloadTTS(current.phrase, current.exampleSentence);
  }, [current?.id]);

  const related = useMemo(
    () => (current ? findRelatedPhrases(current, savedChunks) : []),
    [current, savedChunks]
  );

  const advance = (newQueue: Chunk[]) => {
    setIsFlipped(false);
    setRelatedOpen(false);
    setAskAIOpen(false);
    setAskAIInput("");
    setAskAIAnswer("");
    setTimeout(() => {
      setSessionQueue(newQueue);
      if (newQueue.length === 0) setIsComplete(true);
    }, 150);
  };

  const handleAskAI = async () => {
    if (!current || !askAIInput.trim() || askAILoading) return;
    setAskAILoading(true);
    setAskAIAnswer("");
    try {
      const res = await fetch("/api/ask-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phrase: current.phrase,
          meaning: current.meaning,
          example: current.exampleSentence,
          userQuestion: askAIInput.trim(),
        }),
      });
      const data = await res.json();
      setAskAIAnswer(data.answer ?? "응답을 불러올 수 없어요.");
    } catch {
      setAskAIAnswer("오류가 발생했어요. 다시 시도해주세요.");
    } finally {
      setAskAILoading(false);
    }
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
    setSessionRefTime(new Date());
    setIsComplete(false);
    setSessionInitialized(false);
    setSessionQueue([]);
    setFailedIds(new Set());
    setIsFlipped(false);
    setRelatedOpen(false);
  };


  // ── Screens ──────────────────────────────────────────────

  if (isComplete) {
    const retriedCount = failedIds.size;
    const perfectCount = sessionTotal - retriedCount;
    const earnedXP = totalXP - xpAtStart.current;
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
            {earnedXP > 0 && (
              <p className="text-primary font-semibold">+{earnedXP} XP (Lv.{level})</p>
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
    const tomorrow = new Date();
    tomorrow.setHours(0, 0, 0, 0);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const nextDue = savedChunks
      .filter((c) => !c.mastered && c.status !== "excluded" && c.nextReviewAt
        && new Date(c.nextReviewAt) >= tomorrow)
      .sort((a, b) => new Date(a.nextReviewAt!).getTime() - new Date(b.nextReviewAt!).getTime())[0];

    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center space-y-4 text-center">
          <img src="/chunky/great.png" alt="Chunky" className="w-16 h-16 object-contain" />
          <p className="font-serif text-2xl font-semibold text-foreground">오늘 할 건 다 했어요</p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {nextDue
              ? `다음 복습은 ${new Date(nextDue.nextReviewAt!).toLocaleDateString("ko-KR", { month: "long", day: "numeric" })}이에요.`
              : "잠깐 쉬어도 좋아요."}{" "}
            <br />새 표현을 뽑아봐도 좋고요.
          </p>
        </div>
      </div>
    );
  }

  if (savedChunks.length === 0) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center space-y-4 text-center">
          <img src="/chunky/flower.png" alt="Chunky" className="w-16 h-16 object-contain" />
          <p className="font-serif text-xl text-foreground">아직 단어뭉치가 없어요</p>
          <p className="text-sm text-muted-foreground">텍스트에서 표현을 뽑아볼까요?</p>
        </div>
      </div>
    );
  }

  if (!current) return null;

  const isRetry = failedIds.has(current.id);
  const isSituation = current.cardType === "situation";

  // 앞면: 빈칸 예문 생성 (실패 시 null → fallback)
  const maskedSentence = current.exampleSentence && current.phrase
    ? maskPhraseInSentence(current.exampleSentence, current.phrase)
    : null;
  const showClozeFront = !!current.exampleKo && !!maskedSentence;

  // 한국어 예문 마커 파싱 [[...]] → 강조 범위 추출 (다중 마커 지원)
  const koParsed = current.exampleKo ? parseKoHighlight(current.exampleKo) : null;
  const koDisplayText = koParsed ? koParsed.clean : (current.exampleKo ?? "");

  // 마커 품질 검증: 너무 넓거나(1.8배 초과) 너무 좁으면(0.65배 미만) meaning 기반 fallback
  const koHighlightRanges = (() => {
    if (koParsed) {
      const totalHighlighted = koParsed.ranges.reduce((sum, r) => sum + (r.end - r.start), 0);
      const meaningLen = (current.meaning ?? "").replace(/[~,\s]/g, "").length;
      const isOverMarked = meaningLen > 0 && totalHighlighted > meaningLen * 1.8;
      const isUnderMarked = meaningLen > 0 && totalHighlighted < meaningLen * 0.65;
      if (isOverMarked || isUnderMarked) {
        const fallback = findKoreanHighlightRange(koDisplayText, current.meaning ?? "");
        return fallback ? [{ start: fallback[0], end: fallback[1] }] : null;
      }
      return koParsed.ranges;
    }
    if (current.meaning && koDisplayText) {
      const fallback = findKoreanHighlightRange(koDisplayText, current.meaning);
      return fallback ? [{ start: fallback[0], end: fallback[1] }] : null;
    }
    return null;
  })();

  return (
    <div className="mx-auto max-w-xl px-6 py-10">
      {/* 헤더 */}
      <div className="mb-6 flex items-center justify-end">
        <span className="text-sm text-muted-foreground">
          <span className="tabular-nums font-semibold text-foreground">{sessionTotal - sessionQueue.length + 1}</span>
          <span className="text-muted-foreground/60"> / {sessionTotal}</span>
        </span>
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
          className="preserve-3d grid"
        >
          {/* Front — grid 스태킹으로 Back과 같은 셀 공유 */}
          <div className="backface-hidden [grid-area:1/1] relative flex flex-col items-center justify-center rounded-2xl border bg-card px-6 pt-8 pb-5 shadow-md min-h-[240px] gap-4">
            {/* 카드 속성 뱃지 — 우상단 */}
            <div className="absolute top-3 right-4 flex items-center gap-1.5">
              {isRetry && (
                <span className="rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-xs text-amber-700">다시</span>
              )}
              {isSituation && (
                <span className="rounded-full bg-violet-50 border border-violet-200 px-2 py-0.5 text-xs text-violet-600">상황카드</span>
              )}
              <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground/70">
                {STAGE_LABELS[current.reviewStage ?? 0]}
              </span>
            </div>

            {isSituation ? (
              <>
                <p className="text-center text-base text-muted-foreground/60 text-xs">이 상황에서 영어로?</p>
                <p className="text-center text-xl sm:text-2xl font-semibold font-serif leading-snug">
                  {current.triggerKo}
                </p>
              </>
            ) : showClozeFront ? (
              <>
                {/* 보조: 한국어 예문 (phrase 강조) — 작게 위에 */}
                <span className="text-center text-sm leading-relaxed text-muted-foreground">
                  {koHighlightRanges ? (() => {
                    const parts: React.ReactNode[] = [];
                    let cursor = 0;
                    koHighlightRanges.forEach((r, i) => {
                      if (cursor < r.start) parts.push(koDisplayText.slice(cursor, r.start));
                      parts.push(<span key={i} className="text-primary font-semibold">{koDisplayText.slice(r.start, r.end)}</span>);
                      cursor = r.end;
                    });
                    if (cursor < koDisplayText.length) parts.push(koDisplayText.slice(cursor));
                    return parts;
                  })() : koDisplayText}
                </span>
                {/* 메인: 영어 빈칸 예문 — 크고 진하게 */}
                <p className="text-center text-lg sm:text-xl font-semibold text-foreground leading-relaxed">
                  {maskedSentence}
                </p>
              </>
            ) : (
              <p className="text-center text-xl sm:text-2xl font-semibold font-serif">
                {current.meaning}
              </p>
            )}
            <p className="text-xs text-muted-foreground/40">클릭 또는 Space</p>
          </div>

          {/* Back */}
          <div className="backface-hidden rotate-y-180 [grid-area:1/1] flex flex-col items-center justify-center rounded-2xl border bg-card p-6 shadow-md">
            <div className="flex items-center gap-2">
              <p className="text-center text-xl sm:text-2xl font-semibold">
                {current.phrase}
              </p>
              <button
                onClick={(e) => { e.stopPropagation(); speak(current.phrase); }}
                className={`shrink-0 rounded p-1 transition-colors ${playing === current.phrase ? "text-primary" : "text-muted-foreground/40 hover:text-muted-foreground"}`}
              >
                <Volume2 className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4 w-full rounded-lg bg-secondary/50 px-4 py-3">
              <p className="font-serif text-xs sm:text-sm leading-relaxed text-muted-foreground italic text-center">
                "{current.exampleSentence}"
              </p>
              <div className="mt-2 flex justify-center">
                <button
                  onClick={(e) => { e.stopPropagation(); speak(current.exampleSentence); }}
                  className={`flex items-center gap-1 text-xs transition-colors ${playing === current.exampleSentence ? "text-primary" : "text-muted-foreground/40 hover:text-muted-foreground"}`}
                >
                  <Volume2 className="h-3 w-3" />
                  예문 듣기
                </button>
              </div>
            </div>

            {/* 알았어요 / 몰랐어요 */}
            <div className="mt-5 flex gap-3" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={handleDidntKnow}
                className="flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600 hover:bg-red-100 transition-colors"
              >
                <X className="h-3.5 w-3.5" />
                몰랐어요
                <kbd className="ml-1 hidden sm:inline text-xs text-red-400 font-mono">←</kbd>
              </button>
              <button
                onClick={handleKnew}
                className="flex items-center gap-1.5 rounded-full border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-700 hover:bg-green-100 transition-colors"
              >
                <Check className="h-3.5 w-3.5" />
                알았어요
                <kbd className="ml-1 hidden sm:inline text-xs text-green-500 font-mono">→</kbd>
              </button>
            </div>

            {/* Ask AI 버튼 */}
            <button
              onClick={(e) => { e.stopPropagation(); setAskAIOpen((o) => !o); setAskAIAnswer(""); setAskAIInput(""); }}
              className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground/60 hover:text-primary transition-colors"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              AI에게 물어보기
            </button>

            {/* 제외 버튼 */}
            <button
              onClick={(e) => { e.stopPropagation(); handleExclude(); }}
              className="mt-3 mb-1 flex items-center gap-1 text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors"
            >
              <MinusCircle className="h-3 w-3" />
              복습 목록에서 제외
            </button>
          </div>
        </motion.div>
      </div>

      {/* Ask AI 패널 */}
      <AnimatePresence>
        {isFlipped && askAIOpen && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.2 }}
            className="mt-4 rounded-xl border bg-card p-4 space-y-3"
          >
            <div className="flex gap-2">
              <textarea
                value={askAIInput}
                onChange={(e) => setAskAIInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAskAI(); } }}
                placeholder={`"${current.phrase}" 관련해서 궁금한 점을 입력하세요`}
                rows={2}
                className="flex-1 resize-none rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <button
                onClick={handleAskAI}
                disabled={askAILoading || !askAIInput.trim()}
                className="self-end rounded-lg bg-primary px-3 py-2 text-primary-foreground disabled:opacity-40 transition-opacity"
              >
                {askAILoading ? (
                  <span className="text-xs">...</span>
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </button>
            </div>
            {askAIAnswer && (
              <div className="rounded-lg bg-secondary/50 px-4 py-3 text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                {askAIAnswer}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

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
