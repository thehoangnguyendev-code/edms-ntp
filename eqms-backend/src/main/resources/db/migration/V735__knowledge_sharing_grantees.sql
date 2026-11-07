-- Knowledge Base sharing (owner decisions 2026-11-03, Decision Log DEPT-VISIBILITY-2026-11-02 follow-ups): the Department Head shares a
-- folder or a document of the Knowledge Base from the Knowledge explorer. Two more kinds of grantee, besides users, Positions and
-- "everyone of the owner Department" (V734):
--  * other Departments: every user whose Department (foreign key) is one of them;
--  * everyone: every user who may open the Knowledge Base.
-- Nothing is stored for a Department-owned rule except its owner, its target (Department, Document Type or Document), its grantees
-- and its effect; the rule still only ever concerns the Knowledge Base.

ALTER TABLE object_access_rules
    ADD COLUMN IF NOT EXISTS grantee_everyone BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE object_access_rules
    ADD CONSTRAINT chk_oar_everyone_needs_owner
    CHECK (grantee_everyone = FALSE OR owner_department_id IS NOT NULL);

CREATE TABLE IF NOT EXISTS object_access_rule_departments (
    object_access_rule_id UUID NOT NULL REFERENCES object_access_rules (id) ON DELETE CASCADE,
    department_id UUID NOT NULL REFERENCES departments (id),
    PRIMARY KEY (object_access_rule_id, department_id)
);

CREATE INDEX IF NOT EXISTS idx_oar_departments_department ON object_access_rule_departments (department_id);

-- The permission now means: share the Knowledge Base folders and documents of the Department the user heads (it is still granted to no
-- profile by default, and it still only works for the Department Head named on that Department).
UPDATE permissions
SET name = 'Share Knowledge Base of Own Department',
    description = 'As the Department Head named on a Department, decide who sees the folders and documents of that Department in the Knowledge Base, from the Knowledge explorer. Applies only to the Department the user heads; it never grants any other access.'
WHERE code = 'security.object_rules.manage_own_department';
