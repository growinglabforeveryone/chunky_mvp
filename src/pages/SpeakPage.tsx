import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useChunkStore } from "@/store/chunkStore";
import { correctText, extractChunks, getMeaning, CorrectionResult } from "@/lib/claudeExtractor";
import TextReader from "@/components/TextReader";
import ChunkCard from "@/components/ChunkCard";
import { Plus, Mic, Save, Loader2, Sparkles, RotateCcw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

export default function SpeakPage() {
  const {
    chunks,
    setSourceText,
    setChunks,
    updateChunk,
    removeChunk,
    addChunk,
    commitChunks,
    setSourceName,
    setMiniSessionCards,
    scheduleTomorrow,
  } = useChunkStore();

  const navigate = useNavigate();
  const [inputText, setInputText] = useState("");
  const [correcting, setCorrecting] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [correction, setCorrection] = useState<CorrectionResult | null>(null);
  const [pendingMiniCards, setPendingMiniCards] = useState<{ id: string; phrase: string }[]>([]);
  const [schedulingTomorrow, setSchedulingTomorrow] = useState(false);
  const [hoveredChunkId, setHoveredChunkId] = useState<string | null>(null);

  // Phase: "input" → "corrected" → "chunks"
  const phase = chunks.length > 0 ? "chunks" : correction ? "corrected" : "input";

  const handleCorrectAndExtract = useCallback(async () => {
    if (!inputText.trim()) return;
    setCorrecting(true);
    let corrected = false;
    try {
      // Step 1: Correct
      const result = await correctText(inputText);
      setCorrection(result);
      corrected = true;

      // Step 2: Extract chunks from corrected text
      setExtracting(true);
      setCorrecting(false);
      setSourceText(result.corrected);
      setSourceName("Speaking");

      const extracted = await extractChunks(result.corrected);
      const enriched = extracted.map((c) => ({
        ...c,
        sourceType: "text" as const,
      }));
      setChunks(enriched);
      toast.success(`교정 완료! ${enriched.length}개 단어뭉치를 추출했습니다`);
    } catch (err) {
      console.error("Correct & extract error:", err);
      if (corrected) {
        toast.error("단어뭉치 추출에 실패했습니다. 교정 결과는 확인할 수 있어요");
      } else {
        toast.error("교정에 실패했습니다");
      }
    } finally {
      setCorrecting(false);
      setExtracting(false);
    }
  }, [inputText, setSourceText, setSourceName, setChunks]);

  const handleReset = () => {
    setChunks([]);
    setSourceText("");
    setCorrection(null);
    setInputText("");
  };

  const handleAddChunk = () => {
    addChunk({
      id: crypto.randomUUID(),
      phrase: "",
      meaning: "",
      exampleSentence: correction?.corrected ?? "",
      createdAt: new Date().toISOString(),
    });
  };

  const handleCommit = async () => {
    if (chunks.length === 0) return;
    const toCommit = chunks.map((c) => ({ id: c.id, phrase: c.phrase }));
    try {
      await commitChunks();
      setPendingMiniCards(toCommit);
    } catch {
      toast.error("저장에 실패했습니다. 다시 시도해주세요.");
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      {phase === "input" && (
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
              placeholder="영어로 자유롭게 말해보세요. iPhone 마이크 버튼을 눌러 음성으로 입력할 수도 있어요..."
              className="w-full resize-none rounded-xl border bg-card p-6 font-serif text-lg leading-relaxed shadow-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <div className="pointer-events-none absolute bottom-4 right-4 flex items-center gap-1.5 text-xs text-muted-foreground/40">
              <Mic className="h-3.5 w-3.5" />
              키보드 마이크로 음성 입력
            </div>
          </div>

          <button
            onClick={handleCorrectAndExtract}
            disabled={correcting || extracting || !inputText.trim()}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {correcting || extracting ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Sparkles className="h-5 w-5" />
            )}
            {correcting ? "교정 중..." : extracting ? "단어뭉치 추출 중..." : "교정 + 단어뭉치 추출"}
          </button>
        </div>
      )}

      {(phase === "corrected" || phase === "chunks") && (
        <div className="space-y-4">
          {/* Header */}
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

          {/* Correction Display */}
          {correction && (
            <div className="space-y-4">
              {/* Encouragement */}
              {correction.encouragement && (
                <div className="rounded-xl border border-green-200 bg-green-50 px-5 py-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-950/30 dark:text-green-300">
                  {correction.encouragement}
                </div>
              )}

              {/* Original vs Corrected */}
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

              {/* Corrections Detail */}
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
            </div>
          )}

          {/* Chunks Section */}
          {phase === "chunks" && (
            <div className="flex flex-col gap-6 pt-2 md:flex-row">
              {/* Left: Corrected text with highlights — mobile에서는 접을 수 있게 */}
              <div className="space-y-4 md:flex-[3]">
                <h3 className="text-sm font-medium text-muted-foreground">교정된 텍스트</h3>
                <div className="rounded-xl border bg-card p-4 shadow-sm sm:p-6" style={{ maxWidth: "65ch" }}>
                  <TextReader
                    text={correction?.corrected ?? ""}
                    chunks={chunks}
                    hoveredChunkId={hoveredChunkId}
                    onAddPhrase={(phrase, sentence) => {
                      const id = crypto.randomUUID();
                      addChunk({
                        id,
                        phrase,
                        meaning: "번역 중...",
                        exampleSentence: sentence,
                        createdAt: new Date().toISOString(),
                      });
                      toast.success(`"${phrase}" 추가됨`);
                      getMeaning(phrase).then((meaning) => {
                        updateChunk(id, { meaning });
                      });
                    }}
                  />
                </div>
              </div>

              {/* Right: Chunk cards */}
              <div className="space-y-4 md:flex-[2]">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-muted-foreground">
                    추출된 표현{" "}
                    <span className="tabular-nums">({chunks.length})</span>
                  </h3>
                  <div className="flex gap-2">
                    <button
                      onClick={handleAddChunk}
                      className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      추가
                    </button>
                    <button
                      onClick={handleCommit}
                      className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90"
                    >
                      <Save className="h-3.5 w-3.5" />
                      저장
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <AnimatePresence>
                    {chunks.map((chunk, i) => (
                      <ChunkCard
                        key={chunk.id}
                        chunk={chunk}
                        index={i}
                        onUpdate={updateChunk}
                        onRemove={removeChunk}
                        isActive={hoveredChunkId === chunk.id}
                        onHover={setHoveredChunkId}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Mini Session Modal (same as ExtractPage) */}
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
