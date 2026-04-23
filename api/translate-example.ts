import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";

export const config = { runtime: "edge" };

function fixBrokenMarkers(text: string): string {
  // If ]] is immediately followed by hangul (mid-eojeol break), extend marker to next boundary
  // e.g. [[강력히 추]]진했다고 → [[강력히 추진했다고]]
  return text.replace(/(\[\[[^\]]+)\]\]([가-힣ㄱ-ㆎ㈀-㈞㉠-㉾ꥠ-ꥼힰ-ퟆퟋ-ퟻ]+)/g, '$1$2]]');
}

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
- Wrap ONLY the Korean word(s) that are the DIRECT translation of the English chunk in [[ and ]]
- If the Korean equivalent is discontinuous, use MULTIPLE [[ ]] pairs:
  e.g. chunk "look like yet another" → "[[또 다른]] 환경 보호 조치[[처럼 보일]] 수도 있다."
- CRITICAL: Never break a Korean eojeol (어절, the characters between two spaces) in the middle. The [[ and ]] markers must open and close at word boundaries (spaces or sentence edges), not mid-word.
  BAD: "[[강력히 추]]진했다고" (breaks mid-eojeol)
  GOOD: "[[강력히 추진했다]]고"
- Do NOT include surrounding adverbs, negations, or modifiers in [[ ]] if they are not part of the chunk itself.
  e.g. chunk "attributed" (meaning: 귀속시키다) → sentence has "잘못 귀속시켰다"
  BAD: "[[잘못 귀속시켰다]]" (잘못 is NOT part of "attributed")
  GOOD: "잘못 [[귀속시켰다]]" (mark only the direct translation)
- Do NOT include content nouns inside [[ ]] if they are not part of the chunk
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
    korean = fixBrokenMarkers(korean);

    // 마커 품질 검증 — 실패 시 1회 재시도
    if (!isKoMarkerValid(korean, meaning)) {
      aiResult = await model.generateContent(prompt);
      const retry = fixBrokenMarkers(aiResult.response.text()
        .replace(/^```.*\n?/i, "").replace(/\n?```$/i, "").trim());
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
