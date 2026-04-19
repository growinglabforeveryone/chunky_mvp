import { useState, useCallback, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useChunkStore, VocabLimitError } from "@/store/chunkStore";
import { useUsageStore, FREE_AI_LIMIT } from "@/store/usageStore";
import { extractChunks, getMeaning, generateExampleKo, MonthlyLimitError } from "@/lib/claudeExtractor";
import UpgradeModal from "@/components/UpgradeModal";
import TextReader from "@/components/TextReader";
import ChunkCard from "@/components/ChunkCard";
import { ONBOARDING_KEY } from "@/components/OnboardingWelcome";
import { Plus, Sparkles, Save, Loader2, ChevronDown, X, MousePointerClick, Trash2, Pencil } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

const ONBOARDING_SAMPLE_CHUNKS = [
  {
    id: "onb-1",
    phrase: "heads-up",
    meaning: "미리 알림, 사전 공지",
    exampleSentence: "Just a quick heads-up — the deadline has been moved up to Friday.",
    exampleKo: "미리 알려드릴게요 — 마감일이 금요일로 앞당겨졌어요.",
  },
  {
    id: "onb-2",
    phrase: "move up",
    meaning: "(일정을) 앞당기다",
    exampleSentence: "The meeting has been moved up to 2 PM.",
    exampleKo: "회의가 오후 2시로 앞당겨졌어요.",
  },
  {
    id: "onb-3",
    phrase: "wrap things up",
    meaning: "마무리 짓다, 끝내다",
    exampleSentence: "Let's try to wrap things up by end of day Thursday.",
    exampleKo: "목요일 퇴근 전까지 마무리해봐요.",
  },
  {
    id: "onb-4",
    phrase: "reach out",
    meaning: "연락하다, 도움을 요청하다",
    exampleSentence: "Feel free to reach out if you have any questions.",
    exampleKo: "질문 있으면 편하게 연락해요.",
  },
  {
    id: "onb-5",
    phrase: "need a hand",
    meaning: "도움이 필요하다",
    exampleSentence: "Let me know if you need a hand with anything.",
    exampleKo: "뭐든 도움이 필요하면 말해줘요.",
  },
  {
    id: "onb-6",
    phrase: "key takeaways",
    meaning: "핵심 내용, 주요 요점",
    exampleSentence: "I'd like to go over the key takeaways from last week's meeting.",
    exampleKo: "지난주 회의의 핵심 내용을 같이 정리해보려고요.",
  },
  {
    id: "onb-7",
    phrase: "stay on top of",
    meaning: "(일을) 빠짐없이 잘 챙기다",
    exampleSentence: "Thanks for staying on top of this!",
    exampleKo: "잘 챙겨줘서 고마워요!",
  },
];

// YouTube 자막 타임스탬프 제거
// 포맷 1: "20:1820분 18초Text" (한국어 분+초)
// 포맷 2: "0:00 Text" (줄 시작 mm:ss)
// 포맷 3: "8초From" (초만 있는 타임스탬프)
// 포맷 4: "[music]" (소리 큐 브라켓)
function stripYouTubeTimestamps(text: string): string {
  let cleaned = text.replace(/\d+:\d{2,3}\d+분\s*\d+초\s*/g, " ");
  cleaned = cleaned.replace(/^\d+:\d{2}(?::\d{2})?\s*/gm, "");
  cleaned = cleaned.replace(/\d+초\s*/g, " ");
  cleaned = cleaned.replace(/\[.*?\]/g, "");
  return cleaned.replace(/\s{2,}/g, " ").replace(/\n/g, " ").trim();
}

