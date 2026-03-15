import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useChunkStore } from "@/store/chunkStore";
import { extractChunks, getMeaning } from "@/lib/claudeExtractor";
import TextReader from "@/components/TextReader";
import ChunkCard from "@/components/ChunkCard";
import { Plus, Sparkles, Save, Loader2, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

const SOURCE_PRESETS = [
  { label: "📧 이메일", value: "이메일" },
  { label: "📰 기사/뉴스", value: "기사/뉴스" },
  { label: "📚 교재/수업", value: "교재/수업" },
  { label: "📖 책", value: "책" },
  { label: "💼 업무 문서", value: "업무 문서" },
];

export default function ExtractPage() {
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
    sourceName,
  } = useChunkStore();

  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [hoveredChunkId, setHoveredChunkId] = useState<string | null>(null);
  const [inputText, setInputText] = useState("");
  const [showSource, setShowSource] = useState(false);
  const [customSource, setCustomSource] = useState("");

  const handleExtract = useCallback(async () => {
    if (!inputText.trim()) return;
    setLoading(true);
    setSourceText(inputText);
    try {
      const result = await extractChunks(inputText);
      setChunks(result);
      toast.success(`${result.length}개의 단어뭉치를 추출했습니다`);
    } catch (err) {
      console.error("Extract error:", err);
      toast.error("추출에 실패했습니다");
    } finally {
      setLoading(false);
    }
  }, [inputText, setSourceText, setChunks]);

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
    try {
      await commitChunks();
      setInputText("");
      toast.success("저장 완료! 지금 바로 복습해보세요 ✓");
      navigate("/review");
    } catch {
      toast.error("저장에 실패했습니다. 다시 시도해주세요.");
    }
  };

  const showReader = sourceText && chunks.length > 0;

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      {!showReader ? (
        <div className="mx-auto max-w-2xl space-y-6">
          <div className="space-y-2 text-center">
            <h1 className="font-serif text-3xl font-semibold tracking-tight text-foreground">
              읽기를 어휘로 바꾸세요
            </h1>
            <p className="text-muted-foreground">
              영어 텍스트를 붙여넣으면 핵심 표현을 자동으로 추출합니다
            </p>
          </div>

          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            rows={12}
            placeholder="영어 기사, 이메일, 또는 텍스트를 여기에 붙여넣으세요..."
            className="w-full resize-none rounded-xl border bg-card p-6 font-serif text-lg leading-relaxed shadow-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
          />

          {/* 출처 선택 (선택사항) */}
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setShowSource((v) => !v)}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showSource ? "rotate-180" : ""}`} />
              출처 추가 <span className="text-xs opacity-60">(선택)</span>
              {sourceName && (
                <span className="ml-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                  {sourceName}
                </span>
              )}
            </button>

            <AnimatePresence>
              {showSource && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="space-y-3 pt-1">
                    <div className="flex flex-wrap gap-2">
                      {SOURCE_PRESETS.map((preset) => (
                        <button
                          key={preset.value}
                          type="button"
                          onClick={() => {
                            setSourceName(sourceName === preset.value ? "" : preset.value);
                            setCustomSource("");
                          }}
                          className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                            sourceName === preset.value
                              ? "border-primary bg-primary/10 text-primary font-medium"
                              : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => {
                          setSourceName("");
                          setCustomSource((v) => v || " ");
                        }}
                        className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                          customSource.trim()
                            ? "border-primary bg-primary/10 text-primary font-medium"
                            : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
                        }`}
                      >
                        ✏️ 직접입력
                      </button>
                    </div>
                    {(customSource || customSource === " ") && (
                      <input
                        autoFocus
                        value={customSource.trim()}
                        onChange={(e) => {
                          setCustomSource(e.target.value);
                          setSourceName(e.target.value);
                        }}
                        placeholder="예: HBR, Ringle, Harry Potter..."
                        className="w-full rounded-lg border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button
            onClick={handleExtract}
            disabled={loading || !inputText.trim()}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Sparkles className="h-5 w-5" />
            )}
            {loading ? "추출 중..." : "단어뭉치 추출"}
          </button>
        </div>
      ) : (
        <div className="flex gap-6">
          {/* Left: Reader */}
          <div className="flex-[3] space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-muted-foreground">
                원문
              </h2>
              <button
                onClick={() => {
                  setChunks([]);
                  setSourceText("");
                  setInputText("");
                }}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                새 텍스트
              </button>
            </div>
            <div className="rounded-xl border bg-card p-6 shadow-sm" style={{ maxWidth: "65ch" }}>
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

          {/* Right: Inspector */}
          <div className="flex-[2] space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-muted-foreground">
                추출된 표현{" "}
                <span className="tabular-nums">({chunks.length})</span>
              </h2>
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
  );
}
