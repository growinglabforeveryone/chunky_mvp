import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";
import { checkUsage, recordUsage } from "./_lib/checkUsage.js";

export const config = { runtime: "edge" };

interface RawChunk {
  word_phrase: string;
  korean_meaning: string;
  example_sentence: string;
  example_ko: string;
}

const PROMPT = (text: string) => `You are an expert English vocabulary chunk extractor for Korean business professionals.

Extract 3~5 word chunks from the text. A chunk is a 2-5 word phrase a Korean learner should memorize as a unit.

TARGET QUALITY — these are examples of GOOD chunks (B2-C1 level):
"force someone to abandon", "financial toll", "spark creativity", "with a range of perspectives",
"backed by", "marking a major step forward in", "raise serious questions about",
"face regulatory hurdles", "hail A as a breakthrough", "weather the storm",
"coincides with", "reportedly in talks", "are split between", "in the wake of"

Notice: these are collocations, fixed expressions, or prepositional frames — not random word sequences.

STRICT RULES:
1. VERBATIM only — exact words, tense, spelling as they appear in the text
2. NO single words, NO full sentences
3. B2-C1 difficulty — REJECT phrases a Korean intermediate learner already knows intuitively.
   The test: "Would a B1 learner need to memorize this as a unit, or do they already know it?"
   BAD (too easy — meaning is obvious from individual words):
     "compete with", "report to", "difficult for", "part of the success",
     "may not be so simple", "talk about", "think about that", "deal with"
   GOOD (non-obvious collocation, idiom, or fixed expression worth memorizing):
     "wind down" (non-literal: 서서히 줄이다/마무리하다),
     "struck a deal" (collocation, not just "made a deal"),
     "clawed at the door" (vivid idiom),
     "an undisclosed amount" (formal fixed expression),
     "remain editorially independent" (collocation in media/business context)
4. NO grammatical subject at the start ("the world is built for" → use "is built for")
5. NO article (a/an/the) at the END — "was given a" is WRONG; use "was given" or extend to next noun
6. DO NOT end with a topic-specific content noun that kills reusability
   BAD: "championing education, medical" — comma mid-phrase, too topic-specific
   GOOD: "championing education" or just pick a cleaner chunk
7. Prioritize: verb+noun collocations, prepositional frames, fixed idioms, passive constructions
8. Focus on expressions useful across professional contexts
9. PROPER NOUN BOUNDARY RULE — never include proper nouns (company/person/place/product names) inside a chunk.
   If a good collocation is adjacent to a proper noun, CUT at the boundary and extract only the generic part.
   BAD: "struck a deal with the Pentagon" — proper noun inside
   GOOD: "struck a deal with" — cut at proper noun boundary
   BAD: "acquired by Google", "oversees OpenAI's communications"
   GOOD: "acquired by", "oversees communications"
   If trimming a proper noun leaves fewer than 2 words and no reusable expression, skip the chunk entirely.
10. Distribute extraction across the FULL article — beginning, middle, AND end. Do not concentrate on one section.

For korean_meaning: translate the literal meaning of the chunk IN ISOLATION — as if you saw it with no surrounding sentence. Do NOT include words from the surrounding context.
BAD (context leaked):
  "clawed at the door" → "~와 대화하려고 매우 애썼다"  ✗  ("대화하려고" comes from the sentence, not the chunk)
  "in the wake of" → "이 사건 이후에"  ✗  ("이 사건" is context)
GOOD (chunk only):
  "clawed at the door" → "안달하다, 필사적으로 매달리다"  ✓
  "in the wake of" → "~의 여파로, ~ 이후에"  ✓
  "reach out to" → "~에게 연락하다"  ✓

For example_sentence: find the sentence in the text that contains the chunk, then trim it by removing noise that does NOT affect understanding of the chunk:
- Appositive phrases naming specific people/places (e.g., ", John Coogan and Jordi Hays,")
- Parenthetical asides unrelated to the chunk (e.g., ", which airs online three hours a day, five days a week,")
- Relative clauses that only add background detail irrelevant to the chunk
KEEP: the chunk verbatim, the subject, main verb, and any context needed to understand how the chunk is used.
Do NOT invent or paraphrase — only remove noise from the original. Aim for a natural, complete sentence. No strict word limit; advanced sentences can stay longer if the context is needed.

Trimming examples:
- ORIGINAL: "They have embraced the 'TBPN' hosts, John Coogan and Jordi Hays, who often speak optimistically about technology on their show, which airs online three hours a day, five days a week."
  TRIMMED:  "They have embraced the 'TBPN' hosts who often speak optimistically about technology."
- ORIGINAL: "The deal was a marketing move by OpenAI, which, along with the rest of the A.I. industry, has faced intensifying criticism over the transformation that the technology could bring."
  TRIMMED:  "OpenAI, along with the rest of the A.I. industry, has faced intensifying criticism over the transformation that the technology could bring."
- ORIGINAL: "Sarah Chen, the firm's chief economist since 2019, warned that rising interest rates could slow growth."
  TRIMMED:  "Sarah Chen warned that rising interest rates could slow growth."

For example_ko: provide a natural Korean translation of the TRIMMED example_sentence.
- Wrap ONLY the Korean word(s) that correspond to the English chunk in [[ and ]]
- If the Korean equivalent is discontinuous (split by a content noun not in the chunk), use MULTIPLE [[ ]] pairs:
  chunk "look like yet another" → "[[또 다른]] 환경 보호 조치[[처럼 보일]] 수도 있다."
  NOT: "[[또 다른 환경 보호 조치처럼 보일]] 수도 있다." (includes "환경 보호 조치" which is NOT in the chunk)
- Do NOT include content nouns inside [[ ]] if they are not part of the English chunk
- MARKER SIZE RULE: total marked text must be close in length to korean_meaning. Never over-mark.
  BAD: chunk "close to the problem", meaning "문제에 가깝다" → "[[중 상당수에 놀라울 정도로 가깝습니다]]" (너무 넓음 — chunk에 없는 "상당수", "놀라울 정도로" 포함)
  GOOD: chunk "close to the problem", meaning "문제에 가깝다" → "[[문제들]]에 [[가깝습니다]]"
- Translate naturally — a Korean reader should feel it is native Korean
- Match the register (formal/casual) of the English source
- Do NOT leak English words (keep proper nouns/brands in English only)
- Do NOT add explanations or extra brackets
- One sentence with natural Korean punctuation

Return ONLY a valid JSON array (no markdown):
[
  {
    "word_phrase": "raise serious questions about",
    "korean_meaning": "~에 대해 심각한 의문을 제기하다",
    "example_sentence": "The scandal raised serious questions about corporate governance.",
    "example_ko": "그 스캔들은 기업 거버넌스에 대해 [[심각한 의문을 제기했다]]."
  }
]

Text to analyze:
${text}`;

