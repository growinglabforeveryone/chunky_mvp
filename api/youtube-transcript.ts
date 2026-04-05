import type { VercelRequest, VercelResponse } from "@vercel/node";

const ANDROID_VERSION = "20.10.38";
const ANDROID_UA = `com.google.android.youtube/${ANDROID_VERSION} (Linux; U; Android 14)`;
const WEB_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.83 Safari/537.36,gzip(gfe)";
const INNERTUBE_PLAYER =
  "https://www.youtube.com/youtubei/v1/player?prettyPrint=false";

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) =>
      String.fromCodePoint(parseInt(h, 16))
    )
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)));
}

function parseTranscriptXml(xml: string): string[] {
  // New format: <p t="offset" d="duration"><s>text</s></p>
  const pRegex = /<p\s+t="\d+"\s+d="\d+"[^>]*>([\s\S]*?)<\/p>/g;
  const texts: string[] = [];
  let m: RegExpExecArray | null;

  while ((m = pRegex.exec(xml)) !== null) {
    const inner = m[1];
    // Extract <s> tags if present
    const sRegex = /<s[^>]*>([^<]*)<\/s>/g;
    let combined = "";
    let s: RegExpExecArray | null;
    while ((s = sRegex.exec(inner)) !== null) combined += s[1];
    if (!combined) combined = inner.replace(/<[^>]+>/g, "");
    const decoded = decodeEntities(combined).trim();
    if (decoded) texts.push(decoded);
  }

  // Fallback: old format <text start="..." dur="...">content</text>
  if (texts.length === 0) {
    const textRegex = /<text[^>]*>(.*?)<\/text>/g;
    while ((m = textRegex.exec(xml)) !== null) {
      const decoded = decodeEntities(m[1]).trim();
      if (decoded) texts.push(decoded);
    }
  }

  return texts;
}

async function fetchViaInnerTube(videoId: string): Promise<string | null> {
  const resp = await fetch(INNERTUBE_PLAYER, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": ANDROID_UA,
    },
    body: JSON.stringify({
      context: {
        client: {
          clientName: "ANDROID",
          clientVersion: ANDROID_VERSION,
        },
      },
      videoId,
    }),
  });

  if (!resp.ok) return null;
  const json = await resp.json();
  const tracks =
    json?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
  if (!Array.isArray(tracks) || tracks.length === 0) return null;

  return fetchFromTracks(tracks);
}

async function fetchViaWebPage(videoId: string): Promise<string | null> {
  const resp = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
    headers: {
      "User-Agent": WEB_UA,
      "Accept-Language": "en-US,en;q=0.9",
    },
  });
  const html = await resp.text();

  if (html.includes('class="g-recaptcha"'))
    throw new Error("YouTube CAPTCHA required");
  if (!html.includes('"playabilityStatus":'))
    throw new Error("Video unavailable");

  // Parse ytInitialPlayerResponse
  const marker = "var ytInitialPlayerResponse = ";
  const start = html.indexOf(marker);
  if (start === -1) return null;

  const jsonStart = start + marker.length;
  let depth = 0;
  let end = jsonStart;
  for (let i = jsonStart; i < html.length; i++) {
    if (html[i] === "{") depth++;
    else if (html[i] === "}") {
      depth--;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }

  try {
    const playerResp = JSON.parse(html.slice(jsonStart, end));
    const tracks =
      playerResp?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    if (!Array.isArray(tracks) || tracks.length === 0) return null;
    return fetchFromTracks(tracks);
  } catch {
    return null;
  }
}

async function fetchFromTracks(
  tracks: Array<{ baseUrl: string; languageCode?: string }>
): Promise<string | null> {
  // Prefer English
  const enTrack =
    tracks.find((t) => t.languageCode === "en") || tracks[0];
  const baseUrl = enTrack.baseUrl;

  // Validate URL
  try {
    if (!new URL(baseUrl).hostname.endsWith(".youtube.com")) return null;
  } catch {
    return null;
  }

  const resp = await fetch(baseUrl, {
    headers: {
      "User-Agent": WEB_UA,
      "Accept-Language": "en-US,en;q=0.9",
    },
  });

  if (!resp.ok) return null;
  const xml = await resp.text();
  if (!xml) return null;

  const texts = parseTranscriptXml(xml);
  return texts.length > 0 ? texts.join(" ") : null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const { url } = req.body ?? {};
  if (!url) return res.status(400).json({ error: "URL is required" });

  const match = url.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/
  );
  if (!match) return res.status(400).json({ error: "Invalid YouTube URL" });

  const videoId = match[1];

  try {
    // Try ANDROID innertube first, fall back to web page scraping
    let transcript = await fetchViaInnerTube(videoId);
    if (!transcript) {
      transcript = await fetchViaWebPage(videoId);
    }

    if (!transcript) {
      return res
        .status(404)
        .json({ error: "이 영상에서 영어 자막을 찾을 수 없습니다" });
    }

    return res.status(200).json({ transcript });
  } catch (err: any) {
    console.error("YouTube transcript error:", err?.message);

    if (err?.message?.includes("CAPTCHA")) {
      return res
        .status(429)
        .json({ error: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요" });
    }
    if (err?.message?.includes("unavailable")) {
      return res
        .status(404)
        .json({ error: "이 영상을 사용할 수 없습니다" });
    }

    return res
      .status(500)
      .json({ error: "자막을 불러오는 중 오류가 발생했습니다" });
  }
}
