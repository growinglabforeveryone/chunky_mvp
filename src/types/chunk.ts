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
  createdAt: string;
}

export interface Deck {
  id: string;
  title: string;
  chunks: Chunk[];
  createdAt: string;
}
