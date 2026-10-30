-- The training unit of a part of the initial training is a Department (owner decision 2026-10-27), not free text. unit_text keeps the name of the department for display; the part that comes from
-- the matrix has no department of its own (it is the department of each Job Role).
ALTER TABLE training_initial_parts ADD COLUMN IF NOT EXISTS unit_department_id UUID REFERENCES departments(id);
UPDATE training_initial_parts p SET unit_department_id = d.id, unit_text = d.name FROM departments d WHERE p.part_no = 1 AND NOT p.from_matrix AND p.unit_department_id IS NULL AND d.code = 'HRAD';
UPDATE training_initial_parts p SET unit_department_id = d.id, unit_text = d.name FROM departments d WHERE p.part_no = 2 AND NOT p.from_matrix AND p.unit_department_id IS NULL AND d.code = 'QA';
