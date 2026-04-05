import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";
import { checkUsage, recordUsage } from "./_lib/checkUsage.js";

export const config = { runtime: "edge" };

interface RawChunk {
  word_phrase: string;
  korean_meaning: string;
  example_sentence: string;
  reuse_example: string;
}

const PROMPT = (text: string) => `You are an English vocabulary chunk extractor for Korean learners.

From the given English text, extract 3~5 useful "word chunks" — 2-5 word phrases that serve as reusable grammatical frames.

Rules:
- ONLY extract phrases that appear VERBATIM in the text — exact characters, tense, spelling, word form
- DO NOT modify word forms (e.g. "entering" → "entered")
- DO NOT extract single words or full sentences
- The word_phrase must be 2-5 consecutive words exactly as they appear in the text
- DO NOT include the grammatical subject (e.g. extract "is built for", NOT "the world is built for")
- DO NOT end a chunk with an article (a, an, the)
- Ending with a preposition IS fine: "looking forward to", "face a mix of", "gap between" are valid
- DO NOT include topic-specific content nouns at the end when they reduce reusability
- The chunk must be a genuine reusable building block: verb collocation, prepositional phrase, fixed expression, or noun phrase pattern
- Focus on chunks useful for professional/work contexts

For korean_meaning: translate ONLY the chunk itself.

Return ONLY a valid JSON array (no explanation, no markdown):
[
  {
    "word_phrase": "are split between",
    "korean_meaning": "~와 ~ 사이에서 의견이 갈리다",
    "example_sentence": "The exact sentence from the text where this chunk appears.",
    "reuse_example": "Experts are split between optimism and caution."
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
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

    // 1200자씩 최대 4구간 균등 분배 → 병렬 추출
    const SEGMENT_CHARS = 1200;
    const MAX_SEGMENTS = 4;
    const segments = sampleSegments(text, SEGMENT_CHARS, Math.min(MAX_SEGMENTS, Math.ceil(text.length / SEGMENT_CHARS)));

    const rawArrays = await Promise.all(segments.map((seg) => extractFromSegment(model, seg)));
    const allRaw = deduplicateChunks(rawArrays.flat());

    // verbatim 검증은 전체 텍스트 기준
    const chunks = allRaw
      .filter((item) =>
        new RegExp(item.word_phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(text)
      )
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
