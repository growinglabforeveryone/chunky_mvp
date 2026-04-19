import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";

export const config = { runtime: "edge" };

function isKoMarkerValid(exampleKo: string, koreanMeaning: string): boolean {
  const pattern = /\[\[(.+?)\]\]/g;
  let totalMarked = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(exampleKo)) !== null) totalMarked += match[1].length;
  if (totalMarked === 0) return true;
  const meaningLen = koreanMeaning.replace(/[~,\s]/g, "").length;
  return meaningLen === 0 || totalMarked <= meaningLen * 1.8;
}

function buildPrompt(sentence: string, phrase: string, meaning: string): string {
  return `You are a Korean English teacher. Translate the following English sentence into natural Korean.

chunk in the sentence: "${phrase}" (Korean meaning: ${meaning})

Rules:
- Translate naturally — not word-for-word
- Wrap ONLY the Korean word(s) that correspond to the English chunk in [[ and ]]
- If the Korean equivalent is discontinuous, use MULTIPLE [[ ]] pairs:
  e.g. chunk "look like yet another" → "[[또 다른]] 환경 보호 조치[[처럼 보일]] 수도 있다."
- Do NOT include content nouns inside [[ ]] if they are not part of the chunk
- MARKER SIZE: total marked text ≤ meaning length × 1.8. Never over-mark.
  BAD: chunk "close to the problem" → "[[중 상당수에 놀라울 정도로 가깝습니다]]" (too wide)
  GOOD: chunk "close to the problem" → "[[문제들]]에 [[가깝습니다]]"
- Match the register (formal/casual) of the English source
- Keep proper nouns/brands in English
- Return ONLY the Korean translation with [[ ]] markers, no explanation

English sentence:
${sentence}`;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

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
    const body = await req.json();
    const { vocabularyId, sentence, phrase, meaning } = body;

    if (!sentence?.trim()) {
      return new Response(JSON.stringify({ error: "sentence is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (!phrase?.trim() || !meaning?.trim()) {
      return new Response(JSON.stringify({ error: "phrase and meaning are required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

    const prompt = buildPrompt(sentence, phrase, meaning);
    let aiResult = await model.generateContent(prompt);
    let korean = aiResult.response.text()
      .replace(/^```.*\n?/i, "").replace(/\n?```$/i, "").trim();

    // 마커 품질 검증 — 실패 시 1회 재시도
    if (!isKoMarkerValid(korean, meaning)) {
      aiResult = await model.generateContent(prompt);
      const retry = aiResult.response.text()
        .replace(/^```.*\n?/i, "").replace(/\n?```$/i, "").trim();
      korean = isKoMarkerValid(retry, meaning) ? retry : retry.replace(/\[\[(.+?)\]\]/g, "$1");
    }

    // vocabularyId가 있을 때만 DB 업데이트
    if (vocabularyId) {
      const supabaseService = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY!,
      );
      await supabaseService.from("vocabulary").update({ example_ko: korean }).eq("id", vocabularyId);
    }

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
