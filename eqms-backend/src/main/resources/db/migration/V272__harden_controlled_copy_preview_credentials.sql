-- Security hardening: controlled-copy portal passwords are stored only as BCrypt hashes.
-- Existing clear-text passwords are deliberately invalidated and require re-distribution.
ALTER TABLE controlled_copies
    ADD COLUMN IF NOT EXISTS preview_password_hash VARCHAR(100);

UPDATE controlled_copies
SET preview_password = NULL
WHERE preview_password IS NOT NULL;
