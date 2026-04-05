import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useEffect } from "react";
import AppNav from "@/components/AppNav";
import DashboardPage from "@/pages/DashboardPage";
import ExtractPage from "@/pages/ExtractPage";
import SpeakPage from "@/pages/SpeakPage";
import ReviewPage from "@/pages/ReviewPage";
import ListenPage from "@/pages/ListenPage";
import LibraryPage from "@/pages/LibraryPage";
import LandingPage from "@/pages/LandingPage";
import NotFound from "@/pages/NotFound";
import { useChunkStore } from "@/store/chunkStore";
import { useUsageStore } from "@/store/usageStore";
import { useAuth } from "@/hooks/useAuth";

const queryClient = new QueryClient();

function AppContent() {
  const { session, loading } = useAuth();
  const loadSavedChunks = useChunkStore((s) => s.loadSavedChunks);
  const loadUsage = useUsageStore((s) => s.loadUsage);

  useEffect(() => {
    if (session) {
      loadSavedChunks();
      loadUsage();
    }
  }, [session, loadSavedChunks, loadUsage]);

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
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/extract" element={<ExtractPage />} />
        <Route path="/speak" element={<SpeakPage />} />
        <Route path="/listen" element={<ListenPage />} />
        <Route path="/review" element={<ReviewPage />} />
        <Route path="/library" element={<LibraryPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
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
