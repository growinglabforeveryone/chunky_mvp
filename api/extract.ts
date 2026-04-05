import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";
import { checkUsage, recordUsage } from "./_lib/checkUsage.js";

export const config = { runtime: "edge" };

interface RawChunk {
  word_phrase: string;
  korean_meaning: string;
  example_sentence: string;
  reuse_example: string;
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
3. B2-C1 difficulty — REJECT trivially easy phrases made of only basic vocabulary
   BAD: "thank you very", "how much you", "learned from him", "think about that"
   These fail because any beginner already knows every word and the combination
4. NO grammatical subject at the start ("the world is built for" → use "is built for")
5. NO article (a/an/the) at the END — "was given a" is WRONG; use "was given" or extend to next noun
6. DO NOT end with a topic-specific content noun that kills reusability
   BAD: "championing education, medical" — comma mid-phrase, too topic-specific
   GOOD: "championing education" or just pick a cleaner chunk
7. Prioritize: verb+noun collocations, prepositional frames, fixed idioms, passive constructions
8. Focus on expressions useful across professional contexts

For korean_meaning: translate ONLY the chunk, no extra words.

Return ONLY a valid JSON array (no markdown):
[
  {
    "word_phrase": "raise serious questions about",
    "korean_meaning": "~에 대해 심각한 의문을 제기하다",
    "example_sentence": "The exact sentence from the text where this chunk appears.",
    "reuse_example": "The scandal raised serious questions about corporate governance."
  }
]

Text to analyze:
${text}`;

/** 텍스트를 문장 경계 기준으로 N개 구간에 균등 분배 */
function sampleSegments(text: string, segmentChars: number, count: number): string[] {
  if (text.length <= segmentChars) return [text];

  const step = Math.floor(text.length / count);
  const segments: string[] = [];

  for (let i = 0; i < count; i++) {
    const start = i * step;
    let end = start + segmentChars;
    // 문장 끝(. ! ?)에서 자르기
    const boundary = text.slice(end, end + 200).search(/[.!?]/);
    if (boundary !== -1) end = end + boundary + 1;
    segments.push(text.slice(start, Math.min(end, text.length)));
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

/** 중복 청크 제거: phrase가 이미 있는 다른 phrase의 부분 문자열이면 제거 */
function deduplicateChunks(chunks: RawChunk[]): RawChunk[] {
  const seen = new Set<string>();
  return chunks.filter((c) => {
    const key = c.word_phrase.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    // 1200자씩 최대 4구간 균등 분배 → 병렬 추출
    const SEGMENT_CHARS = 1200;
    const MAX_SEGMENTS = 4;
    const segments = sampleSegments(text, SEGMENT_CHARS, Math.min(MAX_SEGMENTS, Math.ceil(text.length / SEGMENT_CHARS)));

    const rawArrays = await Promise.all(segments.map((seg) => extractFromSegment(model, seg)));
    const allRaw = deduplicateChunks(rawArrays.flat());

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
      .slice(0, 12)
      .map((item) => ({
        id: crypto.randomUUID(),
        phrase: item.word_phrase,
        meaning: item.korean_meaning,
        exampleSentence: item.example_sentence,
        reuseExample: item.reuse_example,
        sourceText: text.slice(0, 300),
        createdAt: new Date().toISOString(),
      }));

    await recordUsage(userId, "extract");

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
