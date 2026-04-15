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

async function translate(sentence, phrase, meaning) {
  const result = await model.generateContent(`You are a Korean English teacher. Translate the following English sentence into natural Korean.

Context:
- English chunk in the sentence: "${phrase}" (Korean meaning: ${meaning})

Rules:
- Translate naturally, not word-for-word
- Wrap the Korean word(s) that correspond to the English chunk in [[ and ]]
- Match the register (formal/casual) of the source
- Do NOT leak English words (keep proper nouns/brands in English)
- Do NOT add explanations or extra brackets
- One sentence with natural Korean punctuation

Example: if chunk is "raise serious questions about", output:
"그 스캔들은 기업 거버넌스에 대해 [[심각한 의문을 제기했다]]."

English sentence:
${sentence}

Return ONLY the Korean translation with [[ ]] markers.`);
  return result.response.text().trim();
}

async function main() {
  console.log("Fetching all cards...");
  const { data, error } = await supabase
    .from("vocabulary")
    .select("id, phrase, meaning, example_sentence")
    .not("example_sentence", "is", null);

  if (error) {
    console.error("Fetch error:", error);
    process.exit(1);
  }

  console.log(`Found ${data.length} cards to backfill (per-chunk, no sibling propagation).`);
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
