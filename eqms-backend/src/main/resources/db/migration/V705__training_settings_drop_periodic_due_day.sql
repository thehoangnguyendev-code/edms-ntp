-- The setting "Due day of the planned month" (V704) is withdrawn (owner decision 2026-10-29): SOP.0003 5.3 speaks of the month of the training requirement, not of a day, so a periodic training is
-- due at the end of its planned month, as before. Nothing reads the column. Forward-only and idempotent.
ALTER TABLE training_settings DROP CONSTRAINT IF EXISTS ck_training_settings_periodic_due_day;
ALTER TABLE training_settings DROP COLUMN IF EXISTS periodic_due_day;
