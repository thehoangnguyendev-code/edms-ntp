ALTER TABLE electronic_signature_meanings
    ADD COLUMN IF NOT EXISTS comment_rule VARCHAR(20) DEFAULT 'OPTIONAL',
    ADD COLUMN IF NOT EXISTS allowed_reasons TEXT;

UPDATE electronic_signature_meanings
SET comment_rule = 'REQUIRED'
WHERE requires_comment = true
  AND (comment_rule IS NULL OR comment_rule = 'OPTIONAL');
