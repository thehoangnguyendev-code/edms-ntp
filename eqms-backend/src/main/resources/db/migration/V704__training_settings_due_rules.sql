-- Training settings (owner decision 2026-10-29): (1) the day of the planned month by which a periodic training of the annual requirement is due (31 = the last day of the month, as before; a shorter
-- month gives its last day); (2) a warning, not a block, when a session is scheduled after the due date of its activity. The setting "Link with Document Control" is retired: a document that requires
-- training always goes through Training Management; the column `integration_enabled` is kept for the history and is no longer read. A training finished before this change gets its training day
-- (the latest day a session was held) now, as every finished training gets it from the finish on. Forward-only and idempotent.
ALTER TABLE training_settings ADD COLUMN IF NOT EXISTS periodic_due_day INTEGER NOT NULL DEFAULT 31;
ALTER TABLE training_settings DROP CONSTRAINT IF EXISTS ck_training_settings_periodic_due_day;
ALTER TABLE training_settings ADD CONSTRAINT ck_training_settings_periodic_due_day CHECK (periodic_due_day BETWEEN 1 AND 31);
ALTER TABLE training_settings ADD COLUMN IF NOT EXISTS warn_scheduled_after_due BOOLEAN NOT NULL DEFAULT TRUE;
UPDATE training_activities a SET completed_on = (SELECT max(s.held_on) FROM training_sessions s WHERE s.activity_id = a.id AND s.status = 'PLANNED')
 WHERE a.results_finished_at IS NOT NULL AND a.completed_on IS NULL AND EXISTS (SELECT 1 FROM training_sessions s WHERE s.activity_id = a.id AND s.status = 'PLANNED' AND s.held_on IS NOT NULL);
