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

"feedback" (MUST be written in Korean — 2-3 sentences, no English sentences):
- Open with the most critical error (spelling → grammar → word choice, in that order). Name the exact wrong word/phrase and what's correct.
- Then give an honest overall read: was the structure sound? Was the target phrase used well?
- If there are no errors, acknowledge what worked and name one subtle thing to level up.
- Never compliment what is wrong. Never skip an error to seem kind.

"naturalVersion":
- Write what a fluent native speaker would actually say in this situation — not just the corrected version.
- Go beyond fixing errors: apply natural phrasing upgrades (softening language for politeness, idiomatic word choice, appropriate register).
- Ask yourself: "Would a native professional write exactly this?" If not, improve it.

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
