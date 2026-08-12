ALTER TABLE controlled_copy_policy_settings
    ADD COLUMN IF NOT EXISTS download_once BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE controlled_copy_policy_settings
    ADD COLUMN IF NOT EXISTS print_once BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE controlled_copies
    ADD COLUMN IF NOT EXISTS download_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE controlled_copies
    ADD COLUMN IF NOT EXISTS print_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE controlled_copies
    ADD COLUMN IF NOT EXISTS last_downloaded_at TIMESTAMP WITH TIME ZONE;
