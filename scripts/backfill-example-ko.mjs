/**
 * example_ko가 비어있는 vocabulary 카드에 한국어 예문 번역 일괄 생성
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
- The translation should naturally include the chunk's usage so a learner can map English ↔ Korean.
- English chunk in the sentence: "${phrase}" (Korean meaning: ${meaning})

Rules:
- Translate naturally, not word-for-word
- Match the register (formal/casual) of the source
- Do NOT leak English words (keep proper nouns/brands in English)
- Do NOT add explanations or brackets
- One sentence with natural Korean punctuation

English sentence:
${sentence}

Return ONLY the Korean translation.`);
  return result.response.text().trim();
}

async function main() {
  console.log("Fetching cards with example_ko = NULL...");
  const { data, error } = await supabase
    .from("vocabulary")
    .select("id, phrase, meaning, example_sentence")
    .is("example_ko", null)
    .not("example_sentence", "is", null);

  if (error) {
    console.error("Fetch error:", error);
    process.exit(1);
  }

  console.log(`Found ${data.length} cards to backfill.`);
  if (data.length === 0) return;

  // 같은 example_sentence는 한 번만 번역 → 모든 sibling에 전파
  const uniqueByExample = new Map();
  for (const row of data) {
    if (!uniqueByExample.has(row.example_sentence)) {
      uniqueByExample.set(row.example_sentence, row);
    }
  }
  console.log(`Unique example sentences: ${uniqueByExample.size}`);

  let success = 0;
  let failed = 0;
  let i = 0;

  for (const [sentence, row] of uniqueByExample) {
    i++;
    try {
      const korean = await translate(sentence, row.phrase, row.meaning);
      const { error: updateErr } = await supabase
        .from("vocabulary")
        .update({ example_ko: korean })
        .eq("example_sentence", sentence)
        .is("example_ko", null);

      if (updateErr) {
        console.error(`[${i}/${uniqueByExample.size}] FAIL update: ${row.phrase}`, updateErr);
        failed++;
      } else {
        console.log(`[${i}/${uniqueByExample.size}] ✓ "${row.phrase}" → ${korean.slice(0, 50)}...`);
        success++;
      }
    } catch (err) {
      console.error(`[${i}/${uniqueByExample.size}] FAIL translate: ${row.phrase}`, err.message);
      failed++;
    }

    // rate limit 완화
    await new Promise((r) => setTimeout(r, 200));
  }

  console.log(`\nDone. success=${success} failed=${failed}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
