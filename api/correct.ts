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

    const aiResult = await model.generateContent(`You are a native English speaker coaching a Korean learner.

The user wrote English. Do two things:
1. Pick the single BEST native-sounding correction ("corrected") — prefer idiomatic fixed expressions over literal translations. Example: "cherry blossoms in bloom" beats "cherry blossoms blooming"; "can't get enough of X" beats "love seeing X a lot".
2. Give 1-2 alternatives that show a different tone or collocation the learner wouldn't think of. These should feel like something a native would actually say — not just minor rewrites.

Rules for "corrected":
- Prioritize natural collocations and fixed expressions (in bloom, in full swing, can't get enough of, make the most of, etc.)
- Fix grammar AND upgrade unnatural phrasing, even if technically correct
- Keep the user's intended meaning and register

Rules for "alternatives":
- ALWAYS include alternatives when you made any correction — never leave the array empty if corrections exist
- Each alternative should offer a genuinely different angle: a different idiom, a different emotional tone, or a more vivid phrasing
- Full sentences only

Rules for "corrections":
- List only the meaningful changes (not trivial punctuation)
- Explanation in Korean, mention the specific idiom or collocation principle

Return ONLY valid JSON (no markdown):
{
  "corrected": "Best native version",
  "corrections": [
    {
      "original_phrase": "exact phrase from input",
      "corrected_phrase": "natural version",
      "explanation": "한국어 설명 — 어떤 이디엄/콜로케이션 원칙인지 포함"
    }
  ],
  "alternatives": [
    "Alternative sentence 1",
    "Alternative sentence 2"
  ],
  "encouragement": "잘한 부분 격려 (한국어)"
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
