import { useState, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";

const cache = new Map<string, string>(); // text → blob URL
const preloading = new Set<string>(); // 중복 프리로드 방지

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (session?.access_token) {
    headers["Authorization"] = `Bearer ${session.access_token}`;
  }
  return headers;
}

async function preloadText(text: string) {
  if (cache.has(text) || preloading.has(text)) return;
  preloading.add(text);
  try {
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: await getAuthHeaders(),
      body: JSON.stringify({ text }),
    });
    if (!res.ok) return;
    const blob = await res.blob();
    cache.set(text, URL.createObjectURL(blob));
  } catch {
    // 프리로드 실패는 조용히 무시
  } finally {
    preloading.delete(text);
  }
}

export function preloadTTS(...texts: string[]) {
  texts.forEach(preloadText);
}

export function useTTS() {
  const [playing, setPlaying] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const speak = useCallback(async (text: string) => {
    if (playing === text) {
      audioRef.current?.pause();
      setPlaying(null);
      return;
    }

    setPlaying(text);

    try {
      let url = cache.get(text);

      if (!url) {
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: await getAuthHeaders(),
          body: JSON.stringify({ text }),
        });
        if (!res.ok) throw new Error("TTS 실패");
        const blob = await res.blob();
        url = URL.createObjectURL(blob);
        cache.set(text, url);
      }

      if (audioRef.current) {
        audioRef.current.pause();
      }
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => setPlaying(null);
      audio.onerror = () => setPlaying(null);
      await audio.play();
    } catch {
      setPlaying(null);
    }
  }, [playing]);

  return { speak, playing };
}
