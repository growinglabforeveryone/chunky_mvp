import { supabase } from "@/lib/supabaseClient";
import { BookOpen, Brain, Layers, Sparkles } from "lucide-react";

export default function LandingPage() {
  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* NAV */}
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <img src="/chunky/lv1.png" alt="Chunky" className="h-7 w-7 object-contain" />
            <span className="text-lg text-foreground" style={{ fontFamily: "'Nunito', sans-serif", fontWeight: 800, letterSpacing: "-0.5px" }}>
              Chunky
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">베타</span>
            <button
              onClick={handleGoogleLogin}
              className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              베타 참여하기
            </button>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="mx-auto max-w-5xl px-4 pb-16 pt-20 sm:px-6 sm:pt-28">
        <div className="flex flex-col items-center gap-10 lg:flex-row lg:gap-16">
          {/* Text */}
          <div className="flex-1 text-center lg:text-left">
            <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-700">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
              베타 오픈 · 3개월 무제한 체험
            </div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border bg-accent/50 px-3 py-1.5 text-xs font-medium text-accent-foreground">
              <Sparkles className="h-3.5 w-3.5" />
              Lexical Chunks + 에빙하우스 복습법
            </div>
            <h1 className="text-4xl font-bold leading-tight tracking-tight text-foreground sm:text-5xl lg:text-[3.25rem]">
              읽고, 듣고, 말하는 영어가<br />
              <span className="text-primary">나만의 단어장</span>이 된다
            </h1>
            <p className="mt-5 text-base sm:text-lg leading-relaxed text-muted-foreground break-keep">
              이메일, 회의, 영어 수업, 유튜브 —<br />
              AI가 핵심 표현을 뽑고, 잊기 전에 복습시켜 드립니다.
            </p>
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row lg:justify-start">
              <button
                onClick={handleGoogleLogin}
                className="flex w-full items-center justify-center gap-3 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 sm:w-auto"
              >
                <GoogleIcon />
                Google로 베타 참여하기
              </button>
            </div>
          </div>

          {/* Hero mockup */}
          <div className="w-full max-w-sm flex-shrink-0 lg:max-w-[340px]">
            <HeroMockup />
          </div>
        </div>
      </section>

      {/* TRUST BADGES */}
      <section className="border-y bg-muted/40">
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:flex-wrap sm:justify-center sm:gap-10">
            <TrustBadge icon="📈" label="과학 기반 복습" sub="잊기 직전 타이밍에 자동 복습" />
            <div className="hidden h-8 w-px bg-border sm:block" />
            <TrustBadge icon="💬" label="단어뭉치 학습법" sub="2~4단어 덩어리 = 실전 영어의 핵심" />
            <div className="hidden h-8 w-px bg-border sm:block" />
            <TrustBadge icon="⚡" label="AI 3초 추출" sub="텍스트에서 핵심 표현만 골라냄" />
          </div>
        </div>
      </section>

      {/* INPUT METHODS — 읽기 + 듣기 메인 */}
      <section className="mx-auto max-w-5xl px-4 py-20 sm:px-6">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            어떤 영어든, 내 단어장으로
          </h2>
          <p className="mt-3 text-sm text-muted-foreground break-keep">이메일, 기사, 유튜브 자막 —<br className="sm:hidden" /> 붙여넣으면 AI가 단어뭉치를 자동 추출합니다</p>
        </div>

        <div className="grid gap-8 md:grid-cols-2">
          <StepCard
            step="읽기"
            title="텍스트 붙여넣기"
            desc="이메일, 기사, 영어 수업 교재, 회의 스크립트 — 붙여넣으면 AI가 단어뭉치를 자동 추출합니다"
            mockup={<ExtractMockup />}
          />
          <StepCard
            step="유튜브"
            title="유튜브 자막 붙여넣기"
            desc="유튜브 자막을 복사해서 붙여넣으면 타임스탬프를 자동 제거하고 단어뭉치를 추출합니다"
            mockup={<YoutubeMockup />}
          />
        </div>

        {/* 말하기 — 보조 기능 소개 */}
        <div className="mt-12 rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:gap-10">
            <div className="flex-1">
              <div className="mb-2 inline-flex items-center gap-1.5 text-xs font-bold tracking-widest text-primary/60">
                <span>+</span> 말하기
              </div>
              <h3 className="text-lg font-semibold">영어로 써보면, 교정과 추출을 한 번에</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                영어 문장을 직접 써보면 AI가 교정해주고, 교정된 문장에서 단어뭉치를 바로 추출할 수 있습니다.
                내가 틀렸던 표현에서 뽑은 청키라 기억에 더 오래 남습니다.
              </p>
            </div>
            <div className="w-full max-w-sm flex-shrink-0">
              <div className="overflow-hidden rounded-xl border bg-muted/40">
                <SpeakMockup />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* AFTER EXTRACTION: REVIEW FLOW */}
      <section className="bg-muted/30 py-20">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              뽑은 표현, 잊기 전에 복습
            </h2>
            <p className="mt-3 text-sm text-muted-foreground break-keep">
              AI가 2~4개 단위 표현을 원문 예문과 함께 저장하고,<br className="sm:hidden" /> 에빙하우스 곡선에 맞춰 복습시켜 드립니다
            </p>
          </div>
          <div className="grid gap-8 md:grid-cols-2">
            <div className="rounded-2xl border bg-card p-6 shadow-sm">
              <div className="text-xs font-bold tracking-widest text-primary/60 mb-4">추출 결과</div>
              <div className="h-[180px] overflow-hidden rounded-xl border bg-muted/40 flex flex-col justify-center">
                <ChunksMockup />
              </div>
              <p className="mt-4 text-sm text-muted-foreground">원하는 표현만 저장하거나, 드래그로 직접 선택할 수도 있어요</p>
            </div>
            <div className="rounded-2xl border bg-card p-6 shadow-sm">
              <div className="text-xs font-bold tracking-widest text-primary/60 mb-4">복습 스케줄</div>
              <div className="h-[180px] overflow-hidden rounded-xl border bg-muted/40 flex flex-col justify-center">
                <ReviewMockup />
              </div>
              <p className="mt-4 text-sm text-muted-foreground">망각 직전 타이밍에 자동 복습. 30일이면 장기기억으로 전환됩니다</p>
            </div>
          </div>
        </div>
      </section>

      {/* WHY MY CONTENT */}
      <section className="py-20">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              왜 내 콘텐츠여야 할까요?
            </h2>
            <p className="mt-3 text-sm text-muted-foreground break-keep">
              같은 단어도, 내가 읽은 문장에서 만났을 때 기억에 남습니다
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="flex">
              <div className="flex-1 rounded-2xl border bg-card p-6 shadow-sm">
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
                  <Brain className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-semibold">맥락이 기억을 만든다</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  회의에서 들은 "reach out to the team" — 그 장면과 함께 뇌에 저장됩니다.
                  다음 회의에서 같은 상황이 오면, 표현이 자동으로 떠오릅니다.
                </p>
                <div className="mt-4 border-t pt-4">
                  <p className="text-xs leading-relaxed text-muted-foreground/70">
                    Craik & Lockhart의 전이 적합성 처리 이론 — 학습 맥락과 사용 맥락이 일치할수록 실제로 쓰게 됩니다.
                  </p>
                </div>
              </div>
            </div>
            <div className="flex">
              <div className="flex-1 rounded-2xl border bg-card p-6 shadow-sm">
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
                  <BookOpen className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-semibold">내 수준에 맞는 표현만 남는다</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  남이 만든 단어장에는 이미 아는 표현과 절대 안 쓸 표현이 섞여 있습니다.
                  내가 고른 콘텐츠에서 뽑으면, 모르는 것만 정확히 채울 수 있습니다.
                </p>
                <div className="mt-4 border-t pt-4">
                  <p className="text-xs leading-relaxed text-muted-foreground/70">
                    Krashen의 Input Hypothesis — 현재 수준보다 살짝 높은 인풋(i+1)이 습득의 핵심입니다.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* WHY CHUNKS */}
      <section className="py-20">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              왜 단어 1개가 아닌 단어뭉치일까요?
            </h2>
            <p className="mt-3 text-sm text-muted-foreground break-keep">
              언어학자들이 수십 년간 연구해 찾아낸 답입니다
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-3">
            <WhyCard
              icon={<Layers className="h-5 w-5 text-primary" />}
              title='"reach"만 알면 부족합니다'
              desc={`"I'll reach out to the team before Friday" — 이 문장을 자연스럽게 말하려면 단어 하나가 아닌 덩어리째 익혀야 합니다.\n\nMichael Lewis (1993): 영어는 단어가 아닌 청크(chunk) 단위로 뇌에 저장됩니다.`}
            />
            <WhyCard
              icon={<Brain className="h-5 w-5 text-primary" />}
              title="덩어리로 배워야 즉시 나온다"
              desc={`"move forward with", "in terms of", "reach out to" —\n\n이 표현들을 뭉치째 익히면 스피킹 시 단어를 조합하는 과정 없이 바로 나옵니다. 외국어 고수들이 공통적으로 쓰는 방식입니다.`}
            />
            <WhyCard
              icon={<BookOpen className="h-5 w-5 text-primary" />}
              title="2~4개 단어가 가장 효과적"
              desc={`너무 짧으면 조합이 안 되고, 너무 길면 기계적 암기가 됩니다.\n\nChunky는 2~4개 단어로 구성된 표현 단위를 자동으로 추출합니다. 외우기 쉽고, 다양한 문장에 바로 응용할 수 있는 크기입니다.`}
            />
          </div>
        </div>
      </section>

      {/* COMPARISON */}
      <section className="bg-muted/30 py-20">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">다른 방법과 뭐가 다른가요?</h2>
          </div>
          <div className="overflow-x-auto rounded-2xl border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="p-4 text-left font-medium text-muted-foreground"></th>
                  <th className="p-4 text-center font-medium text-muted-foreground">타 단어장 앱</th>
                  <th className="p-4 text-center font-semibold text-primary">
                    <span className="flex items-center justify-center gap-1.5">
                      <img src="/chunky/crown.png" alt="" className="h-5 w-5 object-contain" />
                      Chunky
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["학습 소재", "남이 만든 단어장", "내가 고른 콘텐츠"],
                  ["단어뭉치 학습", "❌", "✅"],
                  ["AI 자동 추출", "❌", "✅"],
                  ["에빙하우스 복습", "일부 지원", "✅"],
                  ["비용", "무료~유료", "베타 3개월 무제한"],
                ].map(([feature, others, chunky]) => (
                  <tr key={feature} className="border-b last:border-0 hover:bg-muted/20">
                    <td className="p-4 font-medium">{feature}</td>
                    <td className="p-4 text-center text-muted-foreground">{others}</td>
                    <td className="p-4 text-center font-medium text-primary">{chunky}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="bg-primary py-20">
        <div className="mx-auto max-w-2xl px-4 text-center sm:px-6">
          <img
            src="/chunky/crown.png"
            alt="Chunky Crown"
            className="mx-auto mb-4 h-16 w-16 object-contain"
          />
          <div className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1.5 text-xs font-semibold text-white">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-300 animate-pulse" />
            베타 오픈 중
          </div>
          <h2 className="text-3xl font-bold text-white sm:text-4xl">
            지금 읽은 이 문장도<br />단어뭉치가 될 수 있습니다
          </h2>
          <p className="mt-4 text-primary-foreground/80">
            베타 참여하면 3개월 무제한 체험 — 오늘 본 영어 콘텐츠부터 시작하세요.
          </p>
          <button
            onClick={handleGoogleLogin}
            className="mt-8 inline-flex items-center gap-3 rounded-xl bg-white px-8 py-3.5 text-sm font-semibold text-primary shadow-md transition-all hover:bg-white/90"
          >
            <GoogleIcon />
            Google로 베타 참여하기
          </button>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t py-8">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div className="flex items-center gap-2">
              <img src="/chunky/lv1.png" alt="Chunky" className="h-5 w-5 object-contain" />
              <span className="text-sm font-bold" style={{ fontFamily: "'Nunito', sans-serif" }}>Chunky</span>
            </div>
            <p className="text-xs text-muted-foreground">© 2026 Chunky. 영어 단어뭉치 학습 앱.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ── Sub-components ── */

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66 2.84z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

function TrustBadge({ icon, label, sub }: { icon: string; label: string; sub: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="text-xl">{icon}</span>
      <div>
        <p className="text-sm font-semibold">{label}</p>
        <p className="text-xs text-muted-foreground">{sub}</p>
      </div>
    </div>
  );
}

function StepCard({ step, title, desc, mockup, comingSoon, comingSoonLabel }: { step: string; title: string; desc: string; mockup: React.ReactNode; comingSoon?: boolean; comingSoonLabel?: string }) {
  return (
    <div className={`relative flex flex-col gap-4 rounded-2xl border bg-card p-6 shadow-sm ${comingSoon ? "opacity-80" : ""}`}>
      <div className="flex items-center gap-2">
        <div className="text-xs font-bold tracking-widest text-primary/60">{step}</div>
        {comingSoon && (
          <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold text-accent-foreground">{comingSoonLabel || "Coming Soon"}</span>
        )}
      </div>
      <div className="h-[200px] overflow-hidden rounded-xl border bg-muted/40 flex flex-col justify-center">
        {mockup}
      </div>
      <div>
        <h3 className="font-semibold">{title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
      </div>
    </div>
  );
}

function WhyCard({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex-1 rounded-2xl border bg-card p-6 shadow-sm">
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
        {icon}
      </div>
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground whitespace-pre-line">{desc}</p>
    </div>
  );
}

/* ── Mockup UI Components ── */

function HeroMockup() {
  return (
    <div className="relative">
      <div className="relative overflow-hidden rounded-[2rem] border-4 border-foreground/10 bg-background shadow-2xl">
        {/* App nav */}
        <div className="flex items-center justify-between border-b bg-card px-4 py-3">
          <span className="text-xs font-extrabold" style={{ fontFamily: "'Nunito', sans-serif" }}>Chunky</span>
          <div className="flex gap-2 text-[10px] text-muted-foreground">
            <span>읽기</span><span>말하기</span><span className="text-primary font-medium">복습</span><span>라이브러리</span>
          </div>
        </div>
        {/* Content */}
        <div className="space-y-2 p-4">
          <p className="text-[10px] font-medium text-muted-foreground">오늘의 복습 · 3개</p>
          <div className="rounded-xl border bg-card p-4 shadow-sm">
            <div className="mb-2 flex items-center justify-between">
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">단어뭉치</span>
              <span className="text-[10px] text-muted-foreground">1/3</span>
            </div>
            <p className="text-sm font-semibold">reach out to</p>
            <p className="mt-1 text-[11px] text-muted-foreground">연락하다, 접근하다</p>
            <p className="mt-2 rounded-lg bg-muted/50 px-3 py-2 text-[10px] italic text-muted-foreground">
              "Let me reach out to the team about this."
            </p>
          </div>
          <div className="flex gap-2">
            <button className="flex-1 rounded-lg border py-2 text-[10px] font-medium text-muted-foreground">몰랐어요</button>
            <button className="flex-1 rounded-lg bg-primary py-2 text-[10px] font-medium text-primary-foreground">알았어요</button>
          </div>
          <div className="flex gap-2 pt-1">
            <div className="flex-1 rounded-lg bg-muted/50 p-2 text-center">
              <p className="text-xs font-bold text-foreground">12</p>
              <p className="text-[9px] text-muted-foreground">마스터</p>
            </div>
            <div className="flex-1 rounded-lg bg-muted/50 p-2 text-center">
              <p className="text-xs font-bold text-foreground">3</p>
              <p className="text-[9px] text-muted-foreground">복습 대기</p>
            </div>
            <div className="flex-1 rounded-lg bg-muted/50 p-2 text-center">
              <p className="text-xs font-bold text-foreground">5일</p>
              <p className="text-[9px] text-muted-foreground">스트릭</p>
            </div>
          </div>
        </div>
      </div>
      <img
        src="/chunky/crown.png"
        alt=""
        className="absolute -right-4 -top-4 h-14 w-14 object-contain drop-shadow-lg"
      />
    </div>
  );
}

function ExtractMockup() {
  return (
    <div className="p-4 space-y-2">
      <div className="flex gap-1.5 flex-wrap">
        {["이메일", "기사", "교재", "회의"].map((label) => (
          <span key={label} className="rounded-full bg-primary/10 px-2 py-0.5 text-[9px] font-medium text-primary">{label}</span>
        ))}
      </div>
      <div className="rounded-lg border bg-background p-3 text-[10px] leading-relaxed text-muted-foreground">
        "Please{" "}
        <span className="bg-yellow-100 text-yellow-800 rounded px-0.5">follow up with</span>{" "}
        the client. We need to{" "}
        <span className="bg-yellow-100 text-yellow-800 rounded px-0.5">move forward with</span>{" "}
        the proposal by Friday."
      </div>
      <button className="w-full rounded-lg bg-primary py-2 text-[10px] font-semibold text-primary-foreground">
        ✨ AI로 단어뭉치 추출
      </button>
    </div>
  );
}

function ChunksMockup() {
  const chunks = ["reach out to", "move forward with", "in terms of"];
  return (
    <div className="p-4 space-y-2.5">
      <p className="text-[10px] font-medium text-muted-foreground">추출된 단어뭉치 3개</p>
      {chunks.map((c) => (
        <div key={c} className="flex items-center justify-between rounded-lg border bg-background px-3 py-2.5">
          <span className="text-[11px] font-medium">{c}</span>
          <span className="text-[9px] text-primary font-medium">+저장</span>
        </div>
      ))}
    </div>
  );
}

function SpeakMockup() {
  return (
    <div className="p-4 space-y-2">
      <p className="text-[10px] font-medium text-muted-foreground">영어로 써보기</p>
      <div className="rounded-lg border bg-background p-3 text-[10px] leading-relaxed text-foreground/70">
        "I am sorry for late reply. I was very busy these days and forgot to response you."
      </div>
      <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-[10px] leading-relaxed space-y-1.5">
        <span className="text-[9px] font-medium text-primary">AI 교정 →</span>
        <p className="text-foreground font-medium">"Apologies for the <span className="bg-green-100 text-green-800 rounded px-0.5">delayed response</span> — <span className="bg-green-100 text-green-800 rounded px-0.5">I've been swamped</span> lately."</p>
      </div>
      <div className="rounded-lg border border-dashed border-primary/40 bg-background p-2.5 space-y-1.5">
        <p className="text-[9px] font-medium text-primary/70">교정 문장에서 바로 청키 추출 →</p>
        <div className="flex items-center justify-between rounded bg-muted/60 px-2.5 py-1.5">
          <span className="text-[10px] font-medium">delayed response</span>
          <span className="text-[9px] text-primary font-medium">+저장</span>
        </div>
        <div className="flex items-center justify-between rounded bg-muted/60 px-2.5 py-1.5">
          <span className="text-[10px] font-medium">I've been swamped</span>
          <span className="text-[9px] text-primary font-medium">+저장</span>
        </div>
      </div>
    </div>
  );
}

function YoutubeMockup() {
  return (
    <div className="p-4 space-y-2">
      <div className="flex items-center gap-1.5">
        <div className="h-3.5 w-3.5 rounded-sm bg-red-500 flex items-center justify-center flex-shrink-0">
          <span className="text-[7px] text-white font-bold">▶</span>
        </div>
        <p className="text-[10px] font-medium text-muted-foreground">유튜브 자막 붙여넣기</p>
      </div>
      <div className="rounded-lg border bg-background p-2.5 text-[9px] leading-relaxed text-muted-foreground font-mono">
        <span className="text-muted-foreground/50">0:12</span> you need to{" "}
        <span className="bg-yellow-100 text-yellow-800 rounded px-0.5">build on top of</span>{" "}
        what you already know<br />
        <span className="text-muted-foreground/50">0:18</span> and{" "}
        <span className="bg-yellow-100 text-yellow-800 rounded px-0.5">work your way up</span>{" "}
        from there
      </div>
      <div className="flex items-center gap-1.5 rounded-lg bg-green-50 border border-green-200 px-2.5 py-1.5">
        <span className="text-[8px] text-green-700 font-medium">✓ 타임스탬프 자동 제거</span>
      </div>
      <button className="w-full rounded-lg bg-primary py-2 text-[10px] font-semibold text-primary-foreground">
        ✨ AI로 단어뭉치 추출
      </button>
    </div>
  );
}

function ReviewMockup() {
  return (
    <div className="p-4 space-y-2.5">
      <p className="text-[10px] font-medium text-muted-foreground">복습 스케줄</p>
      {[
        { label: "오늘", status: "완료", done: true },
        { label: "3일 후", status: "예정", done: false },
        { label: "7일 후", status: "예정", done: false },
        { label: "30일 후", status: "장기기억", done: false },
      ].map(({ label, status, done }) => (
        <div key={label} className="flex items-center justify-between rounded-lg border bg-background px-3 py-2.5">
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${done ? "bg-primary" : "bg-muted-foreground/30"}`} />
            <span className="text-[11px]">{label}</span>
          </div>
          <span className={`text-[9px] font-medium ${done ? "text-primary" : "text-muted-foreground"}`}>{status}</span>
        </div>
      ))}
    </div>
  );
}
