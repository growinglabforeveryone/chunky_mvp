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
  // 맥락에 따라 의미가 달라지는 고빈도 단어 — 단독으로 유사성 판단에 쓰기엔 너무 범용적
  "first", "last", "next", "new", "old", "good", "great", "big", "long", "little",
  "time", "times", "day", "days", "year", "years",
  "right", "left", "well", "better", "best", "own", "same", "different",
  "work", "works", "worked", "working", "say", "said", "says", "saying",
  "know", "known", "knew", "knowing", "think", "thought", "thinking",
  "look", "looked", "looking", "want", "wanted", "wanting",
  "people", "person", "someone", "something", "anything", "nothing",
  "like", "liked", "liking", "help", "helped", "helping",
]);

// 한국어 불용어 — 의미 매칭에서 제외
const KO_STOP_WORDS = new Set([
  "하다", "하는", "한", "했다", "해서", "하고", "하면", "하여", "되다", "된",
  "이다", "있다", "없다", "것", "수", "때", "나", "가", "을", "를", "은", "는",
  "이", "그", "저", "들", "도", "에", "의", "로", "으로", "와", "과", "또",
  "더", "잘", "못", "안", "매우", "너무", "좀", "약간", "정말", "아주",
]);

function tokenizeEn(phrase: string): string[] {
  return phrase.toLowerCase().split(/\s+/).filter((w) => !STOP_WORDS.has(w) && w.length > 1);
}

function tokenizeKo(meaning: string): string[] {
  // 2자 이상 명사/동사 어근 추출 (조사·불용어 제외)
  return meaning
    .split(/[\s,·\-~()（）]+/)
    .map((w) => w.replace(/[을를이가은는도에의로와과]/g, "").trim())
    .filter((w) => w.length >= 2 && !KO_STOP_WORDS.has(w));
}

/**
 * 주어진 chunk와 유사한 표현을 savedChunks에서 찾아 반환.
 * 유사도 기준:
 *   - 영어 내용어 공유 (가중치 1.0)
 *   - 한국어 뜻 키워드 공유 (가중치 1.5 — 의미 유사성이 더 신뢰도 높음)
 * 임계값: 복합 점수 >= 2.0 (단일 단어 매칭으로 통과 불가)
 */
export function findRelatedPhrases(
  target: Chunk,
  allChunks: Chunk[],
  maxResults = 3
): Chunk[] {
  const targetEnTokens = tokenizeEn(target.phrase);
  const targetKoTokens = tokenizeKo(target.meaning);

  if (targetEnTokens.length === 0 && targetKoTokens.length === 0) return [];

  return allChunks
    .filter((c) => c.id !== target.id && !c.mastered)
    .map((c) => {
      const enTokens = tokenizeEn(c.phrase);
      const koTokens = tokenizeKo(c.meaning);

      const enShared = targetEnTokens.filter((t) => enTokens.includes(t)).length;
      const koShared = targetKoTokens.filter((t) => koTokens.includes(t)).length;

      const score = enShared * 1.0 + koShared * 1.5;
      return { chunk: c, score, enShared, koShared };
    })
    .filter(({ score }) => score >= 2.0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults)
    .map(({ chunk }) => chunk);
}
