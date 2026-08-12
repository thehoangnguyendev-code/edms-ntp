-- Access-profile workflow-role assignments use the immutable catalog code as
-- their technical key.  The display label remains freely renameable, while
-- this constraint prevents stale or mistyped role codes from granting or
-- appearing to grant authorization.

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM access_profile_workflow_roles assignment
        LEFT JOIN workflow_roles catalog
          ON catalog.code = assignment.workflow_role
        WHERE catalog.id IS NULL
    ) THEN
        RAISE EXCEPTION 'Cannot enforce workflow role catalog FK: orphan assignments exist';
    END IF;
END $$;

ALTER TABLE access_profile_workflow_roles
    DROP CONSTRAINT IF EXISTS fk_access_profile_workflow_role_catalog;

ALTER TABLE access_profile_workflow_roles
    ADD CONSTRAINT fk_access_profile_workflow_role_catalog
    FOREIGN KEY (workflow_role)
    REFERENCES workflow_roles(code)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_apwr_workflow_role
    ON access_profile_workflow_roles(workflow_role);
