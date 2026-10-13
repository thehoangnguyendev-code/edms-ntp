-- Identifiers are called "Number" on screens and in the API (Backup Number, Restore Number, Inspection Number). The columns that hold the
-- business number are renamed to match. Only the names change; the values (BK-, RS-, IS-) and every foreign key (UUID row references)
-- stay as they are. Test-restore (RH-), disaster drill (DR-), keep (KP-) and export (EXP-) codes are not part of this rename.
ALTER TABLE backup_run RENAME COLUMN backup_id TO backup_number;
ALTER TABLE restore_request RENAME COLUMN request_id TO restore_number;
ALTER TABLE backup_inspection RENAME COLUMN inspection_id TO inspection_number;
ALTER TABLE restore_keep RENAME COLUMN backup_id TO backup_number;
ALTER TABLE restore_run RENAME COLUMN backup_id TO backup_number;
ALTER TABLE restore_run RENAME COLUMN request_id TO restore_number;
ALTER TABLE maintenance_state RENAME COLUMN request_id TO restore_number;
ALTER TABLE maintenance_event RENAME COLUMN request_id TO restore_number;
