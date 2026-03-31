import { supabase } from "@/lib/supabaseClient";

export default function LoginPage() {
  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30">
      <div className="text-center space-y-8">
        <div className="flex flex-col items-center">
          <img src="/slimes/happy.svg" alt="Chunky 슬라임" className="h-24 w-24" />
          <div className="mt-1 h-2 w-10 rounded-full bg-foreground/5 blur-sm" />
          <h1
            className="mt-3 text-3xl text-foreground"
            style={{ fontFamily: "'Nunito', sans-serif", fontWeight: 800, letterSpacing: '-0.5px' }}
          >
            Chunky
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">영어 단어뭉치 학습 앱</p>
        </div>

        <button
          onClick={handleGoogleLogin}
          className="flex items-center justify-center gap-3 rounded-xl border bg-card px-6 py-3 text-sm font-medium shadow-sm hover:bg-secondary transition-colors"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66 2.84z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Google로 로그인
        </button>
      </div>
    </div>
  );
}
