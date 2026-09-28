-- How long an external recipient (no eQMS account, opening the e-mail link + password) may keep a controlled copy open. When the
-- time is up the viewer locks and the recipient must open the e-mail link and enter the password again. Configured on the
-- Controlled Copies Policy screen; 120 minutes (2 hours) by default, bounded to 5 minutes .. 8 hours.
ALTER TABLE controlled_copy_policy_settings
    ADD COLUMN IF NOT EXISTS preview_session_minutes INTEGER NOT NULL DEFAULT 120;

ALTER TABLE controlled_copy_policy_settings
    ADD CONSTRAINT chk_cc_policy_preview_session_minutes CHECK (preview_session_minutes BETWEEN 5 AND 480);
