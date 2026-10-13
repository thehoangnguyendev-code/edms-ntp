-- Maintenance state for the restore window (SDS-BR-001 section 11.5.1, WP3.1 slice 2): DRAINED -> LOCKED_RESTORING. The state
-- was called LOCKED before; the row that holds it is renamed here. maintenance_event is append-only and keeps the old word in
-- its history, which is correct: it records what was written at the time.
ALTER TABLE maintenance_state DROP CONSTRAINT IF EXISTS maintenance_state_state_check;
UPDATE maintenance_state SET state = 'LOCKED_RESTORING' WHERE state = 'LOCKED';
ALTER TABLE maintenance_state ADD CONSTRAINT maintenance_state_state_check
    CHECK (state IN ('NORMAL', 'NOTICE', 'DRAINED', 'LOCKED_RESTORING'));