/** 텍스트를 문장 경계 기준으로 앞에서부터 연속으로 분할 (빈틈 없음) */
function splitSegments(text: string, segmentChars: number, maxSegments: number): string[] {
  if (text.length <= segmentChars) return [text];

  const segments: string[] = [];
  let pos = 0;

  while (pos < text.length && segments.length < maxSegments) {
    let end = pos + segmentChars;
    if (end < text.length) {
      // 문장 끝(. ! ?)에서 자르기
      const boundary = text.slice(end, end + 200).search(/[.!?]/);
      if (boundary !== -1) end = end + boundary + 1;
    } else {
      end = text.length;
    }
    segments.push(text.slice(pos, end));
    pos = end;
  }

  return segments;
}

async function extractFromSegment(model: GenerativeModel, segment: string): Promise<RawChunk[]> {
  try {
    const result = await model.generateContent(PROMPT(segment));
    const jsonText = result.response.text()
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();
    return JSON.parse(jsonText) as RawChunk[];
  } catch {
    return [];
  }
}

const FALLBACK_PROMPT = (text: string) => `You are an English vocabulary extractor for Korean learners.

Extract 1~3 useful word chunks from the text. Be lenient — include collocations, idioms, or multi-word expressions that a Korean learner would benefit from memorizing, even if they seem relatively simple.

RULES:
1. VERBATIM only — exact words as they appear in the text
2. NO single words, NO full sentences
3. At least 2 words per chunk
4. NO article (a/an/the) at the END

For korean_meaning: translate ONLY the chunk, no extra words.
For example_sentence: copy the EXACT sentence from the text that contains the chunk.
For example_ko: natural Korean translation of example_sentence with [[markers]] around the phrase equivalent.

Return ONLY a valid JSON array (no markdown):
[{"word_phrase":"...","korean_meaning":"...","example_sentence":"...","example_ko":"...[[highlighted]]..."}]

Text:
${text}`;

