export interface WritingPracticeResult {
  score: number; // 1-5
  corrected: string;
  feedback: string; // Korean
  targetPhraseUsed: boolean;
  keyIssues: string[]; // Korean
}

export interface WritingPracticeSession {
  vocabularyId: string;
  phrase: string;
  meaning: string;
  exampleSentence: string; // English reference
  exampleKo: string; // Korean prompt shown to user
}
