-- Stamp and watermark for the Document tab view of a controlled copy that is Obsoleted or Closed - Cancelled, configurable per status.
-- Stored as JSON (one object per status); the server validates every field and fills any missing one from its built-in defaults.
ALTER TABLE controlled_copy_policy_settings
    ADD COLUMN IF NOT EXISTS status_marking jsonb;
