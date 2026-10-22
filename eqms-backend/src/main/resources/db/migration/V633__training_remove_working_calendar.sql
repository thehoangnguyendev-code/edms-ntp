-- Training Management: the calendar of non-working days and the setting "working days to send results to QA" are removed. The SOP does not define working days, the setting was
-- not used by any calculation, and the only rule that used the calendar (a late typed result needs a reason) now counts calendar days. Forward-only and idempotent.

DROP TABLE IF EXISTS training_non_working_days;
ALTER TABLE training_settings DROP COLUMN IF EXISTS results_due_working_days;
