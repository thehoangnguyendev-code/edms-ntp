-- Configuration > Integrations: two small operational facts that the screen could not show before.
--
-- 1) When the administrators were last told that the measured storage reached the warning threshold, and how many of them. warning_notified (V694) only says
--    whether the notice is armed; these two columns keep the last notice as history, so they are not cleared when the usage falls back under the threshold.
ALTER TABLE storage_usage_scan_state
    ADD COLUMN warning_notified_at timestamptz,
    ADD COLUMN warning_recipient_count integer CHECK (warning_recipient_count IS NULL OR warning_recipient_count >= 0);

-- 2) The result of the last "Test connection" of each integration, one row per integration. This is a convenience record for the screen (what was tested, when,
--    by whom, what came back), not audit evidence: it is overwritten by the next test, and a failure to write it never changes the answer of the test.
CREATE TABLE integration_check_result (
    integration_key varchar(16) PRIMARY KEY CHECK (integration_key IN ('STORAGE', 'ONLYOFFICE')),
    success boolean NOT NULL,
    message varchar(500) NOT NULL,
    subject varchar(500) NOT NULL,
    steps jsonb NOT NULL DEFAULT '[]'::jsonb,
    checked_at timestamptz NOT NULL DEFAULT now(),
    checked_by uuid REFERENCES app_users (id) ON DELETE SET NULL
);
