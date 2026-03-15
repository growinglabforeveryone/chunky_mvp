import { Chunk } from "@/types/chunk";

// 의미 없는 문법어 — 유사도 계산에서 제외
const STOP_WORDS = new Set([
  "a", "an", "the", "to", "of", "in", "at", "for", "on", "with",
  "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did",
  "will", "would", "could", "should", "may", "might",
  "it", "its", "this", "that", "i", "we", "you", "he", "she", "they",
]);

function tokenize(phrase: string): string[] {
  return phrase.toLowerCase().split(/\s+/).filter((w) => !STOP_WORDS.has(w));
}

/**
 * 주어진 chunk와 유사한 표현을 savedChunks에서 찾아 반환.
 * 유사도 기준: 핵심 단어(내용어) 공유 수
 */
export function findRelatedPhrases(
  target: Chunk,
  allChunks: Chunk[],
  maxResults = 3
): Chunk[] {
  const targetTokens = tokenize(target.phrase);
  if (targetTokens.length === 0) return [];

  return allChunks
    .filter((c) => c.id !== target.id && !c.mastered)
    .map((c) => {
      const tokens = tokenize(c.phrase);
      const shared = targetTokens.filter((t) => tokens.includes(t)).length;
      return { chunk: c, score: shared };
    })
    .filter(({ score }) => score >= 1)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults)
    .map(({ chunk }) => chunk);
}
