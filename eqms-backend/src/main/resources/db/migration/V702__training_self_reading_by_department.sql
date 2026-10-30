-- APD.0108 is one list for one department with one confirmation of the head of that department (owner decision 2026-10-29, SOP.0003 5.3: the head of the unit answers for the people of the unit).
-- A training of several departments therefore has one list and one confirmation per department. The confirmation and the printed copy now name the department. A confirmation made before this
-- change has no department (it covered the whole activity). Forward-only and idempotent.
ALTER TABLE training_activity_confirmations ADD COLUMN IF NOT EXISTS department_id UUID NULL REFERENCES departments(id);
CREATE OR REPLACE VIEW training_active_confirmations AS
SELECT c.* FROM training_activity_confirmations c
 WHERE NOT EXISTS (SELECT 1 FROM training_confirmation_supersessions s WHERE s.confirmation_id = c.id);

ALTER TABLE training_paper_packs ADD COLUMN IF NOT EXISTS department_id UUID NULL REFERENCES departments(id);
ALTER TABLE training_paper_packs DROP CONSTRAINT IF EXISTS ux_training_paper_pack_copy;
CREATE UNIQUE INDEX IF NOT EXISTS ux_training_paper_pack_copy_dept ON training_paper_packs (session_id, pack_kind, copy_no, COALESCE(department_id, '00000000-0000-0000-0000-000000000000'::uuid));
