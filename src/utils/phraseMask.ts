/**
 * example_ko에 포함된 [[...]] 마커를 파싱 (다중 마커 지원).
 * 반환: { clean: 마커 제거된 텍스트, ranges: [{ start, end }, ...] } — 마커 없으면 null
 */
export function parseKoHighlight(text: string): { clean: string; ranges: Array<{ start: number; end: number }> } | null {
  const pattern = /\[\[(.+?)\]\]/g;
  if (!pattern.test(text)) return null;
  pattern.lastIndex = 0;

  const ranges: Array<{ start: number; end: number }> = [];
  let clean = "";
  let lastIdx = 0;
  let offset = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    clean += text.slice(lastIdx, match.index);
    const start = match.index - offset;
    const content = match[1];
    clean += content;
    ranges.push({ start, end: start + content.length });
    offset += 4; // [[ and ]]
    lastIdx = match.index + match[0].length;
  }
  clean += text.slice(lastIdx);

  return ranges.length > 0 ? { clean, ranges } : null;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * example_sentence에서 phrase를 단어 수에 맞는 빈칸으로 치환.
 * 매칭 실패 시 null 반환 → 호출 측에서 fallback 처리.
 */
export function maskPhraseInSentence(sentence: string, phrase: string): string | null {
  const trimmed = phrase.trim();
  const wordCount = trimmed.split(/\s+/).length;
  const blank = Array(wordCount).fill("_____").join(" ");

  // Tier 1: exact word-boundary match (case-insensitive)
  const exactPattern = new RegExp(`\\b${escapeRegex(trimmed)}\\b`, "i");
  if (exactPattern.test(sentence)) {
    return sentence.replace(exactPattern, blank);
  }

  // Tier 2: last token as wildcard (굴절형 — took/taking/tries)
  const tokens = trimmed.split(/\s+/);
  if (tokens.length >= 1) {
    const prefix = tokens.slice(0, -1).map(escapeRegex).join("\\s+");
    const flexPattern = prefix
      ? new RegExp(`\\b${prefix}\\s+\\w+\\b`, "i")
      : new RegExp(`\\b${escapeRegex(tokens[0])}\\w*\\b`, "i");
    if (flexPattern.test(sentence)) {
      return sentence.replace(flexPattern, blank);
    }
  }

  // Tier 3: case-insensitive substring (no word boundary)
  const subPattern = new RegExp(escapeRegex(trimmed), "i");
  if (subPattern.test(sentence)) {
    return sentence.replace(subPattern, blank);
  }

  return null;
}

/**
 * 한국어 텍스트(haystack) 안에서 needle(meaning)의 위치를 찾아 [start, end] 반환.
 * 매칭 실패 시 null 반환.
 */
export function findKoreanHighlightRange(
  haystack: string,
  needle: string
): [number, number] | null {
  if (!needle || !haystack) return null;

  const normalize = (s: string) => s.replace(/\s+/g, "").trim();
  const H = normalize(haystack);
  const N = normalize(needle);

  // 정규화된 인덱스 → 원문 인덱스 변환
  const restoreIndex = (normalizedIdx: number): number => {
    let count = 0;
    for (let i = 0; i < haystack.length; i++) {
      if (!/\s/.test(haystack[i])) {
        if (count === normalizedIdx) return i;
        count++;
      }
    }
    return haystack.length;
  };

  const tryMatch = (norm: string): [number, number] | null => {
    const idx = H.indexOf(norm);
    if (idx < 0) return null;
    const start = restoreIndex(idx);
    const end = restoreIndex(idx + norm.length - 1) + 1;
    return [start, end];
  };

  // Tier 1: exact normalized match
  const exact = tryMatch(N);
  if (exact) return exact;

  // Tier 2: 어미 제거 후 재시도 (2글자 이상 stem)
  const endings = ["었어요", "았어요", "었어", "았어", "어요", "아요", "이에요", "예요", "이야", "이다", "다", "어", "아", "요", "함"];
  for (const ending of endings) {
    if (N.endsWith(ending) && N.length - ending.length >= 2) {
      const stem = N.slice(0, N.length - ending.length);
      const result = tryMatch(stem);
      if (result) return result;
    }
  }

  // Tier 3: prefix 2~4글자 매칭
  for (let len = Math.min(4, N.length); len >= 2; len--) {
    const prefix = N.slice(0, len);
    const result = tryMatch(prefix);
    if (result) return result;
  }

  // Tier 4: 첫 단어 + 마지막 단어 앵커 매칭 (meaning과 example_ko 단어가 달라도 범위 추정)
  // 예: meaning="가속화되는 호황 속에서", text="가속화되는 붐 속에서" → 첫("가속화되는")+끝("속에서")로 범위 특정
  const needleWords = needle.trim().split(/\s+/).filter(Boolean);
  if (needleWords.length >= 2) {
    const firstNorm = normalize(needleWords[0]);
    const lastNorm = normalize(needleWords[needleWords.length - 1]);
    const firstIdx = H.indexOf(firstNorm);
    if (firstIdx >= 0) {
      const lastIdx = H.indexOf(lastNorm, firstIdx + firstNorm.length);
      if (lastIdx >= 0) {
        const start = restoreIndex(firstIdx);
        const end = restoreIndex(lastIdx + lastNorm.length - 1) + 1;
        return [start, end];
      }
    }
  }

  return null;
}
