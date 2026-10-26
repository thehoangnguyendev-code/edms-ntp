-- Training Management: Job Roles (owner decision 2026-10-26).
-- The Position of a person (Dictionaries > Positions, chosen when the user is created) is the title, for example QC Staff. A Job Role is a duty under a department, for example
-- "QC - Microbiology" or "QA - Validation": the training matrix (APD.0011) has one column for each Job Role, and a job assignment (APD.0024) gives a Job Role to a person after the
-- training that the matrix requires for it. A person can hold several Job Roles at the same time (APD.0024: "position change or additional").
-- The Job Roles are made from the Positions of the departments with the same id, so that the matrix cells, the positions of people and the job assignments keep pointing at the
-- same ids; the columns keep their name `position_id` and from now on hold the id of a Job Role.
CREATE TABLE IF NOT EXISTS training_job_roles (
    id                UUID PRIMARY KEY,
    department_id     UUID         NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
    title_position_id UUID         REFERENCES positions(id) ON DELETE SET NULL,
    code              VARCHAR(40)  NOT NULL,
    name              VARCHAR(120) NOT NULL,
    description       TEXT,
    jurisdiction      TEXT,
    is_active         BOOLEAN      NOT NULL DEFAULT TRUE,
    version           INTEGER      NOT NULL DEFAULT 0,
    created_by        UUID,
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_by        UUID,
    updated_at        TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_training_job_roles_code ON training_job_roles (lower(code));
CREATE UNIQUE INDEX IF NOT EXISTS ux_training_job_roles_name ON training_job_roles (department_id, lower(name));
CREATE INDEX IF NOT EXISTS ix_training_job_roles_title ON training_job_roles (title_position_id);

INSERT INTO training_job_roles(id, department_id, title_position_id, code, name, description, is_active)
SELECT p.id, p.department_id, p.id, p.code, p.name, p.description, p.is_active FROM positions p WHERE p.department_id IS NOT NULL
ON CONFLICT (id) DO NOTHING;

-- every row that points at a position must point at a Job Role of the same id
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM training_matrix_cells c WHERE NOT EXISTS (SELECT 1 FROM training_job_roles r WHERE r.id = c.position_id))
       OR EXISTS (SELECT 1 FROM training_person_positions c WHERE NOT EXISTS (SELECT 1 FROM training_job_roles r WHERE r.id = c.position_id))
       OR EXISTS (SELECT 1 FROM training_job_assignments c WHERE NOT EXISTS (SELECT 1 FROM training_job_roles r WHERE r.id = c.position_id)
                  OR (c.previous_position_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM training_job_roles r WHERE r.id = c.previous_position_id))) THEN
        RAISE EXCEPTION 'A row of Training points at a position without a department, which cannot become a Job Role';
    END IF;
END $$;

ALTER TABLE training_matrix_cells DROP CONSTRAINT IF EXISTS training_matrix_cells_position_id_fkey;
ALTER TABLE training_person_positions DROP CONSTRAINT IF EXISTS training_person_positions_position_id_fkey;
ALTER TABLE training_job_assignments DROP CONSTRAINT IF EXISTS training_job_assignments_position_id_fkey;
ALTER TABLE training_job_assignments DROP CONSTRAINT IF EXISTS training_job_assignments_previous_position_id_fkey;
ALTER TABLE training_matrix_cells ADD CONSTRAINT training_matrix_cells_job_role_fkey FOREIGN KEY (position_id) REFERENCES training_job_roles(id) ON DELETE RESTRICT;
ALTER TABLE training_person_positions ADD CONSTRAINT training_person_positions_job_role_fkey FOREIGN KEY (position_id) REFERENCES training_job_roles(id) ON DELETE RESTRICT;
ALTER TABLE training_job_assignments ADD CONSTRAINT training_job_assignments_job_role_fkey FOREIGN KEY (position_id) REFERENCES training_job_roles(id) ON DELETE RESTRICT;
ALTER TABLE training_job_assignments ADD CONSTRAINT training_job_assignments_previous_job_role_fkey FOREIGN KEY (previous_position_id) REFERENCES training_job_roles(id);

-- several Job Roles at the same time: one open row for each person and Job Role, one effective assignment for each person and Job Role
DROP INDEX IF EXISTS ux_training_person_positions_open;
CREATE UNIQUE INDEX ux_training_person_positions_open ON training_person_positions (person_user_id, position_id) WHERE valid_to IS NULL;
DROP INDEX IF EXISTS ux_training_job_effective;
CREATE UNIQUE INDEX ux_training_job_effective ON training_job_assignments (person_user_id, position_id) WHERE status = 'EFFECTIVE';

-- the third case of APD.0024: a Job Role added to the ones the person already holds
ALTER TABLE training_job_assignments DROP CONSTRAINT IF EXISTS training_job_assignments_case_type_check;
ALTER TABLE training_job_assignments ADD CONSTRAINT training_job_assignments_case_type_check CHECK (case_type IN ('INITIAL','CHANGE','ADDITIONAL'));
