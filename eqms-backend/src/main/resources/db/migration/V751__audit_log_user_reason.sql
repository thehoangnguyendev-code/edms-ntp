-- The reason a person typed, kept apart from the text the system writes (comment/reason hold system text such as
-- "Document draft updated | Co-authors=0, ..."). Only the actions that wire it record a value; older rows stay empty
-- (the audit log is immutable and cannot say afterwards which text was typed).
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS user_reason TEXT;
