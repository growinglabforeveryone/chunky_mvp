import { BookOpen, Home, Layers, Library, LogOut, MessageCircle, MessageSquarePlus, PenLine } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import FeedbackModal from "@/components/FeedbackModal";

const navItems = [
  { to: "/", label: "홈", icon: Home },
  { to: "/extract", label: "추출", icon: Layers },
  { to: "/speak", label: "말하기", icon: MessageCircle },
  { to: "/review", label: "복습", icon: BookOpen },
  { to: "/write", label: "쓰기", icon: PenLine },
  { to: "/library", label: "라이브러리", icon: Library },
];

export default function AppNav() {
  const { pathname } = useLocation();
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <>
      {/* ── 데스크톱 상단 바 (sm 이상에서만 표시) ── */}
      <header className="sticky top-0 z-50 hidden border-b bg-card/80 backdrop-blur-sm sm:block">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-lg text-foreground" style={{ fontFamily: "'Nunito', sans-serif", fontWeight: 800, letterSpacing: '-0.5px' }}>
              Chunky
            </span>
          </Link>

          <div className="flex items-center gap-1">
            <nav className="flex items-center gap-1">
              {navItems.map(({ to, label, icon: Icon }) => {
                const active = pathname === to;
                return (
                  <Link
                    key={to}
                    to={to}
                    className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm transition-colors ${
                      active
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{label}</span>
                  </Link>
                );
              })}
            </nav>

            <button
              onClick={() => setFeedbackOpen(true)}
              className="ml-1 rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              title="피드백"
            >
              <MessageSquarePlus className="h-4 w-4" />
            </button>

            <button
              onClick={handleLogout}
              className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              title="로그아웃"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* ── 모바일 상단 바 (sm 미만에서만 표시, /write 제외) ── */}
      <header className={`sticky top-0 z-50 h-12 items-center justify-between border-b bg-card/80 px-4 backdrop-blur-sm sm:hidden ${pathname === "/write" ? "hidden" : "flex"}`}>
        <Link to="/" className="flex items-center gap-2">
          <span className="text-base text-foreground" style={{ fontFamily: "'Nunito', sans-serif", fontWeight: 800, letterSpacing: '-0.5px' }}>
            Chunky
          </span>
        </Link>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setFeedbackOpen(true)}
            className="rounded-lg p-2 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            title="피드백"
          >
            <MessageSquarePlus className="h-4 w-4" />
          </button>
          <button
            onClick={handleLogout}
            className="rounded-lg p-2 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            title="로그아웃"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* ── 모바일 하단 탭바 (sm 미만에서만 표시) ── */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-card/95 backdrop-blur-sm sm:hidden">
        <div className="flex items-stretch">
          {navItems.map(({ to, label, icon: Icon }) => {
            const active = pathname === to;
            return (
              <Link
                key={to}
                to={to}
                className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-2.5 text-[10px] transition-colors ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <Icon className={`h-5 w-5 ${active ? "stroke-[2.5]" : "stroke-[1.5]"}`} />
                <span className={active ? "font-semibold" : ""}>{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      <FeedbackModal open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </>
  );
}
