import { Chunk } from "@/types/chunk";
import { supabase } from "@/lib/supabaseClient";

export interface CorrectionResult {
  corrected: string;
  corrections: {
    original_phrase: string;
    corrected_phrase: string;
    explanation: string;
  }[];
  encouragement: string;
}

export class MonthlyLimitError extends Error {
  used: number;
  limit: number;
  constructor(used: number, limit: number) {
    super("monthly_limit");
    this.used = used;
    this.limit = limit;
  }
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (session?.access_token) {
    headers["Authorization"] = `Bearer ${session.access_token}`;
  }
  return headers;
}

async function handleResponse(response: Response): Promise<void> {
  if (response.status === 402) {
    const data = await response.json();
    throw new MonthlyLimitError(data.used, data.limit);
  }
  if (!response.ok) {
    throw new Error("요청 실패");
  }
}

export async function correctText(text: string): Promise<CorrectionResult> {
  const headers = await getAuthHeaders();
  const response = await fetch("/api/correct", {
    method: "POST",
    headers,
    body: JSON.stringify({ text }),
  });
  await handleResponse(response);
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
  const headers = await getAuthHeaders();
  const response = await fetch("/api/extract", {
    method: "POST",
    headers,
    body: JSON.stringify({ text }),
  });
  await handleResponse(response);
  const { chunks } = await response.json();
  return chunks;
}
