import type { VercelRequest, VercelResponse } from "@vercel/node";
import { chromium } from "playwright-core";

const BROWSERLESS_TOKEN = process.env.BROWSERLESS_TOKEN;

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)));
}

function parseTranscriptXml(xml: string): string[] {
  const texts: string[] = [];
  // New format: <p t="..." d="..."><s>text</s></p>
  const pRegex = /<p\s+t="\d+"\s+d="\d+"[^>]*>([\s\S]*?)<\/p>/g;
  let m: RegExpExecArray | null;
  while ((m = pRegex.exec(xml)) !== null) {
    const inner = m[1];
    const sRegex = /<s[^>]*>([^<]*)<\/s>/g;
    let combined = "";
    let s: RegExpExecArray | null;
    while ((s = sRegex.exec(inner)) !== null) combined += s[1];
    if (!combined) combined = inner.replace(/<[^>]+>/g, "");
    const decoded = decodeEntities(combined).trim();
    if (decoded) texts.push(decoded);
  }
  // Fallback: old <text> format
  if (texts.length === 0) {
    const textRegex = /<text[^>]*>(.*?)<\/text>/g;
    while ((m = textRegex.exec(xml)) !== null) {
      const decoded = decodeEntities(m[1]).trim();
      if (decoded) texts.push(decoded);
    }
  }
  return texts;
}

async function fetchWithBrowserless(videoId: string): Promise<string | null> {
  if (!BROWSERLESS_TOKEN) return null;

  const browser = await chromium.connect(
    `wss://chrome.browserless.io?token=${BROWSERLESS_TOKEN}`
  );

  try {
    const page = await browser.newPage();

    // Intercept caption XML responses
    let captionXml = "";
    page.on("response", async (response) => {
      const url = response.url();
      if (url.includes("youtube.com/api/timedtext") && !captionXml) {
        try {
          captionXml = await response.text();
        } catch {}
      }
    });

    await page.goto(`https://www.youtube.com/watch?v=${videoId}`, {
      waitUntil: "domcontentloaded",
      timeout: 20000,
    });

    // Extract caption track URL from page
    const captionUrl = await page.evaluate(() => {
      const scripts = Array.from(document.querySelectorAll("script"));
      for (const script of scripts) {
        const text = script.textContent || "";
        if (text.includes("captionTracks")) {
          const match = text.match(/"baseUrl":"(https:\\/\\/www\\.youtube\\.com\\/api\\/timedtext[^"]+)"/);
          if (match) return match[1].replace(/\\u0026/g, "&");
        }
      }
      return null;
    });

    if (captionUrl) {
      // Fetch the caption XML by navigating (triggers our response interceptor)
      await page.goto(captionUrl, { waitUntil: "networkidle", timeout: 10000 }).catch(() => {});
      if (!captionXml) captionXml = await page.content();
    }

    if (!captionXml) return null;

    const texts = parseTranscriptXml(captionXml);
    return texts.length > 0 ? texts.join(" ") : null;
  } finally {
    await browser.close();
  }
}

async function fetchDirect(videoId: string): Promise<string | null> {
  const WEB_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_4) AppleWebKit/537.36";
  const ANDROID_VERSION = "20.10.38";
  const ANDROID_UA = `com.google.android.youtube/${ANDROID_VERSION} (Linux; U; Android 14)`;

  // Try ANDROID innertube
  try {
    const resp = await fetch("https://www.youtube.com/youtubei/v1/player?prettyPrint=false", {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": ANDROID_UA },
      body: JSON.stringify({
        context: { client: { clientName: "ANDROID", clientVersion: ANDROID_VERSION } },
        videoId,
      }),
    });
    if (resp.ok) {
      const json = await resp.json();
      const tracks = json?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
      if (Array.isArray(tracks) && tracks.length > 0) {
        const track = tracks.find((t: any) => t.languageCode === "en") || tracks[0];
        const captionResp = await fetch(track.baseUrl, { headers: { "User-Agent": WEB_UA } });
        if (captionResp.ok) {
          const xml = await captionResp.text();
          const texts = parseTranscriptXml(xml);
          if (texts.length > 0) return texts.join(" ");
        }
      }
    }
  } catch {}

  // Try web page scraping
  try {
    const resp = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: { "User-Agent": WEB_UA, "Accept-Language": "en-US,en;q=0.9" },
    });
    const html = await resp.text();
    const marker = "var ytInitialPlayerResponse = ";
    const start = html.indexOf(marker);
    if (start !== -1) {
      const jsonStart = start + marker.length;
      let depth = 0, end = jsonStart;
      for (let i = jsonStart; i < html.length; i++) {
        if (html[i] === "{") depth++;
        else if (html[i] === "}" && --depth === 0) { end = i + 1; break; }
      }
      const playerResp = JSON.parse(html.slice(jsonStart, end));
      const tracks = playerResp?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
      if (Array.isArray(tracks) && tracks.length > 0) {
        const track = tracks.find((t: any) => t.languageCode === "en") || tracks[0];
        const captionResp = await fetch(track.baseUrl, { headers: { "User-Agent": WEB_UA } });
        if (captionResp.ok) {
          const xml = await captionResp.text();
          const texts = parseTranscriptXml(xml);
          if (texts.length > 0) return texts.join(" ");
        }
      }
    }
  } catch {}

  return null;
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
    // 1. Try direct fetch (works locally, may be blocked on cloud)
    let transcript = await fetchDirect(videoId);

    // 2. Fallback to browserless.io if configured
    if (!transcript && BROWSERLESS_TOKEN) {
      transcript = await fetchWithBrowserless(videoId);
    }

    if (!transcript) {
      return res.status(404).json({ error: "이 영상에서 영어 자막을 찾을 수 없습니다" });
    }

    return res.status(200).json({ transcript });
  } catch (err: any) {
    console.error("YouTube transcript error:", err?.message);
    return res.status(500).json({ error: "자막을 불러오는 중 오류가 발생했습니다" });
  }
}
