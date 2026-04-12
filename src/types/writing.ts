export interface WritingPracticeResult {
  feedback: string;        // Korean
  naturalVersion: string;  // 자연스럽게 다듬은 버전
  whyNatural: string;      // 왜 더 자연스러운지 이유 (Korean)
}

export interface WritingPracticeSession {
  vocabularyId: string;
  phrase: string;
  meaning: string;
  exampleSentence: string; // English reference
  exampleKo: string; // Korean prompt shown to user
}
