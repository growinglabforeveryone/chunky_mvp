import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";

export const config = { runtime: "edge" };

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // Auth check (no usage count — internal caching)
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const token = authHeader.slice(7);
  const supabaseAnon = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } },
  );

  const { data: { user }, error: authError } = await supabaseAnon.auth.getUser(token);
  if (authError || !user) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const { vocabularyId, sentence } = await req.json();
    if (!sentence || typeof sentence !== "string" || !sentence.trim()) {
      return new Response(JSON.stringify({ error: "sentence is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

    const aiResult = await model.generateContent(`You are a Korean English teacher. Translate the following English sentence into natural Korean.

Context:
- The learner will use this Korean sentence to practice writing the English version.

Rules:
- Translate naturally into Korean — not word-for-word
- Keep the meaning precise so a learner can reconstruct the original English sentence
- Do NOT bias toward any specific English phrasing — translate the overall meaning
- Return ONLY the Korean translation, no explanation, no punctuation change

English sentence:
${sentence}`);

    const korean = aiResult.response.text().trim();

    // Cache the translation back to vocabulary row using service role
    const supabaseService = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY!,
    );

    // 같은 exampleSentence를 가진 모든 청크에 번역 전파 (아직 번역 없는 것만)
    await supabaseService
      .from("vocabulary")
      .update({ example_ko: korean })
      .eq("example_sentence", sentence)
      .eq("user_id", user.id)
      .is("example_ko", null);

    return new Response(JSON.stringify({ korean }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: "번역 생성 실패" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
