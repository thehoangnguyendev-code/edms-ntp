-- V501: Download tracking for Uncontrolled Copy, needed to enforce the policy's allow_redownload
-- toggle (uncontrolled_copy_policy_settings.allow_redownload, V500). V496 had no column to count
-- downloads against, so "re-download not allowed" could not otherwise be enforced server-side.
ALTER TABLE uncontrolled_copies ADD COLUMN download_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE uncontrolled_copies ADD COLUMN last_downloaded_at TIMESTAMPTZ;
