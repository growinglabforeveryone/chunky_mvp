import type { VercelRequest, VercelResponse } from "@vercel/node";
import { YoutubeTranscript } from "youtube-transcript";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: "URL is required" });
  }

  // Extract video ID
  const match = url.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/
  );
  if (!match) {
    return res.status(400).json({ error: "Invalid YouTube URL" });
  }

  const videoId = match[1];

  try {
    // Fetch transcript using youtube-transcript library
    const transcriptData = await YoutubeTranscript.fetchTranscript(videoId, {
      lang: "en",
    });

    if (!transcriptData || transcriptData.length === 0) {
      return res.status(404).json({ error: "이 영상에서 영어 자막을 찾을 수 없습니다" });
    }

    // Combine all transcript segments into one text
    const transcript = transcriptData.map((item) => item.text).join(" ");

    return res.status(200).json({ transcript });
  } catch (err: any) {
    console.error("YouTube transcript error:", err);

    // Handle specific errors
    if (err.message?.includes("Could not find captions")) {
      return res.status(404).json({ error: "이 영상에서 영어 자막을 찾을 수 없습니다" });
    }
    if (err.message?.includes("Video unavailable")) {
      return res.status(404).json({ error: "이 영상을 사용할 수 없습니다 (비공개 또는 삭제됨)" });
    }

    return res.status(500).json({ error: "자막을 불러오는 중 오류가 발생했습니다" });
  }
}
