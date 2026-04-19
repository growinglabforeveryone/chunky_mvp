import { GoogleGenerativeAI } from "@google/generative-ai";

export const config = { runtime: "edge" };

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const { situationKo } = await req.json();
  if (!situationKo) {
    return new Response(JSON.stringify({ error: "missing situationKo" }), { status: 400 });
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

  const prompt = `You are an English speaking coach for Korean professionals.

A Korean learner described this situation they want to express in English:
"${situationKo}"

Generate 4-5 natural English expressions they could use in this situation.
Each expression should be:
- A useful chunk/phrase (not just a single word)
- Natural and native-sounding
- Varied in function or nuance where possible

Return ONLY valid JSON array, no markdown:
[
  {
    "phrase": "the English expression or sentence pattern",
    "meaning": "한국어로 뜻 설명 (15자 이내, 간결하게)",
    "functionLabel": "언제/어떻게 쓰는지 한국어로 (예: '반박을 완곡하게 할 때', '의견 차이를 인정할 때', 15자 이내)",
    "exampleSentence": "a complete natural example sentence using this phrase"
  }
]`;

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();

  try {
    const start = text.indexOf("[");
    const end = text.lastIndexOf("]") + 1;
    const phrases = JSON.parse(text.slice(start, end));
    return new Response(JSON.stringify({ phrases }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ error: "parse_error", raw: text }), { status: 500 });
  }
}
