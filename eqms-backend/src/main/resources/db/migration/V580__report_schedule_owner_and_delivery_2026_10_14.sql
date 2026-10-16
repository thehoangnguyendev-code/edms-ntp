-- REPORT-SCHEDULE-OWNER-2026-10-14 and REPORT-NOTIFICATION-CHANNEL-2026-10-14 (phases 2.3 and 2.4).
-- Every schedule gets a named owner; existing schedules are backfilled with their creator (the creator keeps the authority).
ALTER TABLE report_schedules ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES app_users(id);
UPDATE report_schedules SET owner_user_id = creator_user_id WHERE owner_user_id IS NULL;
ALTER TABLE report_schedules ALTER COLUMN owner_user_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_report_schedules_owner ON report_schedules(owner_user_id);

-- A run remembers the schedule that produced it, so completion can notify that schedule's recipients.
ALTER TABLE report_runs ADD COLUMN IF NOT EXISTS schedule_id UUID REFERENCES report_schedules(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_report_runs_schedule ON report_runs(schedule_id);

-- Every notice (in-app or e-mail) is recorded, including refusals and failures. report_delivery_attempts was created empty in V359.
ALTER TABLE report_delivery_attempts ADD COLUMN IF NOT EXISTS channel VARCHAR(20);
ALTER TABLE report_delivery_attempts ADD COLUMN IF NOT EXISTS event_code VARCHAR(80);
ALTER TABLE report_delivery_attempts ADD COLUMN IF NOT EXISTS run_id UUID REFERENCES report_runs(id);
ALTER TABLE report_delivery_attempts ADD COLUMN IF NOT EXISTS schedule_id UUID REFERENCES report_schedules(id) ON DELETE SET NULL;
ALTER TABLE report_delivery_attempts ADD COLUMN IF NOT EXISTS detail TEXT;
CREATE INDEX IF NOT EXISTS idx_report_delivery_attempts_run ON report_delivery_attempts(run_id);
