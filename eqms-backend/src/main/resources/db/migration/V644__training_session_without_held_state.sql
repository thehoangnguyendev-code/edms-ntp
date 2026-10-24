-- A training session has no "held" state: it is planned, postponed or cancelled, and it has started when it has the day it was conducted (held_on, set by the first action of the
-- workspace). The sessions that were held keep their day; their status goes back to PLANNED, which is what the rules now read together with held_on.
UPDATE training_sessions SET held_on = COALESCE(held_on, scheduled_on, CURRENT_DATE) WHERE status = 'HELD';
UPDATE training_sessions SET status = 'PLANNED' WHERE status = 'HELD';
ALTER TABLE training_sessions DROP CONSTRAINT IF EXISTS training_sessions_status_check;
ALTER TABLE training_sessions ADD CONSTRAINT training_sessions_status_check CHECK (status IN ('PLANNED','POSTPONED','CANCELLED'));
