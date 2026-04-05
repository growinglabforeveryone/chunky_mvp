import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useChunkStore, VocabLimitError } from "@/store/chunkStore";
import { useUsageStore, FREE_AI_LIMIT } from "@/store/usageStore";
import { extractChunks, getMeaning, MonthlyLimitError } from "@/lib/claudeExtractor";
import UpgradeModal from "@/components/UpgradeModal";
import TextReader from "@/components/TextReader";
import ChunkCard from "@/components/ChunkCard";
import { Plus, Sparkles, Save, Loader2, Headphones } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

export default function ListenPage() {
  const {
    chunks,
    sourceText,
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

  const { tier, usedThisMonth, canUseAI, incrementUsage } = useUsageStore();

  const navigate = useNavigate();
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [fetching, setFetching] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [upgradeModal, setUpgradeModal] = useState<{ reason: "ai_limit" | "vocab_limit"; used?: number; limit?: number } | null>(null);
  const [pendingMiniCards, setPendingMiniCards] = useState<{ id: string; phrase: string }[]>([]);
  const [schedulingTomorrow, setSchedulingTomorrow] = useState(false);
  const [hoveredChunkId, setHoveredChunkId] = useState<string | null>(null);

  const phase = chunks.length > 0 ? "chunks" : transcript ? "transcript" : "input";

  const isValidYoutubeUrl = (url: string) =>
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/.test(url);

  const handleFetchTranscript = useCallback(async () => {
    if (!youtubeUrl.trim()) return;
    setFetching(true);
    try {
      const response = await fetch("/api/youtube-transcript", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: youtubeUrl }),
      });
      if (!response.ok) {
        const data = await response.json();
        toast.error(data.error || "자막을 불러올 수 없습니다");
        return;
      }
      const { transcript: text } = await response.json();
      setTranscript(text);
      toast.success("자막을 가져왔습니다");
    } catch {
      toast.error("자막을 불러오는 중 오류가 발생했습니다");
    } finally {
      setFetching(false);
    }
  }, [youtubeUrl]);

  const handleExtract = useCallback(async () => {
    if (!transcript) return;
    setExtracting(true);
    setSourceText(transcript);
    setSourceName("YouTube");
    try {
      const result = await extractChunks(transcript);
      incrementUsage();
      setChunks(result);
      toast.success(`${result.length}개의 단어뭉치를 추출했습니다`);
    } catch (err) {
      if (err instanceof MonthlyLimitError) {
        setUpgradeModal({ reason: "ai_limit", used: err.used, limit: err.limit });
        return;
      }
      toast.error("추출에 실패했습니다");
    } finally {
      setExtracting(false);
    }
  }, [transcript, setSourceText, setSourceName, setChunks, incrementUsage]);

  const handleReset = () => {
    setChunks([]);
    setSourceText("");
    setTranscript("");
    setYoutubeUrl("");
  };

  const handleAddChunk = () => {
    addChunk({
      id: crypto.randomUUID(),
      phrase: "",
      meaning: "",
      exampleSentence: "",
      createdAt: new Date().toISOString(),
    });
  };

  const handleCommit = async () => {
    if (chunks.length === 0) return;
    const toCommit = chunks.map((c) => ({ id: c.id, phrase: c.phrase }));
    try {
      await commitChunks();
      setPendingMiniCards(toCommit);
    } catch (err) {
      if (err instanceof VocabLimitError) {
        setUpgradeModal({ reason: "vocab_limit", used: err.current, limit: err.limit });
        return;
      }
      toast.error("저장에 실패했습니다. 다시 시도해주세요.");
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      {phase === "input" && (
        <div className="mx-auto max-w-2xl space-y-6">
          <div className="space-y-2 text-center">
            <h1 className="font-serif text-3xl font-semibold tracking-tight text-foreground">
              들으면서 배우세요
            </h1>
            <p className="text-muted-foreground">
              유튜브 영상 자막에서 핵심 표현을 자동으로 추출합니다
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Headphones className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  placeholder="유튜브 링크를 붙여넣으세요"
                  className="w-full rounded-xl border bg-card py-3 pl-10 pr-4 text-sm shadow-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            {youtubeUrl && !isValidYoutubeUrl(youtubeUrl) && (
              <p className="text-xs text-destructive">올바른 유튜브 링크를 입력해주세요</p>
            )}

            <button
              onClick={handleFetchTranscript}
              disabled={fetching || !isValidYoutubeUrl(youtubeUrl)}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {fetching ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Headphones className="h-5 w-5" />
              )}
              {fetching ? "자막 가져오는 중..." : "자막 가져오기"}
            </button>
          </div>
        </div>
      )}

      {phase === "transcript" && (
        <div className="mx-auto max-w-2xl space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-xl font-semibold text-foreground">자막 내용</h2>
            <button
              onClick={handleReset}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              다른 영상
            </button>
          </div>

          <div className="max-h-80 overflow-y-auto rounded-xl border bg-card p-6 font-serif text-sm leading-relaxed shadow-sm">
            {transcript}
          </div>

          <div className="space-y-2">
            <button
              onClick={!canUseAI() ? () => setUpgradeModal({ reason: "ai_limit", used: usedThisMonth, limit: FREE_AI_LIMIT }) : handleExtract}
              disabled={extracting}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {extracting ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Sparkles className="h-5 w-5" />
              )}
              {extracting ? "추출 중..." : "단어뭉치 추출"}
            </button>
            {tier === "free" && (
              <p className="text-center text-xs text-muted-foreground">
                이번 달 {usedThisMonth}/{FREE_AI_LIMIT}회 사용
              </p>
            )}
          </div>
        </div>
      )}

      {phase === "chunks" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-xl font-semibold text-foreground">추출 결과</h2>
            <button
              onClick={handleReset}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              다른 영상
            </button>
          </div>

          <div className="flex flex-col gap-6 md:flex-row">
            {/* Left: Source text */}
            <div className="space-y-4 md:flex-[3]">
              <h3 className="text-sm font-medium text-muted-foreground">자막</h3>
              <div className="rounded-xl border bg-card p-4 shadow-sm sm:p-6" style={{ maxWidth: "65ch" }}>
                <TextReader
                  text={sourceText}
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
        </div>
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

      {/* 미니 세션 모달 */}
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
                  지금 한 번 ��어보면 더 오래 기억돼요
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
                    handleReset();
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
                      handleReset();
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
