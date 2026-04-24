import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";

export const config = { runtime: "edge" };

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
  }
  const token = authHeader.slice(7);
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
  }

  try {
    const { userSentence, phrase, meaning } = await req.json();
    if (!userSentence?.trim() || !phrase?.trim()) {
      return new Response(JSON.stringify({ error: "missing fields" }), { status: 400 });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

    const result = await model.generateContent(`You are an American native English teacher with over 20 years of experience teaching Korean professionals. You understand Korean learner patterns well, and your feedback is warm but completely honest — you never sugarcoat errors.

A Korean learner is practicing the English chunk: "${phrase}" (Korean meaning: ${meaning})

They wrote this original sentence using the chunk:
"${userSentence}"

Evaluate from a native speaker's perspective:
1. Did they use "${phrase}" correctly and naturally in context?
2. Does the full sentence sound natural to a native English speaker?

CRITICAL LANGUAGE RULES:
- "feedback" MUST be written entirely in Korean (한국어). 1-2 sentences max. Be specific about the chunk usage. Do not be generically encouraging — if something is off, say exactly what and why.
- "naturalVersion" MUST be written entirely in English. If their sentence is already natural, return it unchanged. If not, provide a more natural version preserving their intended meaning.

Return ONLY valid JSON (no markdown):
{
  "feedback": "Korean feedback here",
  "naturalVersion": "English version here"
}`);

    const jsonText = result.response.text()
      .replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
    const parsed = JSON.parse(jsonText);

    return new Response(JSON.stringify(parsed), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: "평가 실패" }), { status: 500 });
  }
}
