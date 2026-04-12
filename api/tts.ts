import { checkUsage, recordUsage } from "./_lib/checkUsage.js";

export const config = { runtime: "edge" };

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const usageCheck = await checkUsage(req, "tts");
  if ("response" in usageCheck) return usageCheck.response;
  const { userId } = usageCheck.result;

  try {
    const { text } = await req.json();
    if (!text || typeof text !== "string") {
      return new Response("text required", { status: 400 });
    }

    const response = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "tts-1",
        voice: "nova",
        input: text.slice(0, 500),
      }),
    });

    if (!response.ok) {
      return new Response("TTS 실패", { status: 500 });
    }

    const audio = await response.arrayBuffer();

    await recordUsage(userId, "tts");

    return new Response(audio, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch {
    return new Response(JSON.stringify({ error: "TTS 실패" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
