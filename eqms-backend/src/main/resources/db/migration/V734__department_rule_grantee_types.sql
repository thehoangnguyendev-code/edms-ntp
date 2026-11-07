-- More kinds of grantee for a Department rule (owner decision 2026-11-03, Decision Log DEPT-VISIBILITY-2026-11-02):
--  * the whole Department: every user whose Department (foreign key) is the rule's owner Department, so a newcomer to the
--    Department is covered without anyone editing a rule;
--  * Positions (job titles from the Positions dictionary): every user whose Position is one of them.
-- A rule still needs at least one kind of grantee (the service enforces it); users and Access Profiles stay as they were.

ALTER TABLE object_access_rules
    ADD COLUMN IF NOT EXISTS grantee_whole_department BOOLEAN NOT NULL DEFAULT FALSE;

-- "Whole Department" only makes sense for a rule that belongs to a Department.
ALTER TABLE object_access_rules
    ADD CONSTRAINT chk_oar_whole_department_needs_owner
    CHECK (grantee_whole_department = FALSE OR owner_department_id IS NOT NULL);

CREATE TABLE IF NOT EXISTS object_access_rule_positions (
    object_access_rule_id UUID NOT NULL REFERENCES object_access_rules (id) ON DELETE CASCADE,
    position_id UUID NOT NULL REFERENCES positions (id),
    PRIMARY KEY (object_access_rule_id, position_id)
);

CREATE INDEX IF NOT EXISTS idx_oar_positions_position ON object_access_rule_positions (position_id);
