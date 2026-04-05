import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { url } = req.body ?? {};
  if (!url) return res.status(400).json({ error: "URL is required" });

  const match = url.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/
  );
  if (!match) return res.status(400).json({ error: "Invalid YouTube URL" });

  const videoId = match[1];

  try {
    const { YoutubeTranscript } = await import("youtube-transcript");
    const segments = await YoutubeTranscript.fetchTranscript(videoId, { lang: "en" });

    if (!segments || segments.length === 0) {
      return res.status(404).json({ error: "이 영상에서 영어 자막을 찾을 수 없습니다" });
    }

    const transcript = segments.map((s: any) => s.text).join(" ");
    return res.status(200).json({ transcript });
  } catch (err: any) {
    console.error("YouTube transcript error:", err?.message);

    if (err?.message?.includes("disabled") || err?.message?.includes("not available")) {
      return res.status(404).json({ error: "이 영상에서 영어 자막을 찾을 수 없습니다" });
    }
    if (err?.message?.includes("unavailable")) {
      return res.status(404).json({ error: "이 영상을 사용할 수 없습니다" });
    }
    if (err?.message?.includes("too many requests") || err?.message?.includes("captcha")) {
      return res.status(429).json({ error: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요" });
    }

    return res.status(500).json({ error: "자막을 불러오는 중 오류가 발생했습니다" });
  }
}