function hasTimestamps(text: string): boolean {
  return /\d+:\d{2}\d+분\s*\d+초/.test(text)
    || /^\d+:\d{2}/m.test(text)
    || /\d+초/.test(text);
}

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

  const { tier, usedThisMonth, canUseAI, incrementUsage } = useUsageStore();

  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [upgradeModal, setUpgradeModal] = useState<{ reason: "ai_limit" | "vocab_limit"; used?: number; limit?: number } | null>(null);
  const [pendingMiniCards, setPendingMiniCards] = useState<{ id: string; phrase: string }[]>([]);
  const [schedulingTomorrow, setSchedulingTomorrow] = useState(false);
  const [hoveredChunkId, setHoveredChunkId] = useState<string | null>(null);
  const [inputText, setInputText] = useState("");
  const [showSource, setShowSource] = useState(false);
  const [customSource, setCustomSource] = useState("");

  const { tipSeen, markTipSeen } = useUsageStore();

  // Accept sample text from onboarding navigation
  useEffect(() => {
    const state = location.state as { sampleText?: string; isOnboarding?: boolean } | null;
    if (state?.sampleText) {
      setInputText(state.sampleText);
      setSourceName("이메일");
      window.history.replaceState({}, "");

      if (state.isOnboarding) {
        const now = new Date().toISOString();
        setSourceText(state.sampleText);
        setChunks(ONBOARDING_SAMPLE_CHUNKS.map((c) => ({ ...c, createdAt: now })));
      }
    }
  }, [location.state, setSourceName, setSourceText, setChunks]);

  const handleExtract = useCallback(async () => {
    if (!inputText.trim()) return;
    setLoading(true);
    setSourceText(inputText);
    try {
      const result = await extractChunks(inputText);
      incrementUsage();
      setChunks(result);
      toast.success(`${result.length}개의 단어뭉치를 추출했습니다`);
    } catch (err) {
      if (err instanceof MonthlyLimitError) {
        setUpgradeModal({ reason: "ai_limit", used: err.used, limit: err.limit });
        return;
      }
      console.error("Extract error:", err);
      const msg = err instanceof Error ? err.message : "추출에 실패했습니다";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [inputText, setSourceText, setChunks, incrementUsage]);

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
      setPendingMiniCards(toCommit);
    } catch (err) {
      if (err instanceof VocabLimitError) {
        setUpgradeModal({ reason: "vocab_limit", used: err.current, limit: err.limit });
        return;
      }
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
            onPaste={(e) => {
              const pasted = e.clipboardData.getData("text");
              if (hasTimestamps(pasted)) {
                e.preventDefault();
                const cleaned = stripYouTubeTimestamps(pasted);
                setInputText(cleaned);
                toast.success("유튜브 타임스탬프를 자동으로 제거했어요");
              }
            }}
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

          <div className="space-y-2">
            <button
              onClick={!canUseAI() ? () => setUpgradeModal({ reason: "ai_limit", used: usedThisMonth, limit: FREE_AI_LIMIT }) : handleExtract}
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
            {tier === "free" && (
              <p className="text-center text-xs text-muted-foreground">
                이번 달 {usedThisMonth}/{FREE_AI_LIMIT}회 사용
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Extract Tips (first time only, per user) */}
          <AnimatePresence>
            {!tipSeen && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                className="relative rounded-xl border border-primary/20 bg-primary/5 px-5 py-4"
              >
                <button
                  aria-label="팁 닫기"
                  onClick={() => markTipSeen()}
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
                    <Pencil className="h-4 w-4 shrink-0 text-primary" />
                    뽑힌 단어뭉치는 카드에서 직접 수정할 수 있어요
                  </span>
                  <span className="flex items-center gap-2">
                    <Trash2 className="h-4 w-4 shrink-0 text-primary" />
                    필요 없는 표현은 삭제 버튼으로 빼세요
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex flex-col gap-6 md:flex-row">
          {/* Left: Reader */}
          <div className="space-y-4 md:flex-[3]">
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
                    // meaning 확정 후 순차적으로 한국어 예문 생성
                    if (meaning && sentence) {
                      generateExampleKo(sentence, phrase, meaning).then((exampleKo) => {
                        if (exampleKo) updateChunk(id, { exampleKo });
                      });
                    }
                  });
                }}
              />
            </div>
          </div>

          {/* Right: Inspector */}
          <div className="space-y-4 md:flex-[2]">
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
