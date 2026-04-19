ALTER TABLE vocabulary
  ADD COLUMN IF NOT EXISTS card_type text NOT NULL DEFAULT 'source'
    CHECK (card_type IN ('source', 'situation')),
  ADD COLUMN IF NOT EXISTS trigger_ko text;
