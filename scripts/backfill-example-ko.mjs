/**
 * vocabulary 카드마다 example_ko를 개별 생성 (sibling 전파 없음)
 * 실행: node --env-file=.env.local scripts/backfill-example-ko.mjs
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

function isKoMarkerValid(exampleKo, koreanMeaning) {
  const pattern = /\[\[(.+?)\]\]/g;
  let totalMarked = 0;
  let match;
  while ((match = pattern.exec(exampleKo)) !== null) totalMarked += match[1].length;
  if (totalMarked === 0) return true;
  const meaningLen = koreanMeaning.replace(/[~,\s]/g, "").length;
  return meaningLen === 0 || totalMarked <= meaningLen * 1.8;
}

function buildPrompt(sentence, phrase, meaning) {
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

async function translate(sentence, phrase, meaning) {
  const prompt = buildPrompt(sentence, phrase, meaning);
  let result = await model.generateContent(prompt);
  let korean = result.response.text().replace(/^```.*\n?/i, "").replace(/\n?```$/i, "").trim();

  if (!isKoMarkerValid(korean, meaning)) {
    result = await model.generateContent(prompt);
    const retry = result.response.text().replace(/^```.*\n?/i, "").replace(/\n?```$/i, "").trim();
    korean = isKoMarkerValid(retry, meaning) ? retry : retry.replace(/\[\[(.+?)\]\]/g, "$1");
  }

  return korean;
}

async function main() {
  console.log("Fetching all cards...");
  const { data, error } = await supabase
    .from("vocabulary")
    .select("id, phrase, meaning, example_sentence")
    .not("example_sentence", "is", null)
    .is("example_ko", null);

  if (error) {
    console.error("Fetch error:", error);
    process.exit(1);
  }

  console.log(`Found ${data.length} cards with null example_ko to backfill.`);
  if (data.length === 0) return;

  let success = 0;
  let failed = 0;

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    try {
      const korean = await translate(row.example_sentence, row.phrase, row.meaning);
      const { error: updateErr } = await supabase
        .from("vocabulary")
        .update({ example_ko: korean })
        .eq("id", row.id);  // 개별 row만 업데이트

      if (updateErr) {
        console.error(`[${i + 1}/${data.length}] FAIL update: ${row.phrase}`, updateErr);
        failed++;
      } else {
        console.log(`[${i + 1}/${data.length}] ✓ "${row.phrase}" → ${korean.slice(0, 60)}...`);
        success++;
      }
    } catch (err) {
      console.error(`[${i + 1}/${data.length}] FAIL translate: ${row.phrase}`, err.message);
      failed++;
    }

    await new Promise((r) => setTimeout(r, 200));
  }

  console.log(`\nDone. success=${success} failed=${failed}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
