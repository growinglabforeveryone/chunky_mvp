/**
 * 기존 vocabulary 카드의 example_ko 마커([[...]]) 일괄 보정.
 * - 마커 없는 카드: findKoreanHighlightRange로 마커 추가
 * - 마커가 너무 넓거나(1.8배 초과) 너무 좁은(0.65배 미만) 카드: 재매칭 후 교체
 * 실행: node --env-file=.env.local scripts/fix-ko-markers.mjs
 */

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ── phraseMask.ts 로직 포팅 ────────────────────────────────────

function parseKoHighlight(text) {
  const pattern = /\[\[(.+?)\]\]/g;
  if (!pattern.test(text)) return null;
  pattern.lastIndex = 0;
  const ranges = [];
  let clean = "", lastIdx = 0, offset = 0, match;
  while ((match = pattern.exec(text)) !== null) {
    clean += text.slice(lastIdx, match.index);
    const start = match.index - offset;
    const content = match[1];
    clean += content;
    ranges.push({ start, end: start + content.length });
    offset += 4;
    lastIdx = match.index + match[0].length;
  }
  clean += text.slice(lastIdx);
  return ranges.length > 0 ? { clean, ranges } : null;
}

function normalize(s) {
  return s.replace(/\s+/g, "").trim();
}

function findKoreanHighlightRange(haystack, needle) {
  if (!needle || !haystack) return null;
  const H = normalize(haystack);
  const N = normalize(needle);

  const restoreIndex = (normIdx) => {
    let count = 0;
    for (let i = 0; i < haystack.length; i++) {
      if (!/\s/.test(haystack[i])) {
        if (count === normIdx) return i;
        count++;
      }
    }
    return haystack.length;
  };

  const tryMatch = (norm) => {
    const idx = H.indexOf(norm);
    if (idx < 0) return null;
    const start = restoreIndex(idx);
    const end = restoreIndex(idx + norm.length - 1) + 1;
    return [start, end];
  };

  // Tier 1: exact
  const exact = tryMatch(N);
  if (exact) return exact;

  // Tier 2: 어미 제거
  const endings = ["었어요","았어요","었어","았어","어요","아요","이에요","예요","이야","이다","다","어","아","요","함"];
  for (const ending of endings) {
    if (N.endsWith(ending) && N.length - ending.length >= 2) {
      const result = tryMatch(N.slice(0, N.length - ending.length));
      if (result) return result;
    }
  }

  // Tier 3: 첫 단어 + 마지막 단어 앵커
  const words = needle.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    const firstNorm = normalize(words[0]);
    const lastNorm = normalize(words[words.length - 1]);
    const firstIdx = H.indexOf(firstNorm);
    if (firstIdx >= 0) {
      const lastIdx = H.indexOf(lastNorm, firstIdx + firstNorm.length);
      if (lastIdx >= 0) {
        return [restoreIndex(firstIdx), restoreIndex(lastIdx + lastNorm.length - 1) + 1];
      }
    }
  }

  // Tier 4: prefix 2~4글자 (최후 수단)
  for (let len = Math.min(4, N.length); len >= 2; len--) {
    const result = tryMatch(N.slice(0, len));
    if (result) return result;
  }

  return null;
}

function addMarkers(cleanText, range) {
  const [start, end] = range;
  return cleanText.slice(0, start) + "[[" + cleanText.slice(start, end) + "]]" + cleanText.slice(end);
}

function shouldFix(exampleKo, meaning) {
  const parsed = parseKoHighlight(exampleKo);
  const meaningLen = meaning.replace(/[~,\s]/g, "").length;

  if (!parsed) return "no-marker";

  const totalHighlighted = parsed.ranges.reduce((s, r) => s + (r.end - r.start), 0);
  if (meaningLen > 0 && totalHighlighted > meaningLen * 1.8) return "too-wide";
  if (meaningLen > 0 && totalHighlighted < meaningLen * 0.65) return "too-narrow";
  return null;
}

// ── 메인 ──────────────────────────────────────────────────────

const { data: rows, error } = await supabase
  .from("vocabulary")
  .select("id, phrase, meaning, example_ko")
  .not("example_ko", "is", null)
  .not("meaning", "is", null);

if (error) { console.error(error); process.exit(1); }
console.log(`총 ${rows.length}개 카드 검사 중...\n`);

let fixed = 0, skipped = 0, failed = 0;

for (const row of rows) {
  const { id, phrase, meaning, example_ko } = row;
  const reason = shouldFix(example_ko, meaning);
  if (!reason) { skipped++; continue; }

  const parsed = parseKoHighlight(example_ko);
  const cleanText = parsed ? parsed.clean : example_ko;

  const range = findKoreanHighlightRange(cleanText, meaning);
  if (!range) {
    console.log(`[SKIP] "${phrase}" — 범위 찾기 실패 (reason: ${reason})`);
    failed++;
    continue;
  }

  const newKo = addMarkers(cleanText, range);

  const { error: updateError } = await supabase
    .from("vocabulary")
    .update({ example_ko: newKo })
    .eq("id", id);

  if (updateError) {
    console.log(`[ERR]  "${phrase}" — ${updateError.message}`);
    failed++;
  } else {
    console.log(`[FIX]  "${phrase}" (${reason})\n       전: ${example_ko}\n       후: ${newKo}\n`);
    fixed++;
  }
}

console.log(`\n완료: ${fixed}개 수정, ${skipped}개 정상, ${failed}개 실패`);
