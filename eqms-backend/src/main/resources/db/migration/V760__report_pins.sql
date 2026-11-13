-- REPORT-OVERVIEW-2026-11-12 (plan KE_HOACH_HOAN_THIEN_MODULE_REPORT_2026_11_11, phase R6): a person pins the reports they run again and again, and the Reports Overview lists them.
-- A pin is a personal convenience, not a regulated record: it grants no access (the pinned report is listed only while the person may still run it) and it is removed with the person
-- or with the template. Forward-only, idempotent.

CREATE TABLE IF NOT EXISTS report_pins (
    user_id         uuid        NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    definition_code varchar(100) NOT NULL REFERENCES report_definitions(code) ON DELETE CASCADE,
    pinned_at       timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, definition_code)
);

CREATE INDEX IF NOT EXISTS idx_report_pins_user ON report_pins (user_id, pinned_at DESC);

-- Speeds the Reports Overview and Quality Analytics counts of the runs of one person.
CREATE INDEX IF NOT EXISTS idx_report_runs_requester_status ON report_runs (requester_user_id, status, queued_at DESC);
CREATE INDEX IF NOT EXISTS idx_report_runs_queued_at ON report_runs (queued_at DESC);
