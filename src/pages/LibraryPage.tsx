import { useChunkStore } from "@/store/chunkStore";
import { Search, RotateCcw } from "lucide-react";
import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import ChunkCard from "@/components/ChunkCard";
import { ChunkStatus } from "@/types/chunk";

type Tab = ChunkStatus;

const TAB_LABELS: Record<Tab, string> = {
  active: "학습 중",
  mastered: "마스터 완료",
  excluded: "제외됨",
};

export default function LibraryPage() {
  const { savedChunks, updateSavedChunk, removeSavedChunk, restoreChunk } = useChunkStore();
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("active");

  const counts: Record<Tab, number> = {
    active: savedChunks.filter((c) => (c.status ?? "active") === "active").length,
    mastered: savedChunks.filter((c) => (c.status ?? "active") === "mastered").length,
    excluded: savedChunks.filter((c) => (c.status ?? "active") === "excluded").length,
  };

  const filtered = savedChunks.filter((c) => {
    const status = c.status ?? "active";
    if (status !== activeTab) return false;
    if (!search) return true;
    return (
      c.phrase.toLowerCase().includes(search.toLowerCase()) ||
      c.meaning.includes(search)
    );
  });

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-6 space-y-4">
        <h1 className="font-serif text-2xl font-semibold text-foreground">라이브러리</h1>

        {/* 탭 */}
        <div className="flex gap-1 rounded-xl bg-secondary/50 p-1">
          {(["active", "mastered", "excluded"] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 rounded-lg py-1.5 text-sm transition-colors ${
                activeTab === tab
                  ? "bg-card shadow-sm font-medium text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {TAB_LABELS[tab]}
              {counts[tab] > 0 && (
                <span className={`ml-1.5 tabular-nums text-xs ${activeTab === tab ? "text-primary" : "text-muted-foreground/60"}`}>
                  {counts[tab]}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* 검색 */}
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
          <p className="text-muted-foreground text-sm">
            {savedChunks.filter((c) => (c.status ?? "active") === activeTab).length === 0
              ? activeTab === "active"
                ? "학습 중인 단어뭉치가 없습니다"
                : activeTab === "mastered"
                ? "마스터 완료된 단어뭉치가 없습니다"
                : "제외된 단어뭉치가 없습니다"
              : "검색 결과가 없습니다"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {filtered.map((chunk, i) => (
              <div key={chunk.id}>
                {/* 메타 태그 */}
                {(chunk.sourceName || chunk.mastered || activeTab === "excluded") && (
                  <div className="mb-1.5 flex gap-2 px-1">
                    {chunk.sourceName && (
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                        {chunk.sourceName}
                      </span>
                    )}
                    {chunk.mastered && (
                      <span className="rounded-full bg-green-50 border border-green-200 px-2 py-0.5 text-xs text-green-700">
                        마스터 완료 ✓
                      </span>
                    )}
                    {activeTab === "excluded" && (
                      <button
                        onClick={() => restoreChunk(chunk.id)}
                        className="flex items-center gap-1 rounded-full bg-secondary border px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors"
                      >
                        <RotateCcw className="h-3 w-3" />
                        다시 복습하기
                      </button>
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
