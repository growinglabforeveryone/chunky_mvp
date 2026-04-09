import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useEffect } from "react";
import { toast } from "sonner";
import AppNav from "@/components/AppNav";
import DashboardPage from "@/pages/DashboardPage";
import ExtractPage from "@/pages/ExtractPage";
import SpeakPage from "@/pages/SpeakPage";
import ReviewPage from "@/pages/ReviewPage";
import ListenPage from "@/pages/ListenPage";
import LibraryPage from "@/pages/LibraryPage";
import WritePracticePage from "@/pages/WritePracticePage";
import LandingPage from "@/pages/LandingPage";
import NotFound from "@/pages/NotFound";
import { useChunkStore } from "@/store/chunkStore";
import { useUsageStore } from "@/store/usageStore";
import { useLevelStore } from "@/store/levelStore";
import { useAuth } from "@/hooks/useAuth";

const queryClient = new QueryClient();

function AppContent() {
  const { session, loading } = useAuth();
  const loadSavedChunks = useChunkStore((s) => s.loadSavedChunks);
  const loadUsage = useUsageStore((s) => s.loadUsage);
  const loadXP = useLevelStore((s) => s.loadXP);
  const { lastLevelUp, clearLevelUp } = useLevelStore();

  useEffect(() => {
    if (session) {
      loadSavedChunks();
      loadUsage();
      loadXP();
    }
  }, [session, loadSavedChunks, loadUsage, loadXP]);

  // 어느 페이지에서든 레벨업 즉시 토스트
  useEffect(() => {
    if (lastLevelUp) {
      toast.success(`Lv.${lastLevelUp} 달성!`, {
        description: "청키가 한 단계 성장했어요 🎉",
        duration: 4000,
      });
      clearLevelUp();
    }
  }, [lastLevelUp, clearLevelUp]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">로딩 중...</p>
      </div>
    );
  }

  if (!session) {
    return <LandingPage />;
  }

  return (
    <>
      <AppNav />
      <main className="pb-[60px] sm:pb-0">
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/extract" element={<ExtractPage />} />
        <Route path="/speak" element={<SpeakPage />} />
        <Route path="/listen" element={<ListenPage />} />
        <Route path="/review" element={<ReviewPage />} />
        <Route path="/write" element={<WritePracticePage />} />
        <Route path="/library" element={<LibraryPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      </main>
    </>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner />
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
