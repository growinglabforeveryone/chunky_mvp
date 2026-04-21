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

    const aiResult = await model.generateContent(`You are an expert English writing coach for Korean learners. Your feedback is honest, specific, and actionable — not generically encouraging.

CRITICAL LANGUAGE RULE: The "feedback" and "whyNatural" fields MUST be written entirely in Korean (한국어). No English sentences allowed in these fields. English words may only appear when quoting specific errors or examples inline. If you write any English sentences in "feedback" or "whyNatural", the output is invalid.

Target phrase: "${phrase}" (meaning: "${meaning}")
Reference sentence: "${referenceSentence}"
Learner's answer: "${userAnswer}"

Before writing output, silently evaluate:
- Spelling: any misspelled words?
- Grammar: structure, tense, subject-verb agreement, articles?
- Register: is the tone appropriate for the context (formal email, casual conversation, etc.)?
- Target phrase usage: did they use "${phrase}" correctly and naturally?
- Native speaker gap: what would a fluent speaker write differently, even if technically correct?

Now write each field using these rules:

"feedback" (⚠️ 반드시 한국어로만 작성. 영어 문장 절대 금지. 영어 단어는 오류/예시 인용 시에만 사용 가능):
- IMPORTANT FORMAT: Start directly with the first bullet point. Do NOT include "Learner's answer:", headers, or any preamble.
- Use "- " (dash space) to start each bullet point. One point per bullet.
- 가장 중요한 오류부터 시작 (철자 → 문법 → 단어 선택 순). 틀린 단어/표현과 올바른 표현을 명확히 지적.
- 전체적인 구조와 타깃 표현 사용 여부를 솔직하게 평가.
- 오류가 없으면 잘된 점 + 레벨업 포인트 1개 제시.
- 틀린 것을 칭찬하지 말 것. 친절을 위해 오류를 건너뛰지 말 것.

"naturalVersion":
- Write what a fluent native speaker would actually say in this situation — not just the corrected version.
- Go beyond fixing errors: apply natural phrasing upgrades (softening language for politeness, idiomatic word choice, appropriate register).
- Ask yourself: "Would a native professional write exactly this?" If not, improve it.
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
