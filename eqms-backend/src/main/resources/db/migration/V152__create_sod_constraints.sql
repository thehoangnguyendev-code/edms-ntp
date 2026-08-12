-- V152: Segregation of Duties (SoD) constraints at the permission level
-- Defines pairs of permissions that must NOT coexist in the same role or user assignment.
-- Complements the workflow-level SoD flags in document_workflow_settings.
-- Regulatory basis: EU-GMP Chapter 4, 21 CFR Part 211.68, ICH Q10 §3.2.

CREATE TABLE sod_constraints (
    id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    name             VARCHAR(200) NOT NULL,
    description      TEXT,

    -- The two conflicting permission codes
    permission_code_a VARCHAR(150) NOT NULL,
    permission_code_b VARCHAR(150) NOT NULL,

    -- WARN: log violation and alert admin; BLOCK: prevent role assignment
    severity         VARCHAR(10)  NOT NULL DEFAULT 'WARN'
        CHECK (severity IN ('WARN', 'BLOCK')),

    -- Regulatory reference (informational, shown in UI)
    regulation_ref   VARCHAR(300),

    active           BOOLEAN      NOT NULL DEFAULT true,
    system           BOOLEAN      NOT NULL DEFAULT false,  -- system constraints cannot be deleted
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    created_by       UUID         REFERENCES app_users(id) ON DELETE SET NULL,
    updated_by       UUID         REFERENCES app_users(id) ON DELETE SET NULL,

    -- Each pair is unique regardless of order (enforced in application layer too)
    UNIQUE (permission_code_a, permission_code_b)
);

CREATE INDEX idx_sod_code_a  ON sod_constraints(permission_code_a);
CREATE INDEX idx_sod_code_b  ON sod_constraints(permission_code_b);
CREATE INDEX idx_sod_active  ON sod_constraints(active);

-- Seed standard GMP SoD constraints
INSERT INTO sod_constraints (name, description, permission_code_a, permission_code_b, severity, regulation_ref, system) VALUES
  (
    'Create vs Approve Revision',
    'The same person must not be able to both initiate and approve a document revision. This is a fundamental four-eyes principle required by EU-GMP.',
    'documents.revision.submit', 'documents.revision.approve',
    'BLOCK', 'EU-GMP Chapter 4 §4.2 · 21 CFR 211.68(b)', true
  ),
  (
    'Review vs Approve Revision',
    'Reviewers must not simultaneously hold approval authority for the same document revision workflow.',
    'documents.revision.review', 'documents.revision.approve',
    'WARN', 'EU-GMP Annex 11 §12.1', true
  ),
  (
    'Create vs Publish Revision',
    'The person who submits a revision for review must not also be able to publish it to Effective status.',
    'documents.revision.submit', 'documents.revision.publish',
    'BLOCK', 'EU-GMP Chapter 4 §4.9 · ICH Q10 §3.2.2', true
  ),
  (
    'Manage Users vs Manage Roles',
    'User account management and role/permission assignment should be held by different administrators to prevent privilege escalation.',
    'settings.user.manage', 'settings.role.manage',
    'WARN', 'ISO 27001 A.9.2.3 · 21 CFR Part 11 §11.10(d)', true
  ),
  (
    'Request vs Distribute Controlled Copy',
    'A user who can request a controlled copy must not also be able to mark it as distributed.',
    'documents.controlled_copy.request', 'documents.controlled_copy.distribute',
    'WARN', 'EU-GMP Chapter 4 §4.28', true
  );
