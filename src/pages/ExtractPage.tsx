import { useState, useCallback } from "react";
import { useChunkStore } from "@/store/chunkStore";
import { extractChunksMock } from "@/lib/mockExtractor";
import TextReader from "@/components/TextReader";
import ChunkCard from "@/components/ChunkCard";
import { Plus, Sparkles, Save, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

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
  } = useChunkStore();

  const [loading, setLoading] = useState(false);
  const [hoveredChunkId, setHoveredChunkId] = useState<string | null>(null);
  const [inputText, setInputText] = useState("");

  const handleExtract = useCallback(async () => {
    if (!inputText.trim()) return;
    setLoading(true);
    setSourceText(inputText);
    try {
      const result = await extractChunksMock(inputText);
      setChunks(result);
      toast.success(`${result.length}개의 단어뭉치를 추출했습니다`);
    } catch {
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

  const handleCommit = () => {
    if (chunks.length === 0) return;
    commitChunks();
    setInputText("");
    toast.success("단어뭉치가 저장되었습니다 ✓");
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
                  addChunk({
                    id: crypto.randomUUID(),
                    phrase,
                    meaning: "",
                    exampleSentence: sentence,
                    createdAt: new Date().toISOString(),
                  });
                  toast.success(`"${phrase}" 추가됨`);
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
