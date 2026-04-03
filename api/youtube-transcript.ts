import type { VercelRequest, VercelResponse } from "@vercel/node";
import https from "https";

const ANDROID_CLIENT_VERSION = "19.29.37";
const ANDROID_USER_AGENT = `com.google.android.youtube/${ANDROID_CLIENT_VERSION} (Linux; U; Android 11) gzip`;
const WEB_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const DEFAULT_CLIENT_VERSION = "2.20251201.01.00";

function encodeVarint(value: number): number[] {
  const bytes: number[] = [];
  while (value > 0x7f) {
    bytes.push((value & 0x7f) | 0x80);
    value >>>= 7;
  }
  bytes.push(value);
  return bytes;
}

function buildParams(videoId: string, lang = "en"): string {
  const innerParts: number[] = [
    0x0a, 0x03, ...Buffer.from("asr"),
    0x12, ...encodeVarint(lang.length), ...Buffer.from(lang),
    0x1a, 0x00,
  ];
  const innerB64 = Buffer.from(innerParts).toString("base64");
  const innerEncoded = encodeURIComponent(innerB64);

  const panelName = "engagement-panel-searchable-transcript-search-panel";
  const outerParts: number[] = [
    0x0a, ...encodeVarint(videoId.length), ...Buffer.from(videoId),
    0x12, ...encodeVarint(innerEncoded.length), ...Buffer.from(innerEncoded),
    0x18, 0x01,
    0x2a, ...encodeVarint(panelName.length), ...Buffer.from(panelName),
    0x30, 0x01,
    0x38, 0x01,
    0x40, 0x01,
  ];
  return Buffer.from(outerParts).toString("base64");
}

function httpsRequest(options: https.RequestOptions, data?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.request({ ...options, timeout: 30000 }, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => resolve(body));
    });
    req.on("error", (err) => reject(new Error(`Network error: ${err.message}`)));
    req.on("timeout", () => { req.destroy(); reject(new Error("Request timeout")); });
    if (data) req.write(data);
    req.end();
  });
}

async function fetchTranscript(videoId: string): Promise<string> {
  // 1. Get visitorData from YouTube page
  const html = await httpsRequest({
    hostname: "www.youtube.com",
    path: `/watch?v=${videoId}`,
    method: "GET",
    headers: { "User-Agent": WEB_USER_AGENT, "Accept-Language": "en-US,en;q=0.9" },
  });

  const visitorMatch = html.match(/"visitorData":"([^"]+)"/);
  const visitorData = visitorMatch?.[1] || "";
  const versionMatch = html.match(/"clientVersion":"([\d.]+)"/);
  const clientVersion = versionMatch?.[1] || DEFAULT_CLIENT_VERSION;

  // Check captions available
  const captionsMatch = html.match(/"captionTracks":(\[[^\]]+\])/);
  if (!captionsMatch) throw new Error("Could not find captions");

  // 2. POST to get_transcript using ANDROID client (bypasses PO Token)
  const params = buildParams(videoId, "en");
  const payload = JSON.stringify({
    context: {
      client: {
        hl: "en",
        gl: "US",
        clientName: "ANDROID",
        clientVersion: ANDROID_CLIENT_VERSION,
        androidSdkVersion: 30,
        visitorData,
      },
    },
    params,
  });

  const response = await httpsRequest({
    hostname: "www.youtube.com",
    path: "/youtubei/v1/get_transcript?prettyPrint=false",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(payload),
      "User-Agent": ANDROID_USER_AGENT,
      "Origin": "https://www.youtube.com",
    },
  }, payload);

  const json = JSON.parse(response);

  if (json.error) throw new Error(`YouTube API error: ${json.error.message || json.error.code}`);

  // 3. Extract segments (handles both WEB and ANDROID response formats)
  const webSegments = json?.actions?.[0]?.updateEngagementPanelAction?.content
    ?.transcriptRenderer?.content?.transcriptSearchPanelRenderer?.body
    ?.transcriptSegmentListRenderer?.initialSegments;

  const androidSegments = json?.actions?.[0]?.elementsCommand?.transformEntityCommand
    ?.arguments?.transformTranscriptSegmentListArguments?.overwrite?.initialSegments;

  const segments = webSegments || androidSegments || [];

  if (segments.length === 0) throw new Error("Could not find captions");

  const transcript = segments
    .filter((seg: any) => seg?.transcriptSegmentRenderer)
    .map((seg: any) => {
      const r = seg.transcriptSegmentRenderer;
      const text =
        r?.snippet?.runs?.map((run: any) => run.text || "").join("") ||
        r?.snippet?.elementsAttributedString?.content ||
        "";
      return text.trim();
    })
    .filter(Boolean)
    .join(" ");

  if (!transcript) throw new Error("Could not find captions");
  return transcript;
}

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
    const transcript = await fetchTranscript(videoId);
    return res.status(200).json({ transcript });
  } catch (err: any) {
    console.error("YouTube transcript error:", err?.message);

    if (err?.message?.includes("Could not find captions")) {
      return res.status(404).json({ error: "이 영상에서 영어 자막을 찾을 수 없습니다" });
    }
    if (err?.message?.includes("Video unavailable")) {
      return res.status(404).json({ error: "이 영상을 사용할 수 없습니다" });
    }

    return res.status(500).json({ error: "자막을 불러오는 중 오류가 발생했습니다" });
  }
}
