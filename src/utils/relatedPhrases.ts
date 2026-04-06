import { Chunk } from "@/types/chunk";

// 영어 기능어 — 유사도 계산에서 제외
const EN_STOP_WORDS = new Set([
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

// 한국어 조사·어미·기능어 — 의미어만 남기기 위해 제거
const KO_PARTICLES = /[은는이가을를의에서로으로와과도만까지부터마다처럼같이보다한]{1,2}$/;
const KO_STOP_WORDS = new Set([
  "하다", "되다", "있다", "없다", "않다", "이다",
  "것", "수", "등", "때", "중", "더", "잘", "못",
  "매우", "아주", "정말", "너무", "약간", "좀",
  "그", "이", "저", "그것", "이것",
]);

function tokenizeEn(phrase: string): string[] {
  return phrase.toLowerCase().split(/\s+/).filter((w) => !EN_STOP_WORDS.has(w));
}

function tokenizeKo(meaning: string): string[] {
  return meaning
    .replace(/[~,.()"'!?]/g, " ")
    .split(/\s+/)
    .map((w) => w.replace(KO_PARTICLES, ""))
    .filter((w) => w.length > 0 && !KO_STOP_WORDS.has(w));
}

function calcScore(targetTokens: string[], candidateTokens: string[]) {
  const shared = targetTokens.filter((t) => candidateTokens.includes(t)).length;
  const shorter = Math.min(targetTokens.length, candidateTokens.length);
  const ratio = shorter > 0 ? shared / shorter : 0;
  return { shared, ratio };
}

type Mode = "kr-to-en" | "en-to-kr";

/**
 * 모드별로 비교 기준을 바꿔 유사 표현을 찾는다.
 * - 한→영: 한국어 meaning 토큰 겹침 (같은 뜻 다른 표현 포착)
 * - 영→한: 영어 phrase 토큰 겹침 (비슷한 형태 다른 뜻 포착)
 */
export function findRelatedPhrases(
  target: Chunk,
  allChunks: Chunk[],
  mode: Mode = "en-to-kr",
  maxResults = 3
): Chunk[] {
  const isKrMode = mode === "kr-to-en";

  const targetTokens = isKrMode
    ? tokenizeKo(target.meaning)
    : tokenizeEn(target.phrase);

  if (targetTokens.length === 0) return [];

  return allChunks
    .filter((c) => c.id !== target.id && !c.mastered)
    .map((c) => {
      const tokens = isKrMode ? tokenizeKo(c.meaning) : tokenizeEn(c.phrase);
      const { shared, ratio } = calcScore(targetTokens, tokens);
      return { chunk: c, score: shared, ratio };
    })
    .filter(({ score, ratio }) => score >= 2 || (score >= 1 && ratio >= 0.5))
    .sort((a, b) => b.score - a.score || b.ratio - a.ratio)
    .slice(0, maxResults)
    .map(({ chunk }) => chunk);
}
