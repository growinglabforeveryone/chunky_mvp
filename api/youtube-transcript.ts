import type { VercelRequest, VercelResponse } from "@vercel/node";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9",
};

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\n/g, " ");
}

async function fetchTranscript(videoId: string): Promise<string> {
  const pageRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
    headers: HEADERS,
  });

  if (!pageRes.ok) throw new Error("Video unavailable");

  const html = await pageRes.text();

  const jsonMatch = html.match(/ytInitialPlayerResponse\s*=\s*(\{.+?\})\s*;/s);
  if (!jsonMatch) throw new Error("Could not parse page data");

  let playerResponse: any;
  try {
    playerResponse = JSON.parse(jsonMatch[1]);
  } catch {
    throw new Error("Could not parse player response");
  }

  const captionTracks: any[] =
    playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];

  if (captionTracks.length === 0) {
    throw new Error("Could not find captions");
  }

  const track =
    captionTracks.find((t: any) => t.languageCode === "en") ||
    captionTracks.find((t: any) => t.languageCode?.startsWith("en")) ||
    captionTracks[0];

  const captionsRes = await fetch(track.baseUrl, { headers: HEADERS });
  if (!captionsRes.ok) throw new Error("Could not fetch captions");

  const xml = await captionsRes.text();

  const transcript = (xml.match(/<text[^>]*>([^<]*)<\/text>/g) ?? [])
    .map((node: string) => {
      const inner = node.replace(/<text[^>]*>/, "").replace(/<\/text>/, "");
      return decodeHtmlEntities(inner).trim();
    })
    .filter(Boolean)
    .join(" ");

  if (!transcript) throw new Error("Empty transcript");

  return transcript;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { url } = req.body ?? {};
  if (!url) {
    return res.status(400).json({ error: "URL is required" });
  }

  const match = url.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/
  );
  if (!match) {
    return res.status(400).json({ error: "Invalid YouTube URL" });
  }

  const videoId = match[1];

  try {
    const transcript = await fetchTranscript(videoId);
    return res.status(200).json({ transcript });
  } catch (err: any) {
    console.error("YouTube transcript error:", err?.message);

    if (err?.message?.includes("Could not find captions")) {
      return res.status(404).json({ error: "이 영상에서 영어 자막을 찾을 수 없습니다" });
    }
    if (err?.message?.includes("Video unavailable")) {
      return res.status(404).json({ error: "이 영상을 사용할 수 없습니다 (비공개 또는 삭제됨)" });
    }
    if (err?.message?.includes("Empty transcript")) {
      return res.status(404).json({ error: "자막 내용이 비어있습니다" });
    }

    return res.status(500).json({ error: "자막을 불러오는 중 오류가 발생했습니다" });
  }
}
