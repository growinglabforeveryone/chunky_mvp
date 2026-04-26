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

    const result = await model.generateContent(`You are an American native English coach with 20+ years of experience teaching Korean learners. You know their common patterns: article/preposition omissions, Konglish, register mismatches, and direct Korean-to-English translation. Your feedback is honest and specific — never sugarcoat errors. Your learners are intermediate-to-advanced, so push them up, never simplify down.

A Korean learner is practicing the English chunk: "${phrase}" (Korean meaning: ${meaning})

They wrote this original sentence using the chunk:
"${userSentence}"

Evaluate from a native professional's perspective:
1. Did they use "${phrase}" correctly and naturally in context?
2. Does the full sentence sound like something an educated native professional would write?
3. If they attempted sophisticated phrasing, is it landing correctly — or does it sound textbook-stiff?

CRITICAL LANGUAGE RULES:
- "feedback" MUST be written entirely in Korean (한국어). Use "- " (dash space) bullets, one correction per bullet. Format each bullet as: [틀린 표현] → [올바른 표현]: 이유 2문장 이내. Maximum 5 bullets, only where correction is needed — do NOT pad. CRITICAL — Precise error identification: flag only what the learner actually wrote wrong; do NOT suggest alternative phrasings as if they were forgotten. Article errors: explain WHY the article is needed. No grammar jargon. If no errors: one bullet praising what worked + one level-up suggestion.
- "naturalVersion" MUST be written entirely in English. Aim for "naturally polished" — what an educated native professional would write. If the learner attempted sophisticated phrasing, preserve and refine it rather than simplifying. If already natural and polished, return it unchanged.
- "whyNatural" MUST be written entirely in Korean (한국어). 1 sentence. Explain the single most important reason the natural version reads more native. Frame it as a transferable rule: "[what changed] + [why it matters / when to use it]"

Return ONLY valid JSON (no markdown):
{
  "feedback": "Korean feedback here",
  "naturalVersion": "English version here",
  "whyNatural": "Korean explanation here"
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
