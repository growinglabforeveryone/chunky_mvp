import { Chunk } from "@/types/chunk";
import { Pencil, Trash2, Check, X, ExternalLink, Volume2 } from "lucide-react";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useTTS } from "@/hooks/useTTS";

interface ChunkCardProps {
  chunk: Chunk;
  index: number;
  onUpdate: (id: string, updates: Partial<Chunk>) => void;
  onRemove: (id: string) => void;
  isActive?: boolean;
  onHover?: (id: string | null) => void;
}

export default function ChunkCard({
  chunk,
  index,
  onUpdate,
  onRemove,
  isActive,
  onHover,
}: ChunkCardProps) {
  const { speak, playing } = useTTS();
  const [editing, setEditing] = useState(false);
  const [phrase, setPhrase] = useState(chunk.phrase);
  const [meaning, setMeaning] = useState(chunk.meaning);

  // 번역 중... 일 때 스토어에서 뜻이 들어오면 로컬 상태도 업데이트
  useEffect(() => {
    if (meaning === "번역 중..." && chunk.meaning !== "번역 중...") {
      setMeaning(chunk.meaning);
    }
  }, [chunk.meaning]);
  const [sentence, setSentence] = useState(chunk.exampleSentence);

  const save = () => {
    onUpdate(chunk.id, {
      phrase,
      meaning,
      exampleSentence: sentence,
    });
    setEditing(false);
  };

  const cancel = () => {
    setPhrase(chunk.phrase);
    setMeaning(chunk.meaning);
    setSentence(chunk.exampleSentence);
    setEditing(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{
        opacity: 1,
        y: 0,
        scale: isActive ? 1.02 : 1,
      }}
      transition={{ delay: index * 0.05, type: "spring", stiffness: 300, damping: 25 }}
      onMouseEnter={() => onHover?.(chunk.id)}
      onMouseLeave={() => onHover?.(null)}
      className={`rounded-xl border bg-card p-4 transition-shadow ${
        isActive ? "shadow-md ring-2 ring-primary/20" : "shadow-sm"
      }`}
    >
      {editing ? (
        <div className="space-y-3">
          <input
            value={phrase}
            onChange={(e) => setPhrase(e.target.value)}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/30"
            placeholder="영어 표현"
          />
          <input
            value={meaning}
            onChange={(e) => setMeaning(e.target.value)}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            placeholder="한국어 뜻"
          />
          <textarea
            value={sentence}
            onChange={(e) => setSentence(e.target.value)}
            rows={2}
            className="w-full resize-none rounded-lg border bg-background px-3 py-2 font-serif text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary/30"
            placeholder="예문"
          />
          <div className="flex justify-end gap-2">
            <button onClick={cancel} className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary">
              <X className="h-4 w-4" />
            </button>
            <button onClick={save} className="rounded-lg bg-primary p-1.5 text-primary-foreground hover:bg-primary/90">
              <Check className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-1.5">
                <p className="font-medium text-foreground">{chunk.phrase}</p>
                <button
                  onClick={() => speak(chunk.phrase)}
                  className={`rounded p-0.5 transition-colors ${playing === chunk.phrase ? "text-primary" : "text-muted-foreground/40 hover:text-muted-foreground"}`}
                >
                  <Volume2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <p className="text-sm text-muted-foreground">{chunk.meaning}</p>
            </div>
            <div className="flex shrink-0 gap-1">
              <button
                onClick={() => setEditing(true)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => onRemove(chunk.id)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <p className="font-serif text-sm leading-relaxed text-muted-foreground italic">
            "{chunk.exampleSentence}"
          </p>
          {chunk.sourceUrl && (
            <a
              href={chunk.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
            >
              <ExternalLink className="h-3 w-3" />
              출처 보기
            </a>
          )}
        </div>
      )}
    </motion.div>
  );
}
