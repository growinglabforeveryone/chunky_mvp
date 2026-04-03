import { Chunk } from "@/types/chunk";

export interface CorrectionResult {
  corrected: string;
  corrections: {
    original_phrase: string;
    corrected_phrase: string;
    explanation: string;
  }[];
  encouragement: string;
}

export async function correctText(text: string): Promise<CorrectionResult> {
  const response = await fetch("/api/correct", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!response.ok) throw new Error("교정 실패");
  return response.json();
}

export async function getMeaning(phrase: string): Promise<string> {
  const response = await fetch("/api/meaning", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phrase }),
  });
  if (!response.ok) return "";
  const { meaning } = await response.json();
  return meaning ?? "";
}

export async function extractChunks(text: string): Promise<Chunk[]> {
  const response = await fetch("/api/extract", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!response.ok) throw new Error("추출 실패");
  const { chunks } = await response.json();
  return chunks;
}
