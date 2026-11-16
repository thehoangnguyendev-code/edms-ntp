-- REPORT-RANGE-DAYS-2026-11-16: the most days a run of a log-like report type (Audit Trail, Authentication Events, Backup Activity, Electronic Signatures,
-- Notification Delivery) may cover was fixed in the code at 92. It is a setting of Report Properties now; the default stays 92.
ALTER TABLE report_properties
    ADD COLUMN IF NOT EXISTS max_range_days integer NOT NULL DEFAULT 92;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'report_properties_max_range_days_check') THEN
        ALTER TABLE report_properties
            ADD CONSTRAINT report_properties_max_range_days_check CHECK (max_range_days BETWEEN 1 AND 3660);
    END IF;
END $$;

COMMENT ON COLUMN report_properties.max_range_days IS 'Most days a run of a report type that must name a date range may cover (default 92).';
