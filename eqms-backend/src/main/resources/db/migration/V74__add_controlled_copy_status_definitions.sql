CREATE TABLE IF NOT EXISTS controlled_copy_statuses (
    code VARCHAR(40) PRIMARY KEY,
    label VARCHAR(120) NOT NULL UNIQUE,
    sort_order INTEGER NOT NULL,
    is_terminal BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO controlled_copy_statuses (code, label, sort_order, is_terminal, created_at, updated_at) VALUES
    ('READY_FOR_DISTRIBUTION', 'Ready for Distribution', 1, FALSE, NOW(), NOW()),
    ('DISTRIBUTED', 'Distributed', 2, FALSE, NOW(), NOW()),
    ('OBSOLETE', 'Obsolete', 3, TRUE, NOW(), NOW()),
    ('CLOSED_CANCELLED', 'Closed - Cancelled', 4, TRUE, NOW(), NOW())
ON CONFLICT (code) DO UPDATE SET
    label = EXCLUDED.label,
    sort_order = EXCLUDED.sort_order,
    is_terminal = EXCLUDED.is_terminal,
    updated_at = NOW();

ALTER TABLE controlled_copies
    ADD COLUMN IF NOT EXISTS status_code VARCHAR(40);

UPDATE controlled_copies
SET status_code = CASE
    WHEN UPPER(REPLACE(COALESCE(status, ''), ' ', '_')) IN ('READY_FOR_DISTRIBUTION', 'READY_FOR_DISTRIBUTE') THEN 'READY_FOR_DISTRIBUTION'
    WHEN UPPER(COALESCE(status, '')) = 'DISTRIBUTED' THEN 'DISTRIBUTED'
    WHEN UPPER(COALESCE(status, '')) IN ('OBSOLETE', 'OBSOLETED') THEN 'OBSOLETE'
    WHEN UPPER(REPLACE(COALESCE(status, ''), ' ', '_')) IN ('CLOSED_-_CANCELLED', 'CLOSED_CANCELLED', 'CANCELLED') THEN 'CLOSED_CANCELLED'
    ELSE 'READY_FOR_DISTRIBUTION'
END
WHERE status_code IS NULL;

ALTER TABLE controlled_copies
    ALTER COLUMN status_code SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_controlled_copies_status_code'
    ) THEN
        ALTER TABLE controlled_copies
            ADD CONSTRAINT fk_controlled_copies_status_code
            FOREIGN KEY (status_code) REFERENCES controlled_copy_statuses(code);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_controlled_copies_status_code
    ON controlled_copies(status_code);
