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

  const result = await model.generateContent(`You are an English tutor helping a Korean business professional understand a vocabulary chunk.

Chunk being reviewed:
- Expression: "${phrase}"
- Korean meaning: ${meaning}
- Example: "${example}"

Learner's question: ${userQuestion}

Respond in Korean. Be concise (3-5 sentences max).

First, judge the learner's question objectively:
- If they suggest an alternative that IS valid: confirm it works, then explain any nuance in frequency, formality, or emphasis
- If they suggest something that is grammatically wrong or changes meaning: explain why clearly
- If they ask about usage/context: give a direct answer with a concrete example

Be honest — not everything is wrong. Sometimes both options are correct. Do NOT default to correcting the learner when they are right.

Do NOT repeat the question. Go straight to the explanation.`);

  return new Response(JSON.stringify({ answer: result.response.text() }), {
    headers: { "Content-Type": "application/json" },
  });
}
