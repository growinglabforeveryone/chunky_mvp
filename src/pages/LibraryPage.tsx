import { useChunkStore } from "@/store/chunkStore";
import { Search, RotateCcw, ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import { useState } from "react";
import ChunkCard from "@/components/ChunkCard";
import { ChunkStatus } from "@/types/chunk";
import { toast } from "sonner";

type Tab = ChunkStatus;

const TAB_LABELS: Record<Tab, string> = {
  active: "학습 중",
  mastered: "마스터 완료",
  excluded: "제외됨",
};

const PAGE_SIZE = 20;

function AddSituationCardForm({ onClose }: { onClose: () => void }) {
  const { addSituationCard } = useChunkStore();
  const [triggerKo, setTriggerKo] = useState("");
  const [phrase, setPhrase] = useState("");
  const [meaning, setMeaning] = useState("");
  const [example, setExample] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!triggerKo.trim() || !phrase.trim() || !meaning.trim()) {
      toast.error("상황, 표현, 뜻은 필수예요");
      return;
    }
    setSaving(true);
    try {
      await addSituationCard(triggerKo.trim(), phrase.trim(), meaning.trim(), example.trim() || phrase.trim());
      toast.success("상황카드가 추가됐어요");
      onClose();
    } catch {
      toast.error("저장에 실패했어요");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border bg-violet-50/50 p-5 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-violet-700">상황카드 추가</p>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="space-y-2">
        <input
          value={triggerKo}
          onChange={(e) => setTriggerKo(e.target.value)}
          placeholder="상황 (예: 상대 주장을 부분 인정하며 반박하고 싶을 때) *"
          className="w-full rounded-xl border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
        />
        <input
          value={phrase}
          onChange={(e) => setPhrase(e.target.value)}
          placeholder="영어 표현 (예: I wouldn't go as far as to say A, but...) *"
          className="w-full rounded-xl border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
        />
        <input
          value={meaning}
          onChange={(e) => setMeaning(e.target.value)}
          placeholder="뜻 (한국어) *"
          className="w-full rounded-xl border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
        />
        <input
          value={example}
          onChange={(e) => setExample(e.target.value)}
          placeholder="예문 (선택)"
          className="w-full rounded-xl border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
        />
      </div>
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full rounded-xl bg-violet-600 py-2 text-sm font-medium text-white hover:bg-violet-700 transition-colors disabled:opacity-50"
      >
        {saving ? "저장 중..." : "저장"}
      </button>
    </div>
  );
}

export default function LibraryPage() {
  const { savedChunks, updateSavedChunk, removeSavedChunk, restoreChunk } = useChunkStore();
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("active");
  const [page, setPage] = useState(1);
  const [showAddForm, setShowAddForm] = useState(false);

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
      c.meaning.includes(search) ||
      (c.triggerKo ?? "").includes(search)
    );
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-6 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="font-serif text-2xl font-semibold text-foreground">라이브러리</h1>
          <button
            onClick={() => setShowAddForm((v) => !v)}
            className="flex items-center gap-1.5 rounded-xl border bg-card px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            상황카드
          </button>
        </div>

        {showAddForm && (
          <AddSituationCardForm onClose={() => setShowAddForm(false)} />
        )}

        {/* 탭 */}
        <div className="flex gap-1 rounded-xl bg-secondary/50 p-1">
          {(["active", "mastered", "excluded"] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); setPage(1); }}
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
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="표현, 뜻, 상황 검색..."
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
        <>
          <div className="space-y-3">
            {paginated.map((chunk, i) => (
                <div key={chunk.id}>
                  {(() => {
                    const stage = chunk.reviewStage ?? 0;
                    const stageLabel = chunk.mastered
                      ? { text: "완료 ✓", cls: "bg-green-50 border border-green-200 text-green-700" }
                      : stage === 0
                      ? { text: "신규", cls: "bg-blue-50 border border-blue-200 text-blue-700" }
                      : stage === 1
                      ? { text: "1일", cls: "bg-yellow-50 border border-yellow-200 text-yellow-700" }
                      : stage === 2
                      ? { text: "7일", cls: "bg-orange-50 border border-orange-200 text-orange-700" }
                      : { text: "30일", cls: "bg-purple-50 border border-purple-200 text-purple-700" };

                    return (
                      <div className="mb-1.5 flex gap-2 px-1">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${stageLabel.cls}`}>
                          {stageLabel.text}
                        </span>
                        {chunk.cardType === "situation" && (
                          <span className="rounded-full bg-violet-50 border border-violet-200 px-2 py-0.5 text-xs text-violet-600">
                            상황카드
                          </span>
                        )}
                        {chunk.sourceName && (
                          <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                            {chunk.sourceName}
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
                    );
                  })()}
                  {chunk.cardType === "situation" && chunk.triggerKo && (
                    <p className="mb-1 px-1 text-xs text-violet-500">상황: {chunk.triggerKo}</p>
                  )}
                  <ChunkCard
                    chunk={chunk}
                    index={i}
                    onUpdate={updateSavedChunk}
                    onRemove={removeSavedChunk}
                  />
                </div>
              ))}

          </div>

          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-center gap-2">
              <button
                onClick={() => { setPage((p) => Math.max(1, p - 1)); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                disabled={currentPage === 1}
                className="flex h-8 w-8 items-center justify-center rounded-lg border bg-card text-muted-foreground transition-colors hover:bg-secondary disabled:opacity-30"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => { setPage(p); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                  className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm transition-colors ${
                    p === currentPage
                      ? "bg-primary text-primary-foreground font-medium"
                      : "border bg-card text-muted-foreground hover:bg-secondary"
                  }`}
                >
                  {p}
                </button>
              ))}

              <button
                onClick={() => { setPage((p) => Math.min(totalPages, p + 1)); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                disabled={currentPage === totalPages}
                className="flex h-8 w-8 items-center justify-center rounded-lg border bg-card text-muted-foreground transition-colors hover:bg-secondary disabled:opacity-30"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
