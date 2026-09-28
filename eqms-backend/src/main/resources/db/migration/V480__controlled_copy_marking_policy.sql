-- Stamp and watermark burned into every issued Controlled Copy PDF (configured on the Controlled Copies Policy screen).
-- The existing watermark_* columns keep their meaning as the content options of the watermark (copy number, recipient,
-- distributed date, expiry date); watermark_enabled now switches the burned-in watermark.
ALTER TABLE controlled_copy_policy_settings
    ADD COLUMN IF NOT EXISTS stamp_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS stamp_text VARCHAR(40) NOT NULL DEFAULT 'CONTROLLED COPY',
    ADD COLUMN IF NOT EXISTS stamp_color VARCHAR(7) NOT NULL DEFAULT '#C00000',
    ADD COLUMN IF NOT EXISTS stamp_position VARCHAR(20) NOT NULL DEFAULT 'TOP_RIGHT',
    ADD COLUMN IF NOT EXISTS stamp_size VARCHAR(10) NOT NULL DEFAULT 'MEDIUM',
    ADD COLUMN IF NOT EXISTS stamp_opacity_percent INTEGER NOT NULL DEFAULT 90,
    ADD COLUMN IF NOT EXISTS stamp_pages VARCHAR(10) NOT NULL DEFAULT 'ALL',
    ADD COLUMN IF NOT EXISTS stamp_show_copy_number BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS stamp_show_recipient BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS stamp_show_distributed_date BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS stamp_show_expiry_date BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS watermark_text VARCHAR(40) NOT NULL DEFAULT 'CONTROLLED COPY',
    ADD COLUMN IF NOT EXISTS watermark_color VARCHAR(7) NOT NULL DEFAULT '#808080',
    ADD COLUMN IF NOT EXISTS watermark_opacity_percent INTEGER NOT NULL DEFAULT 15,
    ADD COLUMN IF NOT EXISTS watermark_angle_degrees INTEGER NOT NULL DEFAULT 35,
    ADD COLUMN IF NOT EXISTS watermark_pages VARCHAR(10) NOT NULL DEFAULT 'ALL';

-- True once the stamp/watermark was burned into this copy's stored PDF; the on-screen overlay is then skipped so a page is
-- never marked twice. Copies issued before this change keep the on-screen overlay.
ALTER TABLE controlled_copies
    ADD COLUMN IF NOT EXISTS marking_applied BOOLEAN NOT NULL DEFAULT FALSE;
