import { useChunkStore } from "@/store/chunkStore";
import { Search } from "lucide-react";
import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import ChunkCard from "@/components/ChunkCard";

export default function LibraryPage() {
  const { savedChunks, updateSavedChunk, removeSavedChunk } = useChunkStore();
  const [search, setSearch] = useState("");

  const filtered = savedChunks.filter(
    (c) =>
      c.phrase.toLowerCase().includes(search.toLowerCase()) ||
      c.meaning.includes(search)
  );

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-6 space-y-4">
        <h1 className="font-serif text-2xl font-semibold text-foreground">
          라이브러리
        </h1>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="표현 또는 뜻 검색..."
            className="w-full rounded-xl border bg-card py-2.5 pl-10 pr-4 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <p className="text-muted-foreground">
            {savedChunks.length === 0
              ? "저장된 단어뭉치가 없습니다"
              : "검색 결과가 없습니다"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {filtered.map((chunk, i) => (
              <div key={chunk.id}>
                {(chunk.sourceName || chunk.mastered) && (
                  <div className="mb-1.5 flex gap-2 px-1">
                    {chunk.sourceName && (
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                        {chunk.sourceName}
                      </span>
                    )}
                    {chunk.mastered && (
                      <span className="rounded-full bg-green-50 border border-green-200 px-2 py-0.5 text-xs text-green-700">
                        완료 ✓
                      </span>
                    )}
                  </div>
                )}
                <ChunkCard
                  chunk={chunk}
                  index={i}
                  onUpdate={updateSavedChunk}
                  onRemove={removeSavedChunk}
                />
              </div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
