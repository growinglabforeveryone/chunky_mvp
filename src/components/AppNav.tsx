import { BookOpen, Home, Layers, Library, LogOut, MessageCircle, MessageSquarePlus } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import FeedbackModal from "@/components/FeedbackModal";

const navItems = [
  { to: "/", label: "홈", icon: Home },
  { to: "/extract", label: "읽기", icon: Layers },
  { to: "/speak", label: "말하기", icon: MessageCircle },
  { to: "/review", label: "복습", icon: BookOpen },
  { to: "/library", label: "라이브러리", icon: Library },
];

export default function AppNav() {
  const { pathname } = useLocation();
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <header className="sticky top-0 z-50 border-b bg-card/80 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
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
                  <span className="hidden sm:inline">{label}</span>
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

      <FeedbackModal open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </header>
  );
}
