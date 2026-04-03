import Anthropic from "@anthropic-ai/sdk";

export const config = { runtime: "edge" };

interface Correction {
  original_phrase: string;
  corrected_phrase: string;
  explanation: string;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const { text } = await req.json();

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: `You are a friendly English coach for Korean learners.

The user spoke or typed the following English. Correct it to sound natural, then explain what you changed and why.

Rules:
- If the input is already natural, return it as-is with an empty corrections array
- Keep the user's intended meaning and tone
- Correct grammar, word choice, and phrasing to sound natural
- Do NOT over-correct or make it sound overly formal unless the original was formal
- Explanations should be in Korean, 1-2 sentences each
- encouragement should be in Korean, warm and specific about what the user did well

Return ONLY valid JSON (no markdown, no explanation outside JSON):
{
  "corrected": "The full corrected text",
  "corrections": [
    {
      "original_phrase": "what the user wrote",
      "corrected_phrase": "natural version",
      "explanation": "왜 이렇게 고쳤는지 한국어 설명"
    }
  ],
  "encouragement": "잘한 부분에 대한 격려 한마디"
}

User's English:
${text}`,
        },
      ],
    });

    const content = message.content[0];
    if (content.type !== "text") throw new Error("Unexpected response type");

    const jsonText = content.text
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();

    const result = JSON.parse(jsonText);

    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: "교정 실패" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
