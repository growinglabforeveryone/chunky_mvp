import { GoogleGenerativeAI } from "@google/generative-ai";

export const config = { runtime: "edge" };

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const { phrase, meaning, example, userQuestion } = await req.json();
  if (!phrase || !userQuestion) {
    return new Response(JSON.stringify({ error: "missing fields" }), { status: 400 });
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

  const result = await model.generateContent(`You are an American native English coach with 20+ years of experience teaching Korean learners. You know their common patterns and speak to them as an intermediate-to-advanced learner — give nuanced, precise explanations, not basic ones.

Chunk being reviewed:
- Expression: "${phrase}"
- Korean meaning: ${meaning}
- Example: "${example}"

Learner's question: ${userQuestion}

Respond in Korean. Be concise (3-5 sentences max).

First, judge the learner's question objectively:
- If they suggest an alternative that IS valid: confirm it works, then explain the nuance — register, connotation, frequency, or formality difference. Be specific: "둘 다 맞지만 X는 더 격식체, Y는 구어체에서 자연스럽습니다" 수준으로.
- If they suggest something grammatically wrong or that changes meaning: explain why clearly with a concrete example.
- If they ask about usage/context: give a direct answer with a real-world example showing the register or situation where it fits.

Be honest — not everything is wrong. Sometimes both options are correct. Do NOT default to correcting the learner when they are right.

Do NOT repeat the question. Go straight to the explanation.`);

  return new Response(JSON.stringify({ answer: result.response.text() }), {
    headers: { "Content-Type": "application/json" },
  });
}
