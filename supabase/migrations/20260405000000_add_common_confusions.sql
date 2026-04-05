-- vocabulary 테이블에 예상 오답 컬럼 추가
ALTER TABLE vocabulary ADD COLUMN IF NOT EXISTS common_confusions TEXT;
