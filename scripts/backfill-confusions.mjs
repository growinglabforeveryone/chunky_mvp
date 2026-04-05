/**
 * 기존 단어에 혼동 표현(common_confusions) 일괄 생성
 * 실행: node --env-file=.env.local scripts/backfill-confusions.mjs
 */

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

const anthropic = new Anthropic({ apiKey: process.env.VITE_ANTHROPIC_API_KEY });

async function generateConfusion(phrase, meaning, example) {
  const msg = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 150,
    messages: [
      {
        role: "user",
        content: `English chunk: "${phrase}"
Korean meaning: ${meaning}
Example: ${example}

Provide 1-2 ENGLISH expressions that Korean learners commonly confuse with this chunk.
The confusable expression MUST be in English.
Format: "❌ [English wrong expression] (이유: Korean explanation). 예: English example sentence."
Keep it under 60 words. If no common confusion exists, reply with empty string "".
Reply with ONLY the confusion text or empty string, nothing else.`,
      },
    ],
  });

  return msg.content[0]?.type === "text" ? msg.content[0].text.trim() : "";
}

async function main() {
  // 현재 로그인된 사용자 세션이 없으므로 service role 또는 전체 조회
  // anon key로는 RLS 때문에 조회 불가 → SUPABASE_SERVICE_ROLE_KEY 필요
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const client = serviceKey
    ? createClient(process.env.VITE_SUPABASE_URL, serviceKey)
    : supabase;

  if (!serviceKey) {
    console.warn("⚠️  SUPABASE_SERVICE_ROLE_KEY 없음 — .env.local에 추가 필요");
    console.warn("   Supabase 대시보드 → Settings → API → service_role key");
    process.exit(1);
  }

  const { data: rows, error } = await client
    .from("vocabulary")
    .select("id, phrase, meaning, example_sentence")
    .is("common_confusions", null);

  if (error) {
    console.error("조회 실패:", error.message);
    process.exit(1);
  }

  if (!rows || rows.length === 0) {
    console.log("✅ 모든 단어에 이미 혼동 표현이 있어요.");
    return;
  }

  console.log(`📚 총 ${rows.length}개 단어 처리 시작...\n`);

  // 5개씩 병렬 처리
  const BATCH = 5;
  let updated = 0;

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    await Promise.all(
      batch.map(async (row) => {
        try {
          const confusion = await generateConfusion(
            row.phrase,
            row.meaning,
            row.example_sentence
          );
          await client
            .from("vocabulary")
            .update({ common_confusions: confusion })
            .eq("id", row.id);
          updated++;
          console.log(`✓ [${updated}/${rows.length}] ${row.phrase}`);
        } catch (e) {
          console.error(`✗ ${row.phrase}: ${e.message}`);
        }
      })
    );
  }

  console.log(`\n✅ 완료: ${updated}/${rows.length}개 업데이트`);
}

main();
