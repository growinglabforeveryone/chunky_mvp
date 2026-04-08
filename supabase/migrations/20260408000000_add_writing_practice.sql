-- vocabulary에 한글 번역 캐시 + 쿨다운 추적 컬럼 추가
ALTER TABLE vocabulary ADD COLUMN IF NOT EXISTS example_ko TEXT;
ALTER TABLE vocabulary ADD COLUMN IF NOT EXISTS last_writing_at TIMESTAMPTZ;
ALTER TABLE vocabulary ADD COLUMN IF NOT EXISTS writing_graduated BOOLEAN DEFAULT FALSE;

-- 번역 연습 결과 테이블
CREATE TABLE IF NOT EXISTS writing_practice (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vocabulary_id UUID NOT NULL REFERENCES vocabulary(id) ON DELETE CASCADE,
  user_answer TEXT NOT NULL,
  reference_sentence TEXT NOT NULL,
  score INTEGER NOT NULL CHECK (score BETWEEN 1 AND 5),
  feedback JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_wp_user ON writing_practice(user_id, created_at);
CREATE INDEX idx_wp_vocab ON writing_practice(vocabulary_id);

ALTER TABLE writing_practice ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can insert own practice" ON writing_practice
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can read own practice" ON writing_practice
  FOR SELECT USING (auth.uid() = user_id);
