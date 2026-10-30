-- Job assignment (APD.0024): ONE assignment, ONE form, can give several Job Roles at once, and each new issuance lists the complete set the person holds after it (owner decision
-- 2026-10-26, from a printed form: issuance 02 lists the two roles held before and the three held after). The roles of an assignment are in this table; `carried` is true for a role the
-- person already held (it comes from the earlier issuance and is not checked again against the matrix). `training_job_assignments.position_id` stays as the first role that is given.
-- When an assignment becomes effective the person's earlier effective assignment becomes Obsoleted, so a person has one effective assignment: the latest issuance.
CREATE TABLE IF NOT EXISTS training_job_assignment_roles (
    assignment_id UUID    NOT NULL REFERENCES training_job_assignments(id) ON DELETE CASCADE,
    job_role_id   UUID    NOT NULL REFERENCES training_job_roles(id) ON DELETE RESTRICT,
    sort_order    INTEGER NOT NULL,
    carried       BOOLEAN NOT NULL DEFAULT FALSE,
    PRIMARY KEY (assignment_id, job_role_id)
);
CREATE INDEX IF NOT EXISTS ix_training_job_assignment_roles_role ON training_job_assignment_roles (job_role_id);

INSERT INTO training_job_assignment_roles(assignment_id, job_role_id, sort_order, carried)
SELECT id, position_id, 1, FALSE FROM training_job_assignments
ON CONFLICT DO NOTHING;

-- A person who has several effective assignments (the roles were given one at a time before this change): the latest one keeps all the roles (the others as carried) and the earlier
-- ones become Obsoleted, as an issuance that is replaced by a later one.
DO $$
DECLARE p RECORD; latest UUID; older RECORD; n INTEGER;
BEGIN
    FOR p IN SELECT person_user_id FROM training_job_assignments WHERE status = 'EFFECTIVE' GROUP BY person_user_id HAVING count(*) > 1 LOOP
        SELECT id INTO latest FROM training_job_assignments WHERE person_user_id = p.person_user_id AND status = 'EFFECTIVE' ORDER BY effective_at DESC NULLS LAST, created_at DESC LIMIT 1;
        n := 100;
        FOR older IN SELECT id FROM training_job_assignments WHERE person_user_id = p.person_user_id AND status = 'EFFECTIVE' AND id <> latest ORDER BY effective_at NULLS FIRST LOOP
            INSERT INTO training_job_assignment_roles(assignment_id, job_role_id, sort_order, carried)
            SELECT latest, ar.job_role_id, n + ar.sort_order, TRUE FROM training_job_assignment_roles ar WHERE ar.assignment_id = older.id
            ON CONFLICT DO NOTHING;
            UPDATE training_job_assignments SET status = 'OBSOLETED' WHERE id = older.id;
            n := n + 10;
        END LOOP;
    END LOOP;
END $$;

DROP INDEX IF EXISTS ux_training_job_effective;
CREATE UNIQUE INDEX ux_training_job_effective ON training_job_assignments (person_user_id) WHERE status = 'EFFECTIVE';

CREATE OR REPLACE FUNCTION training_job_assignment_roles_guard() RETURNS trigger AS $$
DECLARE s VARCHAR(20);
BEGIN
    SELECT status INTO s FROM training_job_assignments WHERE id = COALESCE(OLD.assignment_id, NEW.assignment_id);
    IF s IN ('PENDING_RECEIVER','EFFECTIVE','OBSOLETED') THEN RAISE EXCEPTION 'The Job Roles of a signed job assignment cannot be changed' USING ERRCODE = '0LPTR'; END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_training_job_assignment_roles_guard ON training_job_assignment_roles;
CREATE TRIGGER trg_training_job_assignment_roles_guard BEFORE INSERT OR UPDATE OR DELETE ON training_job_assignment_roles FOR EACH ROW EXECUTE FUNCTION training_job_assignment_roles_guard();
