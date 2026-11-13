-- REPORT-FULL-RUN-2026-11-12 (owner decision D3, plan KE_HOACH_HOAN_THIEN_MODULE_REPORT_2026_11_11 phase R1):
-- a report must be run with a filter; "Full" is the explicit choice to run without one, up to its own ceiling.
-- Forward-only, idempotent. Existing runs keep full_run = false (they were run under the old single limit).

ALTER TABLE report_properties
    ADD COLUMN IF NOT EXISTS max_rows_full integer NOT NULL DEFAULT 100000;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'report_properties_max_rows_full_check') THEN
        ALTER TABLE report_properties
            ADD CONSTRAINT report_properties_max_rows_full_check CHECK (max_rows_full BETWEEN 10000 AND 1000000);
    END IF;
END $$;

ALTER TABLE report_runs
    ADD COLUMN IF NOT EXISTS full_run boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN report_properties.max_rows_full IS 'Most rows of a report run with the Full choice. The application keeps it within its memory-safe limit.';
COMMENT ON COLUMN report_runs.full_run IS 'True when the run was requested with the Full choice (no filter required, up to max_rows_full rows).';
