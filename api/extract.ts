import { GoogleGenerativeAI } from "@google/generative-ai";
import { checkUsage, recordUsage } from "./_lib/checkUsage";

export const config = { runtime: "edge" };

interface RawChunk {
  word_phrase: string;
  korean_meaning: string;
  example_sentence: string;
  reuse_example: string;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // Usage check (free: 20/month)
  const usageCheck = await checkUsage(req, "extract");
  if ("response" in usageCheck) return usageCheck.response;
  const { userId } = usageCheck.result;

  try {
    const { text } = await req.json();

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

    const result = await model.generateContent(`You are an English vocabulary chunk extractor for Korean learners.

From the given English text, extract 5~8 useful "word chunks" — 2-5 word phrases that serve as reusable grammatical frames.

Rules:
- ONLY extract phrases that appear VERBATIM in the text — exact characters, tense, spelling, word form
- DO NOT modify word forms (e.g. "entering" → "entered")
- DO NOT extract single words or full sentences
- The word_phrase must be 2-5 consecutive words exactly as they appear in the text
- DO NOT include the grammatical subject (e.g. extract "is built for", NOT "the world is built for")
- DO NOT end a chunk with an article (a, an, the). "is driving a" is WRONG because it ends in the article "a"; you must extend the chunk to include the following noun, or pick a different chunk
- Ending with a preposition IS fine when the preposition is part of the frame: "looking forward to", "face a mix of", "gap between", "a widening gap between" are all valid
- DO NOT include topic-specific content nouns at the end of a chunk when they reduce reusability — extract the structural frame instead:
  BAD:  "gap between investment" — ends in the content noun "investment", ties the chunk to one topic
  GOOD: "a widening gap" or "gap between" or "a widening gap between" — reusable in any context
  BAD:  "inflating a bubble" — too topic-specific; if you must include it, only use it if the collocation itself (inflate + bubble) is the learning point
- The chunk must be a genuine reusable building block: verb collocation, prepositional phrase, fixed expression, or noun phrase pattern
- Good examples: "are split between", "in the wake of", "a widening gap between", "face a mix of", "looking forward to", "trigger a sharp"
- Bad examples: "is driving a" (ends in article — extend or skip), "gap between investment" (content noun reduces reusability), "the world is built for" (subject included)
- Focus on chunks useful for professional/work contexts

NESTED CHUNKS: When a longer phrase contains two independently learnable sub-chunks, extract BOTH as separate entries sharing the same example_sentence.
  Example — from "investors face a mix of signals":
    Entry 1: "face a mix of"     → verb frame (how "face" collocates)
    Entry 2: "a mix of signals"  → domain noun collocation (business/finance pattern)
  Only split when BOTH sub-chunks have clear independent reuse value. Do not split artificially.

For korean_meaning: translate ONLY the chunk itself — do NOT add words that are not part of the chunk.
  BAD:  chunk="face a mix of", meaning="~의 혼합된 신호들에 직면하다" (신호들 is NOT in the chunk)
  GOOD: chunk="face a mix of", meaning="~의 혼합에 직면하다"

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
${text}`);

    const jsonText = result.response.text()
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();

    const raw: RawChunk[] = JSON.parse(jsonText);

    const chunks = raw
      .filter((item) =>
        new RegExp(item.word_phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(text)
      )
      .map((item) => ({
        id: crypto.randomUUID(),
        phrase: item.word_phrase,
        meaning: item.korean_meaning,
        exampleSentence: item.example_sentence,
        reuseExample: item.reuse_example,
        sourceText: text.slice(0, 300),
        createdAt: new Date().toISOString(),
      }));

    // Record usage after success
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
