-- DEC-TRAINING-2026-11-27-01 (C): one factory-wide list of training (SOP.0003 5.3.1 "general education as factory's requirement"), prepared and approved like a matrix.
-- It is a second matrix of the Quality Assurance department with the scope FACTORY, so versions, approval, signatures, audit and permissions are the ones of a matrix.
-- Until a factory list is effective, nothing changes: the departments' own rows keep applying.
ALTER TABLE training_matrices ADD COLUMN IF NOT EXISTS scope varchar(12) NOT NULL DEFAULT 'DEPARTMENT';
ALTER TABLE training_matrices ADD CONSTRAINT ck_training_matrices_scope CHECK (scope IN ('DEPARTMENT', 'FACTORY'));
ALTER TABLE training_matrices DROP CONSTRAINT IF EXISTS training_matrices_department_id_key;
ALTER TABLE training_matrices ADD CONSTRAINT training_matrices_department_scope_key UNIQUE (department_id, scope);
CREATE UNIQUE INDEX IF NOT EXISTS ux_training_matrices_one_factory ON training_matrices (scope) WHERE scope = 'FACTORY';

-- What is required of the people of a department now: the rows of the factory list (for everybody), and the rows of the effective matrix of the department that the
-- factory list does not already have. Every screen that asks "what does this department require" reads this view.
CREATE OR REPLACE VIEW training_effective_requirements AS
WITH factory AS (
    SELECT r.* FROM training_matrix_rows r
      JOIN training_matrix_versions v ON v.id = r.version_id AND v.status = 'EFFECTIVE'
      JOIN training_matrices m ON m.id = v.matrix_id AND m.scope = 'FACTORY')
SELECT d.id AS department_id, f.id, f.version_id, f.row_no, 'FACTORY_GENERAL'::varchar(24) AS row_group, f.topic_text, f.document_id, f.annual_required,
       true AS all_employees, f.is_gmp, true AS factory
  FROM departments d CROSS JOIN factory f
UNION ALL
SELECT m.department_id, r.id, r.version_id, r.row_no, r.row_group, r.topic_text, r.document_id, r.annual_required, r.all_employees, r.is_gmp, false AS factory
  FROM training_matrix_rows r
  JOIN training_matrix_versions v ON v.id = r.version_id AND v.status = 'EFFECTIVE'
  JOIN training_matrices m ON m.id = v.matrix_id AND m.scope = 'DEPARTMENT'
 WHERE NOT EXISTS (SELECT 1 FROM factory f
                    WHERE (f.document_id IS NOT NULL AND f.document_id = r.document_id)
                       OR (f.topic_text IS NOT NULL AND training_topic_key(f.topic_text) = training_topic_key(r.topic_text)));
