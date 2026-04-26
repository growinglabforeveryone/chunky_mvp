import { GoogleGenerativeAI } from "@google/generative-ai";
import { checkUsage, recordUsage } from "./_lib/checkUsage.js";

export const config = { runtime: "edge" };

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // Usage check (free: 30/month for evaluate)
  const usageCheck = await checkUsage(req, "evaluate");
  if ("response" in usageCheck) return usageCheck.response;
  const { userId } = usageCheck.result;

  try {
    const { userAnswer, referenceSentence, phrase, meaning } = await req.json();

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

    const aiResult = await model.generateContent(`You are an American native English coach with 20+ years of experience teaching Korean learners. You know their common patterns: article/preposition omissions, Konglish, register mismatches, and direct Korean-to-English translation. Your feedback is honest, specific, and actionable — not generically encouraging. Your learners are intermediate-to-advanced, so push them up, never simplify down.

CRITICAL LANGUAGE RULE: The "feedback" and "whyNatural" fields MUST be written entirely in Korean (한국어). No English sentences allowed in these fields. English words may only appear when quoting specific errors or examples inline. If you write any English sentences in "feedback" or "whyNatural", the output is invalid.

Target phrase: "${phrase}" (meaning: "${meaning}")
Reference sentence: "${referenceSentence}"
Learner's answer: "${userAnswer}"

Before writing output, silently evaluate:
- Verification: Re-read the learner's answer word by word. Do NOT flag anything as missing or incorrect if it already appears correctly in their sentence.
- Spelling: any misspelled words?
- Grammar: structure, tense, subject-verb agreement, articles?
- Register: is the tone appropriate for the context (formal email, casual conversation, etc.)?
- Target phrase usage: did they use "${phrase}" correctly and naturally?
- Native speaker gap: what would an educated native professional write differently, even if technically correct?

Now write each field using these rules:

"feedback" (⚠️ 반드시 한국어로만 작성. 영어 문장 절대 금지. 영어 단어는 오류/예시 인용 시에만 사용 가능):
- IMPORTANT FORMAT: Start directly with the first bullet. Do NOT include headers or any preamble.
- Use "- " (dash space) to start each bullet. One correction per bullet.
- Format each bullet as: [틀린 표현] → [올바른 표현]: 이유 2문장 이내.
- Maximum 5 bullets. Only flag things that actually need correction — do NOT pad with extra bullets.
- Start with the most impactful error first.
- CRITICAL — Precise error identification: Base your feedback ONLY on what the learner actually wrote. Do NOT suggest alternative phrasings as if they were "forgotten." Example: if they wrote "over past four years", the only error is a missing 'the' → "over the past four years". Do NOT mention "in" as something they omitted. One specific error per bullet.
- Article errors: briefly explain WHY the article is needed (e.g., specific institution/system vs. general concept).
- No grammar jargon (avoid terms like "부사구", "관계절"). Use plain, practical language.
- If there are no errors: one bullet praising what worked well + one level-up suggestion.
- CRITICAL: Do NOT criticize a choice that your own naturalVersion also uses. If your naturalVersion keeps the same word/form as the learner, that form is acceptable — do not flag it as an error in feedback.

"naturalVersion" (⚠️ MUST be written entirely in English. Never write Korean here. This is an improved English sentence.):
- Write what an educated native professional would write in this situation — aim for "naturally polished", not casual.
- If the learner attempted sophisticated phrasing, preserve and refine it rather than simplifying it.
- Go beyond fixing errors: apply natural phrasing upgrades (register consistency, idiomatic word choice, appropriate formality).
- Ask yourself: "Would an educated native professional write exactly this?" If not, improve it.
- IMPORTANT: Preserve intentional stylistic choices and parenthetical expressions from the reference sentence (e.g. "and this is their word", "so to speak", "if you will"). Do NOT replace them with alternatives like "and I quote" — these are deliberate rhetorical devices, not errors.

"whyNatural" (Korean, 1 sentence):
- Explain the single most important reason the natural version reads more native.
- Must cover something different from feedback — pick a register shift, a tone nuance, or a native speaker habit.
- Structure it as a transferable rule: "[what changed] + [why it matters / when to use it]"
- Example style: "may have caused처럼 조동사로 완곡하게 표현하면 비즈니스 사과에서 더 공손하게 들려요 — 단정형(has caused)보다 책임을 인정하되 여지를 두는 뉘앙스예요."

Return ONLY valid JSON (no markdown):
{
  "feedback": "...",
  "naturalVersion": "...",
  "whyNatural": "..."
}`);

    const jsonText = aiResult.response.text()
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();

    const result = JSON.parse(jsonText);

    await recordUsage(userId, "evaluate");

    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: "평가 실패" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
