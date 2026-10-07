-- V546: the QR code can be dragged to any place on the first page (fractions of the page, top-left of the code's frame).
-- NULL keeps the corner chosen in qr_code_position. The size stays in qr_code_size_mm.
ALTER TABLE controlled_copy_policy_settings
    ADD COLUMN IF NOT EXISTS qr_code_x DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS qr_code_y DOUBLE PRECISION,
    ADD CONSTRAINT chk_cc_policy_qr_position_fractions CHECK (
        (qr_code_x IS NULL AND qr_code_y IS NULL)
        OR (qr_code_x BETWEEN 0 AND 1 AND qr_code_y BETWEEN 0 AND 1));
