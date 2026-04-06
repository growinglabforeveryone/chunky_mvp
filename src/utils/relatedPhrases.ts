import { Chunk } from "@/types/chunk";

// 의미 없는 문법어 — 유사도 계산에서 제외
const STOP_WORDS = new Set([
  // 관사·한정사
  "a", "an", "the", "this", "that", "these", "those", "my", "your", "his", "her",
  "our", "their", "its", "some", "any", "no", "every", "each", "all", "both",
  // 전치사
  "to", "of", "in", "at", "for", "on", "with", "from", "by", "about",
  "into", "through", "over", "under", "between", "after", "before", "during",
  "without", "against", "along", "among", "around", "beyond", "toward", "towards",
  "upon", "within", "across", "behind", "below", "beside", "outside", "inside",
  // be·조동사
  "is", "are", "was", "were", "be", "been", "being", "am",
  "have", "has", "had", "do", "does", "did",
  "will", "would", "could", "should", "may", "might", "shall", "can", "must",
  // 대명사
  "i", "we", "you", "he", "she", "it", "they", "me", "us", "him", "them",
  "who", "whom", "whose", "which", "what", "where", "when", "how", "why",
  "myself", "yourself", "himself", "herself", "itself", "ourselves", "themselves",
  // 접속사·부사
  "and", "or", "but", "nor", "so", "yet", "if", "then", "than",
  "not", "no", "just", "also", "very", "too", "quite", "really", "even",
  "still", "already", "ever", "never", "always", "often", "here", "there",
  // 기타 고빈도 기능어
  "get", "got", "gets", "getting", "go", "goes", "went", "gone", "going",
  "make", "makes", "made", "making", "take", "takes", "took", "taken", "taking",
  "come", "comes", "came", "coming", "give", "gives", "gave", "given", "giving",
  "keep", "keeps", "kept", "keeping", "let", "put", "set", "seem", "need",
  "up", "out", "off", "down", "away", "back",
  "one", "ones", "thing", "things", "way", "much", "many", "more", "most",
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
      const shorter = Math.min(targetTokens.length, tokens.length);
      const ratio = shorter > 0 ? shared / shorter : 0;
      return { chunk: c, score: shared, ratio };
    })
    .filter(({ score, ratio }) => score >= 2 || (score >= 1 && ratio >= 0.5))
    .sort((a, b) => b.score - a.score || b.ratio - a.ratio)
    .slice(0, maxResults)
    .map(({ chunk }) => chunk);
}
