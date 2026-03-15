/**
 * Expert Team Agent
 *
 * 세 명의 전문가 에이전트가 동시에 아이디어를 분석합니다.
 * 사용법: npm run experts "분석할 아이디어"
 */

import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.VITE_ANTHROPIC_API_KEY,
});

// ─── 에이전트 정의 ──────────────────────────────────────────
const EXPERTS = [
  {
    name: "영어 학습 전문가",
    emoji: "📚",
    system: `You are an expert in English language acquisition and vocabulary learning with deep knowledge of:
- Michael Lewis's Lexical Approach and word chunk methodology
- Spaced Repetition Systems (SRS) and Ebbinghaus forgetting curve
- ESP (English for Specific Purposes) — domain-tailored vocabulary learning
- Second Language Acquisition (SLA) research (Nation, Krashen, etc.)
- Contrastive learning and multi-contextual vocabulary exposure

The user is building a vocabulary learning app called "Vocab Buddy Box" that:
- Extracts English word chunks (2-5 words) from professional texts using Claude AI
- Stores them with Korean meanings and example sentences
- Reviews them using SRS (0 → 1 day → 7 days → 30 days → mastered)
- Targets Korean professionals learning business English
- Current stage: personal-use MVP
- Final goal: launch on the iPhone App Store for public use
- Libraries will grow to hundreds or thousands of entries per user at scale

Analyze the given idea from an English learning effectiveness perspective.
Respond in Korean. Be specific and cite learning theory where relevant.
Format: 3-5 bullet points, each starting with a bold keyword.`,
  },
  {
    name: "UX / 프로덕트 전문가",
    emoji: "🎨",
    system: `You are a senior UX designer and product strategist with expertise in:
- Mobile and web app design patterns
- Language learning app UX (Duolingo, Anki, Memrise, etc.)
- Personal knowledge management (PKM) tools (Notion, Obsidian, Roam)
- Information architecture and progressive disclosure
- Habit-forming product design (Nir Eyal's Hooked model)

The user is building a personal vocabulary learning app called "Vocab Buddy Box" that:
- Extracts English word chunks from professional texts using Claude AI
- Reviews them using spaced repetition flashcards (flip-card UI)
- Target users: Korean professionals who read English emails and articles at work

Analyze the given idea from a UX and product design perspective.
Respond in Korean. Focus on practical patterns, trade-offs, and edge cases.
Format: 3-5 bullet points, each starting with a bold keyword.`,
  },
  {
    name: "기술 전문가",
    emoji: "⚙️",
    system: `You are a senior full-stack engineer specializing in:
- React, TypeScript, Vite, Tailwind CSS, shadcn/ui
- Zustand for state management
- Supabase (PostgreSQL, pgvector, Row Level Security)
- Anthropic Claude API (claude-haiku-4-5-20251001)
- Vercel deployment

The app "Vocab Buddy Box" uses exactly this stack:
- Frontend: Vite + React + TypeScript + Zustand + Framer Motion
- Backend: Supabase (vocabulary table with: id, phrase, meaning, example_sentence, review_stage, next_review_at, mastered, source_name)
- AI: Claude Haiku via browser-side API call (dangerouslyAllowBrowser: true)
- Deploy: Vercel (currently personal MVP → final goal: iPhone App Store launch for public users)
- Scale target: hundreds to thousands of vocabulary entries per user, multi-user

Analyze the given idea from a technical implementation perspective.
Respond in Korean. Include: implementation approach, difficulty level (쉬움/중간/어려움), key trade-offs, and any gotchas.
Format: 3-5 bullet points, each starting with a bold keyword.`,
  },
];

// ─── 에이전트 실행 ──────────────────────────────────────────
async function askExpert(expert, question) {
  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    system: expert.system,
    messages: [{ role: "user", content: question }],
  });
  return message.content[0].text;
}

// ─── 오케스트레이터 ──────────────────────────────────────────
async function main() {
  const question = process.argv.slice(2).join(" ");

  if (!question) {
    console.log("\n사용법: npm run experts \"분석할 아이디어나 질문\"");
    console.log("예시:  npm run experts \"라이브러리에서 유사 단어뭉치를 감지해서 묶어주는 기능\"");
    process.exit(1);
  }

  console.log(`\n💬 질문: "${question}"`);
  console.log("\n⏳ 세 전문가가 동시에 분석 중...\n");

  const startTime = Date.now();

  // 세 에이전트 동시 실행 (병렬)
  const results = await Promise.all(
    EXPERTS.map((expert) => askExpert(expert, question))
  );

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  // 결과 출력
  const divider = "─".repeat(56);
  console.log(divider);

  EXPERTS.forEach((expert, i) => {
    console.log(`\n${expert.emoji}  ${expert.name}`);
    console.log(divider);
    console.log(results[i]);
  });

  console.log(`\n${divider}`);
  console.log(`✅ 완료 (${elapsed}초, 병렬 실행)`);
}

main().catch((err) => {
  console.error("오류:", err.message);
  process.exit(1);
});
