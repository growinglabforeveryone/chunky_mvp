/**
 * Vocab Buddy Box — Expert Debate Agent
 *
 * Round 1: 세 전문가 독립 심층 분석 (병렬)
 * Round 2: 서로의 분석을 읽고 반론/동의/보완 (병렬)
 * Round 3: Product Owner가 최종 결정
 *
 * 사용법: npm run vocab-buddy-box-debate "분석할 아이디어"
 */

import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.VITE_ANTHROPIC_API_KEY,
});

// ─── 제품 컨텍스트 (모든 에이전트가 공유) ────────────────────
const PRODUCT_CONTEXT = `
## Vocab Buddy Box — 제품 컨텍스트

**제품**: 한국 직장인을 위한 영어 단어뭉치 학습 앱
**핵심 개념**: Michael Lewis의 Lexical Approach — 2-5단어 덩어리(chunk)를 통째로 학습
**복습 시스템**: 에빙하우스 망각곡선 기반 SRS (저장 즉시 → 1일 → 7일 → 30일 → 마스터)

**개발자/사용자**:
- 이름: 가현 (AWS 스타트업 세일즈 담당)
- 비개발자, Claude Code와 함께 사이드 프로젝트로 직접 개발 중
- 현재: 개인 사용 MVP 단계
- **최종 목표: 아이폰 앱스토어 출시 → 다른 사용자들도 사용**
- 라이브러리는 사용자마다 계속 누적되며 수백~수천 개 규모로 성장 예상
- 따라서 모든 기능 설계 시 "지금 50개" 기준이 아닌 "미래 1000개+, 다수 사용자" 기준으로 판단해야 함

**현재 기술 스택**:
- Frontend: Vite + React + TypeScript + Zustand + Framer Motion
- Backend: Supabase (PostgreSQL) — vocabulary 테이블 (phrase, meaning, example_sentence, review_stage, next_review_at, mastered, source_name)
- AI: Claude Haiku API (dangerouslyAllowBrowser: true, 브라우저 직접 호출)
- 배포: Vercel (무료 플랜)

**현재 구현 완료 기능**:
- 텍스트에서 단어뭉치 자동 추출 (Claude API)
- 원문 하이라이트, 카드 편집/삭제/추가
- SRS 복습 플래시카드 (알았어요/몰랐어요)
- 라이브러리 (저장된 전체 단어뭉치 목록, 편집 가능)
- 출처 태그, 마스터 기능

**제품 철학**: 학습 효과 > 기능 많음. 단순하고 실제로 쓰는 앱.
`;

// ─── 전문가 에이전트 정의 ─────────────────────────────────────
const EXPERTS = [
  {
    name: "영어 학습 전문가",
    emoji: "📚",
    role: "english_learning",
    system: `You are a world-class expert in English language acquisition and vocabulary learning.
Your expertise includes:
- Michael Lewis's Lexical Approach and the Chunk methodology
- Spaced Repetition Systems (SRS) and Ebbinghaus forgetting curve research
- ESP (English for Specific Purposes) — domain-specific vocabulary instruction
- Second Language Acquisition (SLA) research: Nation, Krashen, Schmitt, Webb
- Contrastive learning, multi-contextual exposure, and deep processing (Craik & Lockhart)
- How Korean L1 speakers specifically acquire English as L2

${PRODUCT_CONTEXT}

Analyze the given idea from an English learning effectiveness perspective.
Be thorough, specific, and cite relevant learning theory where appropriate.
Give at least 5-7 concrete points. Use bold keywords for each point.
Respond entirely in Korean.`,
  },
  {
    name: "UX / 프로덕트 전문가",
    emoji: "🎨",
    role: "ux",
    system: `You are a senior UX designer and product strategist.
Your expertise includes:
- Mobile and web app interaction design patterns
- Language learning app UX: Duolingo, Anki, Memrise, LingQ
- Personal knowledge management (PKM) tools: Notion, Obsidian, Roam Research
- Habit-forming product design (Nir Eyal's Hooked model)
- Information architecture and progressive disclosure
- User research and reducing cognitive load
- Onboarding flows and feature discoverability

${PRODUCT_CONTEXT}

Analyze the given idea from a UX and product design perspective.
Be thorough — cover user flows, edge cases, potential confusion points, and competitive patterns.
Give at least 5-7 concrete points. Use bold keywords for each point.
Respond entirely in Korean.`,
  },
  {
    name: "기술 전문가",
    emoji: "⚙️",
    role: "tech",
    system: `You are a senior full-stack engineer who deeply knows this exact tech stack:
- Frontend: Vite + React + TypeScript + Zustand + Framer Motion + shadcn/ui + Tailwind
- Backend: Supabase (PostgreSQL + pgvector extension available + Row Level Security)
- AI: Anthropic Claude API — claude-haiku-4-5-20251001 (used browser-side)
- Deployment: Vercel (free plan, serverless functions available)

${PRODUCT_CONTEXT}

Analyze the given idea from a technical implementation perspective.
Be specific: name the exact files, functions, DB columns, and API calls involved.
For each approach, state: difficulty (쉬움/중간/어려움), estimated scope, and real trade-offs.
Give at least 5-7 concrete points. Use bold keywords for each point.
Also recommend a phased implementation order (MVP → v2 → v3).
Respond entirely in Korean.`,
  },
];

