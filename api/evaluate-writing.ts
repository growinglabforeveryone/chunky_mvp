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

    const aiResult = await model.generateContent(`You are an encouraging English teacher helping a Korean learner improve their English writing.

Target phrase: "${phrase}" (meaning: "${meaning}")
Reference sentence: "${referenceSentence}"
Learner's answer: "${userAnswer}"

Your task:
1. Write short encouraging feedback in Korean (1-2 sentences): mention one thing done well and one key improvement point if needed.
2. Provide a "naturalVersion": the most fluent, natural English version of what the learner was trying to say.
3. Provide a "literalVersion": a version that stays closer to the reference sentence style/structure.

If the learner's answer is already excellent, naturalVersion and literalVersion can be identical or nearly identical.

Return ONLY valid JSON (no markdown):
{
  "feedback": "<encouraging feedback in Korean, 1-2 sentences>",
  "naturalVersion": "<most natural/fluent English version>",
  "literalVersion": "<version closer to reference sentence style>"
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
