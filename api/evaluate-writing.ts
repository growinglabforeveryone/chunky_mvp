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

    const aiResult = await model.generateContent(`You are an encouraging English teacher evaluating a Korean learner's English translation.

Target phrase: "${phrase}" (meaning: "${meaning}")
Reference sentence: "${referenceSentence}"
Learner's answer: "${userAnswer}"

Scoring rubric:
- 5: Target phrase used correctly + perfect grammar + natural expression
- 4: Target phrase used correctly + at most 1 minor error (graduation threshold)
- 3: Target phrase used but 2+ grammar errors or unnatural expression
- 2: Target phrase misused or meaning distorted
- 1: Target phrase not used or completely different meaning

Common Korean learner issues to check: articles (a/an/the), prepositions, verb tense, subject-verb agreement.

Return ONLY valid JSON (no markdown):
{
  "score": <1-5 integer>,
  "corrected": "<best corrected version of the learner's sentence>",
  "feedback": "<encouraging feedback in Korean, 1-2 sentences>",
  "targetPhraseUsed": <true|false>,
  "keyIssues": ["<specific issue 1 in Korean>", "<specific issue 2 in Korean>"]
}

If the answer is perfect, keyIssues should be an empty array.`);

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