async function extractFallback(model: GenerativeModel, text: string): Promise<RawChunk[]> {
  try {
    const result = await model.generateContent(FALLBACK_PROMPT(text));
    const jsonText = result.response.text()
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();
    return JSON.parse(jsonText) as RawChunk[];
  } catch {
    return [];
  }
}

/**
 * 원문에서 phrase가 포함된 실제 문장을 찾아 반환.
 * 마침표 뒤에 공백+대문자가 오는 경우만 문장 끝으로 인식 → "A.I." 같은 약어 오분리 방지.
 */
function findSourceSentence(text: string, phrase: string): string | null {
  const sentences = text.split(/(?<=[.!?])\s+(?=[A-Z"'])/).map((s) => s.trim()).filter(Boolean);
  const lower = phrase.toLowerCase();
  const found = sentences.find((s) => s.toLowerCase().includes(lower));
  return found ?? null;
}

/**
 * example_ko의 [[ ]] 마커가 korean_meaning 대비 너무 넓은지 검증.
 * 마커 내 총 글자수가 meaning의 2.5배 초과이면 false 반환.
 */
function isKoMarkerValid(exampleKo: string, koreanMeaning: string): boolean {
  const markerPattern = /\[\[(.+?)\]\]/g;
  let totalMarked = 0;
  let match: RegExpExecArray | null;
  while ((match = markerPattern.exec(exampleKo)) !== null) {
    totalMarked += match[1].length;
  }
  if (totalMarked === 0) return true;
  const meaningLen = koreanMeaning.replace(/[~,\s]/g, "").length;
  if (meaningLen === 0) return true;
  return totalMarked <= meaningLen * 2.5;
}

/**
 * Gemini가 트리밍한 예문에 chunk가 여전히 포함되어 있는지 검증.
 * 실패 시 원문 문장으로 fallback하고 example_ko는 undefined 처리.
 * 마커가 너무 넓으면 example_ko도 무효화.
 */
function validateAndFallback(
  item: RawChunk,
  sourceText: string
): { exampleSentence: string; exampleKo: string | undefined } {
  const phrase = item.word_phrase.toLowerCase();
  const trimmed = item.example_sentence?.trim() ?? "";

  // 트리밍된 예문에 chunk가 남아있으면 그대로 사용
  if (trimmed && trimmed.toLowerCase().includes(phrase)) {
    const rawKo = item.example_ko?.trim() || undefined;
    const exampleKo = rawKo && isKoMarkerValid(rawKo, item.korean_meaning) ? rawKo : undefined;
    if (rawKo && !exampleKo) {
      console.warn(`[extract] ko marker too wide for "${item.word_phrase}" — dropping markers`);
    }
    return { exampleSentence: trimmed, exampleKo };
  }

  // chunk 누락 → 원문 전체 문장으로 fallback, ko는 무효화
  console.warn(`[extract] chunk lost after trimming: "${item.word_phrase}" — falling back to source sentence`);
  const source = findSourceSentence(sourceText, item.word_phrase);
  return { exampleSentence: source ?? trimmed, exampleKo: undefined };
}

/** 중복 청크 제거 */
function deduplicateChunks(chunks: RawChunk[]): RawChunk[] {
  const seen = new Set<string>();
  return chunks.filter((c) => {
    const key = c.word_phrase.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * 고유명사 포함 청크 필터.
 * 첫 번째 단어 이후에 대문자로 시작하는 단어가 있으면 고유명사로 판단.
 */
function hasProperNoun(phrase: string): boolean {
  const words = phrase.trim().split(/\s+/);
  for (let i = 1; i < words.length; i++) {
    const w = words[i].replace(/[''s.,]/g, "");
    if (w.length > 1 && /^[A-Z]/.test(w) && w !== "I") return true;
  }
  return false;
}

/**
 * 구간별 결과에서 round-robin으로 최대 maxTotal개 선택.
 * 각 구간에서 최소 1개 보장, 앞쪽 구간 편중 방지.
 */
function roundRobinSelect(arrays: RawChunk[][], maxTotal: number): RawChunk[] {
  const result: RawChunk[] = [];
  const seen = new Set<string>();
  let round = 0;

  while (result.length < maxTotal) {
    let anyAdded = false;
    for (const arr of arrays) {
      if (round < arr.length) {
        const chunk = arr[round];
        const key = chunk.word_phrase.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          result.push(chunk);
          anyAdded = true;
          if (result.length >= maxTotal) return result;
        }
      }
    }
    if (!anyAdded) break;
    round++;
  }

  return result;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const usageCheck = await checkUsage(req, "extract");
  if ("response" in usageCheck) return usageCheck.response;
  const { userId } = usageCheck.result;

  try {
    const { text: rawText } = await req.json();
    const text = typeof rawText === "string" ? rawText.trim() : "";
    if (!text) throw new Error("empty text");

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: { thinkingConfig: { thinkingBudget: 0 } } as never,
    });

    // 1500자씩 최대 8구간 연속 분할 → 병렬 추출 (기사 전체 커버)
    const SEGMENT_CHARS = 1500;
    const MAX_SEGMENTS = 8;
    const segments = splitSegments(text, SEGMENT_CHARS, MAX_SEGMENTS);

    const t0 = Date.now();
    const rawArrays = await Promise.all(segments.map((seg) => extractFromSegment(model, seg)));

    // 고유명사 필터 → 전체 pool 합산 (품질 기반, round-robin 없음)
    let allRaw = deduplicateChunks(
      rawArrays.flat().filter((c) => !hasProperNoun(c.word_phrase))
    );

    // 0개면 완화된 프롬프트로 재시도 (고유명사 필터 없이)
    if (allRaw.length === 0) {
      console.log(`[extract] 0 chunks — retrying with fallback prompt`);
      const fallbackRaw = await extractFallback(model, text);
      allRaw = deduplicateChunks(fallbackRaw);
    }
    console.log(`[extract] model=${model.model} segments=${segments.length} elapsed=${Date.now() - t0}ms chunks=${allRaw.length}`);

    // verbatim 검증 + 원문 등장 순서 정렬
    const chunks = allRaw
      .filter((item) =>
        new RegExp(item.word_phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(text)
      )
      .sort((a, b) => {
        const posA = text.toLowerCase().indexOf(a.word_phrase.toLowerCase());
        const posB = text.toLowerCase().indexOf(b.word_phrase.toLowerCase());
        return posA - posB;
      })
      .map((item) => {
        const { exampleSentence, exampleKo } = validateAndFallback(item, text);
        return {
          id: crypto.randomUUID(),
          phrase: item.word_phrase,
          meaning: item.korean_meaning,
          exampleSentence,
          exampleKo,
          sourceText: text.slice(0, 300),
          createdAt: new Date().toISOString(),
        };
      });

    if (chunks.length > 0) {
      await recordUsage(userId, "extract");
    }

    return new Response(JSON.stringify({ chunks }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: "추출 실패" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
