import Anthropic from "@anthropic-ai/sdk";

export const config = { runtime: "edge" };

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const { phrase, meaning, example, userQuestion } = await req.json();
  if (!phrase || !userQuestion) {
    return new Response(JSON.stringify({ error: "missing fields" }), { status: 400 });
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 400,
    messages: [
      {
        role: "user",
        content: `You are an English tutor helping a Korean business professional understand a vocabulary chunk.

Chunk being reviewed:
- Expression: "${phrase}"
- Korean meaning: ${meaning}
- Example: "${example}"

Learner's question: ${userQuestion}

Respond in Korean. Be concise (3-5 sentences max). Focus on:
- Why their confusion makes sense (validate the confusion)
- The key difference or nuance they need to remember
- One concrete example to make it stick

Do NOT repeat the question. Go straight to the explanation.`,
      },
    ],
  });

  const content = message.content[0];
  if (content.type !== "text") {
    return new Response(JSON.stringify({ error: "unexpected response" }), { status: 500 });
  }

  return new Response(JSON.stringify({ answer: content.text }), {
    headers: { "Content-Type": "application/json" },
  });
}
