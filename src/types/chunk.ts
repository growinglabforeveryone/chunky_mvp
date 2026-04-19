export type ChunkStatus = "active" | "mastered" | "excluded";
export type CardType = "source" | "situation";

export interface Chunk {
  id: string;
  phrase: string;
  meaning: string;
  exampleSentence: string;
  reuseExample?: string;
  sourceText?: string;
  sourceName?: string;
  sourceUrl?: string;
  sourceType?: "text" | "youtube";
  mastered?: boolean;
  reviewStage?: number;
  nextReviewAt?: string;
  lastReviewedAt?: string;
  status?: ChunkStatus;
  exampleKo?: string;
  lastWritingAt?: string;
  writingGraduated?: boolean;
  createdAt: string;
  cardType?: CardType;
  triggerKo?: string;
}

export interface Deck {
  id: string;
  title: string;
  chunks: Chunk[];
  createdAt: string;
}
