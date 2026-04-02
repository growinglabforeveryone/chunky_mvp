import { useState, useCallback, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useChunkStore } from "@/store/chunkStore";
import { extractChunks, getMeaning } from "@/lib/claudeExtractor";
import TextReader from "@/components/TextReader";
import ChunkCard from "@/components/ChunkCard";
import { ONBOARDING_KEY } from "@/components/OnboardingWelcome";
import { Plus, Sparkles, Save, Loader2, ChevronDown, X, MousePointerClick, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

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
    setMiniSessionCards,
    scheduleTomorrow,
  } = useChunkStore();

  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [pendingMiniCards, setPendingMiniCards] = useState<{ id: string; phrase: string }[]>([]);
  const [schedulingTomorrow, setSchedulingTomorrow] = useState(false);
  const [hoveredChunkId, setHoveredChunkId] = useState<string | null>(null);
  const [inputText, setInputText] = useState("");
  const [showSource, setShowSource] = useState(false);
  const [customSource, setCustomSource] = useState("");

  // YouTube tab state
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [youtubeTranscript, setYoutubeTranscript] = useState("");
  const [loadingTranscript, setLoadingTranscript] = useState(false);
  const [activeTab, setActiveTab] = useState("text");
  const EXTRACT_TIP_KEY = "chunky_extract_tip_seen";
  const [showExtractTip, setShowExtractTip] = useState(
    () => !localStorage.getItem(EXTRACT_TIP_KEY)
  );
  const [youtubeError, setYoutubeError] = useState<string | null>(null);

  // Accept sample text from onboarding navigation
  useEffect(() => {
    const state = location.state as { sampleText?: string } | null;
    if (state?.sampleText) {
      setInputText(state.sampleText);
      setSourceName("이메일");
      // Clear navigation state to prevent re-fill on back navigation
      window.history.replaceState({}, "");
    }
  }, [location.state, setSourceName]);

  const handleExtract = useCallback(async () => {
    const textToExtract = activeTab === "youtube" ? youtubeTranscript : inputText;
    if (!textToExtract.trim()) return;
    setLoading(true);
    setSourceText(textToExtract);
    try {
      const result = await extractChunks(textToExtract);
      // Attach source info for youtube
      if (activeTab === "youtube") {
        const enriched = result.map((c) => ({
          ...c,
          sourceUrl: youtubeUrl,
          sourceType: "youtube" as const,
        }));
        setChunks(enriched);
      } else {
        setChunks(result);
      }
      toast.success(`${result.length}개의 단어뭉치를 추출했습니다`);
    } catch (err) {
      console.error("Extract error:", err);
      toast.error("추출에 실패했습니다");
    } finally {
      setLoading(false);
    }
  }, [activeTab, inputText, youtubeTranscript, youtubeUrl, setSourceText, setChunks]);

  const handleFetchTranscript = async () => {
    if (!youtubeUrl.trim()) return;
    setLoadingTranscript(true);
    setYoutubeError(null);
    try {
      const res = await fetch("/api/youtube-transcript", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: youtubeUrl }),
      });
      const data = await res.json();
      if (!res.ok) {
        setYoutubeError(data.error || "자막을 가져올 수 없습니다");
        return;
      }
      setYoutubeTranscript(data.transcript);
      toast.success("자막을 불러왔습니다");
    } catch {
      setYoutubeError("자막을 가져올 수 없습니다");
    } finally {
      setLoadingTranscript(false);
    }
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
      localStorage.setItem(ONBOARDING_KEY, "true");
      setInputText("");
      setYoutubeTranscript("");
      setYoutubeUrl("");
      setPendingMiniCards(toCommit);
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

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full">
              <TabsTrigger value="text" className="flex-1">📝 텍스트</TabsTrigger>
              <TabsTrigger value="youtube" className="flex-1">▶️ 유튜브</TabsTrigger>
            </TabsList>

            <TabsContent value="text" className="space-y-4">
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                rows={12}
                placeholder="영어 기사, 이메일, 또는 텍스트를 여기에 붙여넣으세요..."
                className="w-full resize-none rounded-xl border bg-card p-6 font-serif text-lg leading-relaxed shadow-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </TabsContent>

            <TabsContent value="youtube" className="space-y-4">
              <div className="flex gap-2">
                <input
                  value={youtubeUrl}
                  onChange={(e) => { setYoutubeUrl(e.target.value); setYoutubeError(null); }}
                  placeholder="https://youtube.com/watch?v=..."
                  className="flex-1 rounded-xl border bg-card px-4 py-3 text-sm shadow-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <button
                  onClick={handleFetchTranscript}
                  disabled={loadingTranscript || !youtubeUrl.trim()}
                  className="flex shrink-0 items-center gap-2 rounded-xl border bg-card px-4 py-3 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-secondary disabled:opacity-50"
                >
                  {loadingTranscript ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  자막 불러오기
                </button>
              </div>

              {youtubeError && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm dark:border-amber-800 dark:bg-amber-950/30">
                  <p className="font-medium text-amber-800 dark:text-amber-300">자막을 자동으로 가져올 수 없어요</p>
                  <p className="mt-1 text-amber-700 dark:text-amber-400">YouTube가 서버 요청을 차단하고 있습니다. 아래 방법으로 직접 붙여넣기 해주세요.</p>
                  <ol className="mt-2 list-decimal pl-4 text-amber-700 dark:text-amber-400 space-y-1">
                    <li>YouTube에서 영상 하단 <strong>···</strong> 메뉴 클릭</li>
                    <li><strong>스크립트 열기</strong> (Show transcript) 선택</li>
                    <li>전체 텍스트 복사 후 아래에 붙여넣기</li>
                  </ol>
                  {youtubeUrl && (
                    <a
                      href={youtubeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-block text-xs text-amber-600 underline hover:text-amber-800"
                    >
                      영상 열기 →
                    </a>
                  )}
                  <textarea
                    rows={8}
                    placeholder="여기에 자막 텍스트를 붙여넣으세요..."
                    className="mt-3 w-full resize-none rounded-lg border bg-white px-3 py-2 text-sm text-foreground shadow-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 dark:bg-card"
                    onChange={(e) => setYoutubeTranscript(e.target.value)}
                  />
                </div>
              )}

              {!youtubeError && youtubeTranscript && (
                <textarea
                  value={youtubeTranscript}
                  onChange={(e) => setYoutubeTranscript(e.target.value)}
                  rows={12}
                  placeholder="자막이 여기에 표시됩니다..."
                  className="w-full resize-none rounded-xl border bg-card p-6 font-serif text-lg leading-relaxed shadow-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              )}
            </TabsContent>
          </Tabs>

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
            disabled={loading || (activeTab === "text" ? !inputText.trim() : !youtubeTranscript.trim())}
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
        <div className="space-y-4">
          {/* Extract Tips (first time only) */}
          <AnimatePresence>
            {showExtractTip && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                className="relative rounded-xl border border-primary/20 bg-primary/5 px-5 py-4"
              >
                <button
                  aria-label="팁 닫기"
                  onClick={() => {
                    localStorage.setItem(EXTRACT_TIP_KEY, "true");
                    setShowExtractTip(false);
                  }}
                  className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
                <p className="mb-3 text-sm font-medium text-foreground">Tip</p>
                <div className="flex flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:gap-6">
                  <span className="flex items-center gap-2">
                    <MousePointerClick className="h-4 w-4 shrink-0 text-primary" />
                    원문에서 텍스트를 드래그하면 직접 표현을 추가할 수 있어요
                  </span>
                  <span className="flex items-center gap-2">
                    <Trash2 className="h-4 w-4 shrink-0 text-primary" />
                    필요 없는 표현은 카드의 삭제 버튼으로 빼세요
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

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
                  setYoutubeTranscript("");
                  setYoutubeUrl("");
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
        </div>
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
                  ✨ {pendingMiniCards.length}개 저장 완료!
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