const PO = {
  name: "Product Owner",
  emoji: "🎯",
  system: `You are the Product Owner of Vocab Buddy Box.

${PRODUCT_CONTEXT}

Your role is to synthesize the expert debate and make a final, concrete product decision.

You have read:
- Round 1: Three experts' independent deep analyses
- Round 2: Each expert's rebuttals and debate responses

Your job is NOT to summarize — it is to DECIDE.

Consider these priorities when deciding:
1. Does this meaningfully improve the learning experience?
2. Is the complexity justified by the value delivered?
3. What's the leanest version that captures most of the value?
4. What fits the developer's (non-developer, limited time) capability?
5. What's the right sequence: build now vs. later vs. never?

Output format (respond in Korean):

## 🎯 최종 결정
**결정**: [지금 구현한다 / 가벼운 버전만 구현한다 / 나중에 구현한다 / 구현하지 않는다]
**우선순위**: [이번 스프린트 / 다음 스프린트 / 백로그 / 해당없음]

## 📋 결정 근거
(세 전문가의 토론을 바탕으로, 왜 이 결정을 내렸는지 3-5문장으로)

## 🔨 구체적 구현 스펙 (구현하는 경우)
- **MVP**: (지금 당장 만들 최소 버전)
- **v2**: (이후에 추가할 것)
- **하지 않을 것**: (범위에서 제외하는 것과 이유)

## ⚠️ 주요 리스크
- (구현 시 주의할 점 1-2개)

## ✅ 다음 액션 아이템
- [ ] (구체적인 첫 번째 행동)
- [ ] (두 번째 행동)
- [ ] (세 번째 행동)`,
};

// ─── API 호출 함수들 ──────────────────────────────────────────
async function askExpert(expert, question) {
  const msg = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2048,
    system: expert.system,
    messages: [{ role: "user", content: `분석할 아이디어:\n${question}` }],
  });
  return msg.content[0].text;
}

async function askDebate(expert, expertIndex, question, allRound1) {
  const myAnalysis = allRound1[expertIndex];
  const othersText = EXPERTS
    .map((e, j) => ({ e, result: allRound1[j] }))
    .filter((_, j) => j !== expertIndex)
    .map(({ e, result }) => `### ${e.emoji} ${e.name}의 분석\n${result}`)
    .join("\n\n");

  const prompt = `원래 아이디어:\n${question}

---

## 내 1차 분석 (참고용)
${myAnalysis}

---

## 다른 전문가들의 분석
${othersText}

---

위 다른 전문가들의 분석을 읽었습니다.
당신의 전문 분야 관점에서:
1. **동의하는 부분**: 다른 전문가들이 잘 짚은 포인트 (구체적으로 언급)
2. **반론 또는 보완**: 당신 관점에서 틀렸거나 불완전한 부분 (근거와 함께)
3. **놓친 관점**: 다른 전문가들이 전혀 다루지 않았지만 중요한 것

솔직하고 구체적으로 토론하세요. 단순한 동의는 가치가 없습니다.`;

  const msg = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2048,
    system: expert.system,
    messages: [{ role: "user", content: prompt }],
  });
  return msg.content[0].text;
}

async function askPO(question, round1, round2) {
  const fullDebate = EXPERTS
    .map((e, i) => `## ${e.emoji} ${e.name}\n\n### 1차 분석\n${round1[i]}\n\n### 토론 반응\n${round2[i]}`)
    .join("\n\n" + "─".repeat(50) + "\n\n");

  const msg = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2048,
    system: PO.system,
    messages: [
      {
        role: "user",
        content: `아이디어:\n${question}\n\n${"─".repeat(50)}\n\n${fullDebate}`,
      },
    ],
  });
  return msg.content[0].text;
}

// ─── 메인 오케스트레이터 ──────────────────────────────────────
async function main() {
  const question = process.argv.slice(2).join(" ");

  if (!question) {
    console.log("\n사용법: npm run vocab-buddy-box-debate \"분석할 아이디어\"");
    process.exit(1);
  }

  const divider = "─".repeat(56);
  console.log(`\n💬 아이디어: "${question}"\n`);

  // ── Round 1 ──
  console.log("⏳ Round 1 — 세 전문가 독립 심층 분석 중...\n");
  const t1 = Date.now();
  const round1 = await Promise.all(EXPERTS.map((e) => askExpert(e, question)));
  console.log(`✓ Round 1 완료 (${((Date.now() - t1) / 1000).toFixed(1)}초)\n`);

  console.log(divider);
  EXPERTS.forEach((e, i) => {
    console.log(`\n${e.emoji}  ${e.name} — 1차 분석`);
    console.log(divider);
    console.log(round1[i]);
  });

  // ── Round 2 ──
  console.log(`\n${"═".repeat(56)}`);
  console.log("⏳ Round 2 — 전문가 간 토론 중...\n");
  const t2 = Date.now();
  const round2 = await Promise.all(
    EXPERTS.map((e, i) => askDebate(e, i, question, round1))
  );
  console.log(`✓ Round 2 완료 (${((Date.now() - t2) / 1000).toFixed(1)}초)\n`);

  console.log(divider);
  EXPERTS.forEach((e, i) => {
    console.log(`\n${e.emoji}  ${e.name} — 토론 반응`);
    console.log(divider);
    console.log(round2[i]);
  });

  // ── Round 3: PO Decision ──
  console.log(`\n${"═".repeat(56)}`);
  console.log("⏳ Round 3 — Product Owner 최종 결정 중...\n");
  const t3 = Date.now();
  const decision = await askPO(question, round1, round2);
  console.log(`✓ Round 3 완료 (${((Date.now() - t3) / 1000).toFixed(1)}초)\n`);

  console.log(`${"═".repeat(56)}`);
  console.log(`\n${PO.emoji}  ${PO.name} — 최종 결정`);
  console.log(`${"═".repeat(56)}`);
  console.log(decision);

  const total = ((Date.now() - t1) / 1000).toFixed(1);
  console.log(`\n${"─".repeat(56)}`);
  console.log(`✅ 전체 완료 (총 ${total}초 | 7개 에이전트 호출)`);
}

main().catch((err) => {
  console.error("오류:", err.message);
  process.exit(1);
});
