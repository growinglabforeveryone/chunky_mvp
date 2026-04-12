import { useState, useCallback, useRef } from "react";

const cache = new Map<string, string>(); // text → blob URL

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
          headers: { "Content-Type": "application/json" },
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
