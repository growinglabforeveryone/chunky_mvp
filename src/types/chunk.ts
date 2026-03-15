export type ChunkStatus = "active" | "mastered" | "excluded";

export interface Chunk {
  id: string;
  phrase: string;
  meaning: string;
  exampleSentence: string;
  reuseExample?: string;
  sourceText?: string;
  sourceName?: string;
  mastered?: boolean;
  reviewStage?: number;
  nextReviewAt?: string;
  status?: ChunkStatus;
  createdAt: string;
}

export interface Deck {
  id: string;
  title: string;
  chunks: Chunk[];
  createdAt: string;
}
