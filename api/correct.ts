import { GoogleGenerativeAI } from "@google/generative-ai";
import { checkUsage, recordUsage } from "./_lib/checkUsage.js";

export const config = { runtime: "edge" };

interface Correction {
  original_phrase: string;
  corrected_phrase: string;
  explanation: string;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // Usage check (free: 20/month)
  const usageCheck = await checkUsage(req, "correct");
  if ("response" in usageCheck) return usageCheck.response;
  const { userId } = usageCheck.result;

  try {
    const { text } = await req.json();

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

    const aiResult = await model.generateContent(`You are a native-level English coach for Korean business professionals.

The user wrote the following English. Your job is to:
1. Correct it so it sounds like a native speaker wrote it — fix grammar, word choice, and idioms
2. Explain each change concisely in Korean
3. Suggest 1-2 alternative phrasings when there's a meaningfully more natural or idiomatic way to say it (e.g. "in bloom" vs "blooming", "can't get enough of" vs "love seeing")

Rules:
- Go beyond surface grammar: if a phrasing is technically correct but unnatural, upgrade it to sound native
- "corrected" should be the single best native-sounding version
- "alternatives" are only needed when there's a notably different, more idiomatic option worth learning — skip if the corrected version is clearly best
- If the input is already natural, return it as-is with empty arrays
- Keep the user's intended meaning and register (casual/formal)
- All Korean text should be warm and encouraging

Return ONLY valid JSON (no markdown):
{
  "corrected": "The best native-sounding version",
  "corrections": [
    {
      "original_phrase": "what the user wrote",
      "corrected_phrase": "natural version",
      "explanation": "왜 이렇게 고쳤는지 한국어 설명 (이디엄/콜로케이션 관점 포함)"
    }
  ],
  "alternatives": [
    "Another natural way to say it (full sentence)"
  ],
  "encouragement": "잘한 부분에 대한 격려 한마디"
}

User's English:
${text}`);

    const jsonText = aiResult.response.text()
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();

    const result = JSON.parse(jsonText);

    await recordUsage(userId, "correct");

    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: "교정 실패" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
