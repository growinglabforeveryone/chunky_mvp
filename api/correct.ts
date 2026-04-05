import { GoogleGenerativeAI } from "@google/generative-ai";
import { checkUsage, recordUsage } from "./_lib/checkUsage";

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
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-lite" });

    const result = await model.generateContent(`You are a friendly English coach for Korean learners.

The user spoke or typed the following English. Correct it to sound natural, then explain what you changed and why.

Rules:
- If the input is already natural, return it as-is with an empty corrections array
- Keep the user's intended meaning and tone
- Correct grammar, word choice, and phrasing to sound natural
- Do NOT over-correct or make it sound overly formal unless the original was formal
- Explanations should be in Korean, 1-2 sentences each
- encouragement should be in Korean, warm and specific about what the user did well

Return ONLY valid JSON (no markdown, no explanation outside JSON):
{
  "corrected": "The full corrected text",
  "corrections": [
    {
      "original_phrase": "what the user wrote",
      "corrected_phrase": "natural version",
      "explanation": "왜 이렇게 고쳤는지 한국어 설명"
    }
  ],
  "encouragement": "잘한 부분에 대한 격려 한마디"
}

User's English:
${text}`);

    const jsonText = result.response.text()
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
