import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useChunkStore, VocabLimitError } from "@/store/chunkStore";
import { useUsageStore, FREE_AI_LIMIT } from "@/store/usageStore";
import { correctText, extractChunks, getMeaning, CorrectionResult, MonthlyLimitError } from "@/lib/claudeExtractor";
import UpgradeModal from "@/components/UpgradeModal";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import TextReader from "@/components/TextReader";
import ChunkCard from "@/components/ChunkCard";
import { Chunk } from "@/types/chunk";
import { Plus, Mic, MicOff, Save, Loader2, Sparkles, RotateCcw, MessageSquare } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

type SpeakMode = "free" | "situation";

export default function SpeakPage() {
  const {
    setChunks: storeSetChunks,
    commitChunks,
    setSourceName,
    setMiniSessionCards,
    scheduleTomorrow,
  } = useChunkStore();

  const { tier, usedThisMonth, canUseAI, incrementUsage } = useUsageStore();
  const navigate = useNavigate();

  const [mode, setMode] = useState<SpeakMode>("free");

  // ── Mode 2: 상황 표현 찾기 ──
  const [situationKo, setSituationKo] = useState("");
  const [situationChunks, setSituationChunks] = useState<Chunk[]>([]);
  const [situationLoading, setSituationLoading] = useState(false);
  const [situationPhase, setSituationPhase] = useState<"input" | "result">("input");

  const handleSituationSearch = async () => {
    if (!situationKo.trim() || situationLoading) return;
    setSituationLoading(true);
    try {
      const res = await fetch("/api/situation-phrases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ situationKo: situationKo.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.phrases) throw new Error("failed");
      incrementUsage();
      const chunks: Chunk[] = data.phrases.map((p: { phrase: string; meaning: string; functionLabel?: string; exampleSentence: string }) => ({
        id: crypto.randomUUID(),
        phrase: p.phrase,
        meaning: p.meaning,
        functionLabel: p.functionLabel,
        exampleSentence: p.exampleSentence,
        cardType: "situation" as const,
        triggerKo: situationKo.trim(),
        createdAt: new Date().toISOString(),
      }));
      setSituationChunks(chunks);
      setSituationPhase("result");
    } catch {
      toast.error("표현 생성에 실패했어요. 다시 시도해주세요.");
    } finally {
      setSituationLoading(false);
    }
  };

  const handleSituationCommit = async () => {
    const toSave = situationChunks.filter((c) => c.phrase.trim());
    if (toSave.length === 0) return;
    const toCommit = toSave.map((c) => ({ id: c.id, phrase: c.phrase }));
    try {
      storeSetChunks(toSave);
      setSourceName("상황 표현");
      await commitChunks();
      setPendingMiniCards(toCommit);
      setSituationChunks([]);
      setSituationPhase("input");
      setSituationKo("");
    } catch (err) {
      storeSetChunks([]);
      if (err instanceof VocabLimitError) {
        setUpgradeModal({ reason: "vocab_limit", used: err.current, limit: err.limit });
        return;
      }
      toast.error("저장에 실패했어요. 다시 시도해주세요.");
    }
  };

  const handleSituationReset = () => {
    setSituationChunks([]);
    setSituationPhase("input");
    setSituationKo("");
  };

  const [inputText, setInputText] = useState("");
  const [correction, setCorrection] = useState<CorrectionResult | null>(null);
  // speakChunks는 로컬 상태 — chunkStore(읽기/라이브러리 전용)를 오염시키지 않음
  const [speakChunks, setSpeakChunks] = useState<Chunk[]>([]);
  const [correcting, setCorrecting] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [extractingAlt, setExtractingAlt] = useState(false);
  const [pendingMiniCards, setPendingMiniCards] = useState<{ id: string; phrase: string }[]>([]);
  const [schedulingTomorrow, setSchedulingTomorrow] = useState(false);
  const [hoveredChunkId, setHoveredChunkId] = useState<string | null>(null);
  const [upgradeModal, setUpgradeModal] = useState<{ reason: "ai_limit" | "vocab_limit"; used?: number; limit?: number } | null>(null);

  const { isListening, isSupported: speechSupported, startListening, stopListening } =
    useSpeechRecognition(useCallback((text: string) => setInputText(text), []));

  // 상태 A: 교정 완료, 추출 전 / 상태 B: 추출 완료
  const phase = speakChunks.length > 0 ? "chunks" : correction ? "corrected" : "input";

  // Step 1: 교정만
  const handleCorrect = useCallback(async () => {
    if (!inputText.trim()) return;
    setCorrecting(true);
    try {
      const result = await correctText(inputText);
      incrementUsage();
      setCorrection(result);
    } catch (err) {
      if (err instanceof MonthlyLimitError) {
        setUpgradeModal({ reason: "ai_limit", used: err.used, limit: err.limit });
        return;
      }
      toast.error("교정에 실패했습니다");
    } finally {
      setCorrecting(false);
    }
  }, [inputText, incrementUsage]);

  // Step 2-alt: 대안 문장들에서 추출 (상태 A 또는 B에서 append)
  const handleExtractAlternatives = useCallback(async () => {
    if (!correction?.alternatives?.length || extractingAlt) return;
    setExtractingAlt(true);
    try {
      const combinedText = correction.alternatives.join("\n");
      const extracted = await extractChunks(combinedText);
      incrementUsage();
      const enriched = extracted.map((c) => ({ ...c, sourceType: "text" as const }));
      setSpeakChunks((prev) => [...prev, ...enriched]);
      toast.success(`${enriched.length}개 단어뭉치를 추가했습니다`);
    } catch (err) {
      if (err instanceof MonthlyLimitError) {
        setUpgradeModal({ reason: "ai_limit", used: err.used, limit: err.limit });
        return;
      }
      toast.error("단어뭉치 추출에 실패했습니다");
    } finally {
      setExtractingAlt(false);
    }
  }, [correction, extractingAlt, incrementUsage]);

  // Step 2: 추출 (상태 A → B)
  const handleExtract = useCallback(async () => {
    if (!correction) return;
    setExtracting(true);
    try {
      const extracted = await extractChunks(correction.corrected);
      incrementUsage();
      const enriched = extracted.map((c) => ({ ...c, sourceType: "text" as const }));
      setSpeakChunks(enriched);
      toast.success(`${enriched.length}개 단어뭉치를 추출했습니다`);
    } catch (err) {
      if (err instanceof MonthlyLimitError) {
        setUpgradeModal({ reason: "ai_limit", used: err.used, limit: err.limit });
        return;
      }
      toast.error("단어뭉치 추출에 실패했습니다");
    } finally {
      setExtracting(false);
    }
  }, [correction, incrementUsage]);

  const handleReset = () => {
    setSpeakChunks([]);
    setCorrection(null);
    setInputText("");
  };

  const handleAddChunk = () => {
    const id = crypto.randomUUID();
    setSpeakChunks((prev) => [
      ...prev,
      {
        id,
        phrase: "",
        meaning: "",
        exampleSentence: correction?.corrected ?? "",
        createdAt: new Date().toISOString(),
      },
    ]);
  };

  const handleUpdateChunk = (id: string, updates: Partial<Chunk>) => {
    setSpeakChunks((prev) => prev.map((c) => (c.id === id ? { ...c, ...updates } : c)));
  };

  const handleRemoveChunk = (id: string) => {
    setSpeakChunks((prev) => prev.filter((c) => c.id !== id));
  };

  const handleCommit = async () => {
    if (speakChunks.length === 0) return;
    const toCommit = speakChunks.map((c) => ({ id: c.id, phrase: c.phrase }));
    try {
      // commitChunks는 chunkStore.chunks를 읽으므로 임시 주입 후 저장
      storeSetChunks(speakChunks);
      setSourceName("말하기");
      await commitChunks();
      setPendingMiniCards(toCommit);
      setSpeakChunks([]);
    } catch (err) {
      storeSetChunks([]); // 실패 시 원복
      if (err instanceof VocabLimitError) {
        setUpgradeModal({ reason: "vocab_limit", used: err.current, limit: err.limit });
        return;
      }
      toast.error("저장에 실패했습니다. 다시 시도해주세요.");
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">

      {/* ── 모드 토글 ── */}
      <div className="mx-auto mb-8 max-w-2xl flex gap-1 rounded-xl bg-secondary/50 p-1">
        <button
          onClick={() => setMode("free")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm transition-colors ${
            mode === "free" ? "bg-card shadow-sm font-medium text-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Mic className="h-3.5 w-3.5" />
          혼자 말하기
        </button>
        <button
          onClick={() => setMode("situation")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm transition-colors ${
            mode === "situation" ? "bg-card shadow-sm font-medium text-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <MessageSquare className="h-3.5 w-3.5" />
          상황 표현 찾기
        </button>
      </div>

      {/* ── Mode 2: 상황 표현 찾기 ── */}
      {mode === "situation" && situationPhase === "input" && (
        <div className="mx-auto max-w-2xl space-y-6">
          <div className="space-y-2 text-center">
            <h1 className="font-serif text-3xl font-semibold tracking-tight text-foreground">
              이 상황, 영어로 어떻게 말하지?
            </h1>
            <p className="text-muted-foreground">
              말하고 싶었는데 표현이 안 떠올랐던 상황을 적어주세요
            </p>
          </div>
          <textarea
            value={situationKo}
            onChange={(e) => setSituationKo(e.target.value)}
            rows={5}
            placeholder="예: 팀 회의에서 상대 의견을 부분적으로 인정하면서 반박하고 싶었어&#10;예: 친구한테 짜증나서 그 얘기 꺼내지도 말라고 하고 싶었어"
            className="w-full resize-none rounded-xl border bg-card p-5 font-serif text-base leading-relaxed shadow-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <button
            onClick={!canUseAI() ? () => setUpgradeModal({ reason: "ai_limit", used: usedThisMonth, limit: FREE_AI_LIMIT }) : handleSituationSearch}
            disabled={situationLoading || !situationKo.trim()}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {situationLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
            {situationLoading ? "표현 찾는 중..." : "표현 찾기"}
          </button>
          {tier === "free" && (
            <p className="text-center text-xs text-muted-foreground">
              이번 달 {usedThisMonth}/{FREE_AI_LIMIT}회 사용
            </p>
          )}
        </div>
      )}

      {mode === "situation" && situationPhase === "result" && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-auto max-w-2xl space-y-4"
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-serif text-xl font-semibold text-foreground">추천 표현</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">"{situationKo}"</p>
            </div>
            <button
              onClick={handleSituationReset}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              다시 찾기
            </button>
          </div>

          <div className="space-y-3">
            {situationChunks.map((chunk, i) => (
              <ChunkCard
                key={chunk.id}
                chunk={chunk}
                index={i}
                onUpdate={(id, updates) =>
                  setSituationChunks((prev) => prev.map((c) => (c.id === id ? { ...c, ...updates } : c)))
                }
                onRemove={(id) => setSituationChunks((prev) => prev.filter((c) => c.id !== id))}
              />
            ))}
          </div>

          <button
            onClick={handleSituationCommit}
            disabled={situationChunks.length === 0}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            라이브러리에 저장
          </button>
        </motion.div>
      )}

      {/* ── Mode 1: 혼자 말하기 ── */}
      {mode === "free" && phase === "input" && (
        <div className="mx-auto max-w-2xl space-y-6">
          <div className="space-y-2 text-center">
            <h1 className="font-serif text-3xl font-semibold tracking-tight text-foreground">
              말하면서 배우세요
            </h1>
            <p className="text-muted-foreground">
              영어로 말해보세요. 교정해주고 핵심 표현을 뽑아드려요
            </p>
          </div>

          <div className="relative">
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              rows={8}
              placeholder="영어로 자유롭게 말해보세요..."
              className="w-full resize-none rounded-xl border bg-card p-6 pr-16 font-serif text-lg leading-relaxed shadow-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            {speechSupported && (
              <button
                type="button"
                onClick={isListening ? stopListening : startListening}
                className={`absolute bottom-4 right-4 rounded-full p-2.5 transition-colors ${
                  isListening
                    ? "bg-red-500 text-white animate-pulse"
                    : "bg-secondary text-muted-foreground hover:bg-secondary/80 hover:text-foreground"
                }`}
                title={isListening ? "음성 인식 중지" : "음성으로 입력"}
              >
                {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </button>
            )}
          </div>

          {isListening && (
            <p className="text-center text-sm text-red-500 animate-pulse">
              듣고 있어요... 말을 마치면 버튼을 눌러 중지하세요
            </p>
          )}

          <div className="space-y-2">
            <button
              onClick={!canUseAI() ? () => setUpgradeModal({ reason: "ai_limit", used: usedThisMonth, limit: FREE_AI_LIMIT }) : handleCorrect}
              disabled={correcting || !inputText.trim()}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {correcting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
              {correcting ? "교정 중..." : "교정하기"}
            </button>
            {tier === "free" && (
              <p className="text-center text-xs text-muted-foreground">
                이번 달 {usedThisMonth}/{FREE_AI_LIMIT}회 사용 (교정+추출 = 2회 차감)
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── 상태 A: 교정 완료, 추출 전 ── */}
      {mode === "free" && phase === "corrected" && correction && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-auto max-w-2xl space-y-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-xl font-semibold text-foreground">교정 결과</h2>
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              새로 말하기
            </button>
          </div>

          {correction.encouragement && (
            <div className="rounded-xl border border-green-200 bg-green-50 px-5 py-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-950/30 dark:text-green-300">
              {correction.encouragement}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">내가 쓴 문장</p>
              <div className="rounded-xl border bg-card p-4 font-serif text-sm leading-relaxed text-muted-foreground">
                {inputText}
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-primary">교정된 문장</p>
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 font-serif text-sm leading-relaxed text-foreground">
                {correction.corrected}
              </div>
            </div>
          </div>

          {correction.corrections.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">교정 내용</p>
              <div className="space-y-2">
                {correction.corrections.map((c, i) => (
                  <div key={i} className="rounded-lg border bg-card px-4 py-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="line-through text-muted-foreground">{c.original_phrase}</span>
                      <span className="text-muted-foreground">→</span>
                      <span className="font-medium text-primary">{c.corrected_phrase}</span>
                    </div>
                    <p className="mt-1 text-muted-foreground">{c.explanation}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 상태 A CTA */}
          <button
            onClick={!canUseAI() ? () => setUpgradeModal({ reason: "ai_limit", used: usedThisMonth, limit: FREE_AI_LIMIT }) : handleExtract}
            disabled={extracting}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {extracting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
            {extracting ? "추출 중..." : "⚡ 단어뭉치 추출하기"}
          </button>

          {correction.alternatives && correction.alternatives.length > 0 && (
            <div className="space-y-2">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">이렇게도 말할 수 있어요</p>
                <p className="text-[11px] text-muted-foreground/70">추출 후 여기서도 청키를 더 뽑을 수 있어요</p>
              </div>
              <div className="space-y-2">
                {correction.alternatives.map((alt, i) => (
                  <div key={i} className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 font-serif text-sm leading-relaxed dark:border-amber-800 dark:bg-amber-950/30">
                    {alt}
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* ── 상태 B: 추출 완료 ── */}
      {mode === "free" && phase === "chunks" && correction && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-xl font-semibold text-foreground">교정 결과</h2>
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              새로 말하기
            </button>
          </div>

          <div className="flex flex-col gap-6 md:grid md:grid-cols-5 md:items-start">
            {/* 교정된 텍스트 (desktop: 좌상단) */}
            <div className="space-y-4 md:col-span-3 md:row-start-1">
              <h3 className="text-sm font-medium text-muted-foreground">교정된 텍스트</h3>
              <div className="rounded-xl border bg-card p-4 shadow-sm sm:p-6" style={{ maxWidth: "65ch" }}>
                <TextReader
                  text={correction.corrected}
                  chunks={speakChunks}
                  hoveredChunkId={hoveredChunkId}
                  onAddPhrase={(phrase, sentence) => {
                    const id = crypto.randomUUID();
                    handleUpdateChunk(id, { phrase, meaning: "번역 중...", exampleSentence: sentence });
                    setSpeakChunks((prev) => [
                      ...prev,
                      { id, phrase, meaning: "번역 중...", exampleSentence: sentence, createdAt: new Date().toISOString() },
                    ]);
                    toast.success(`"${phrase}" 추가됨`);
                    getMeaning(phrase).then((meaning) => handleUpdateChunk(id, { meaning }));
                  }}
                />
              </div>
            </div>

            {/* 단어뭉치 카드 (desktop: 우측 전체 높이) */}
            <div className="space-y-4 md:col-span-2 md:row-span-2 md:row-start-1">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-muted-foreground">
                  추출된 표현 <span className="tabular-nums">({speakChunks.length})</span>
                </h3>
                <button
                  onClick={handleAddChunk}
                  className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
                >
                  <Plus className="h-3.5 w-3.5" />
                  추가
                </button>
              </div>

              <div className="space-y-3">
                <AnimatePresence>
                  {speakChunks.map((chunk, i) => (
                    <ChunkCard
                      key={chunk.id}
                      chunk={chunk}
                      index={i}
                      onUpdate={handleUpdateChunk}
                      onRemove={handleRemoveChunk}
                      isActive={hoveredChunkId === chunk.id}
                      onHover={setHoveredChunkId}
                    />
                  ))}
                </AnimatePresence>
              </div>

              {/* 상태 B CTA */}
              <button
                onClick={handleCommit}
                disabled={speakChunks.length === 0}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                라이브러리에 저장
              </button>
            </div>

            {/* 대안 표현 (desktop: 교정된 텍스트 아래, mobile: 청크 카드 아래) */}
            {correction.alternatives && correction.alternatives.length > 0 && (
              <div className="space-y-2 md:col-span-3 md:row-start-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">이렇게도 말할 수 있어요</p>
                <div className="space-y-1.5">
                  {correction.alternatives.map((alt, i) => (
                    <div key={i} className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 font-serif text-sm leading-relaxed dark:border-amber-800 dark:bg-amber-950/30">
                      {alt}
                    </div>
                  ))}
                </div>
                <button
                  onClick={!canUseAI() ? () => setUpgradeModal({ reason: "ai_limit", used: usedThisMonth, limit: FREE_AI_LIMIT }) : handleExtractAlternatives}
                  disabled={extractingAlt}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-800 transition-colors hover:bg-amber-100 disabled:opacity-50 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-300 dark:hover:bg-amber-950/50"
                >
                  {extractingAlt ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  {extractingAlt ? "추출 중..." : "대안 표현에서도 청키 더 뽑기"}
                </button>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* 업그레이드 모달 */}
      {upgradeModal && (
        <UpgradeModal
          open
          onClose={() => setUpgradeModal(null)}
          reason={upgradeModal.reason}
          used={upgradeModal.used}
          limit={upgradeModal.limit}
        />
      )}

      {/* 저장 완료 모달 */}
      <AnimatePresence>
        {pendingMiniCards.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              className="w-full max-w-sm space-y-4 rounded-2xl border bg-card p-6 shadow-lg"
            >
              <div className="space-y-1 text-center">
                <p className="text-lg font-semibold text-foreground">
                  {pendingMiniCards.length}개 저장 완료!
                </p>
                <p className="text-sm text-muted-foreground">
                  지금 한 번 훑어보면 더 오래 기억돼요
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => {
                    setMiniSessionCards(
                      pendingMiniCards.map((c) => ({
                        ...c,
                        meaning: "",
                        exampleSentence: "",
                        createdAt: new Date().toISOString(),
                        reviewStage: 0,
                        status: "active" as const,
                      }))
                    );
                    setPendingMiniCards([]);
                    setCorrection(null);
                    setInputText("");
                    navigate("/review");
                  }}
                  className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  지금 한 번 보기
                </button>
                <button
                  disabled={schedulingTomorrow}
                  onClick={async () => {
                    setSchedulingTomorrow(true);
                    try {
                      await scheduleTomorrow(pendingMiniCards.map((c) => c.id));
                      toast.success("내일 복습 큐에 추가됐어요");
                    } finally {
                      setSchedulingTomorrow(false);
                      setPendingMiniCards([]);
                      setCorrection(null);
                      setInputText("");
                    }
                  }}
                  className="w-full rounded-xl border px-4 py-3 text-sm text-muted-foreground transition-colors hover:bg-secondary disabled:opacity-50"
                >
                  {schedulingTomorrow ? "저장 중..." : "내일부터 복습"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
