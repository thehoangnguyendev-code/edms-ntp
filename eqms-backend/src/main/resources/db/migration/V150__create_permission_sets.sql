-- V150: Permission Sets — named, reusable bundles of permissions
-- A permission set acts as a template that can be applied to roles.
-- Supports GMP requirement for standardized access templates (e.g., "Document Author Pack").

CREATE TABLE permission_sets (
    id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    name          VARCHAR(200) NOT NULL,
    code          VARCHAR(100) NOT NULL UNIQUE,
    description   TEXT,
    active        BOOLEAN      NOT NULL DEFAULT true,
    system        BOOLEAN      NOT NULL DEFAULT false,  -- system sets cannot be deleted
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    created_by    UUID         REFERENCES app_users(id) ON DELETE SET NULL,
    updated_by    UUID         REFERENCES app_users(id) ON DELETE SET NULL
);

CREATE TABLE permission_set_items (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    permission_set_id UUID NOT NULL REFERENCES permission_sets(id) ON DELETE CASCADE,
    permission_id     UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    UNIQUE (permission_set_id, permission_id)
);

CREATE INDEX idx_psi_permission_set ON permission_set_items(permission_set_id);
CREATE INDEX idx_psi_permission     ON permission_set_items(permission_id);

-- Seed system permission sets matching GMP standard roles
INSERT INTO permission_sets (name, code, description, system) VALUES
  ('Document Author',       'DOCUMENT_AUTHOR',    'Standard permissions for document authors: create, edit, submit revisions.', true),
  ('Document Reviewer',     'DOCUMENT_REVIEWER',  'Permissions required to review submitted document revisions.', true),
  ('Document Approver',     'DOCUMENT_APPROVER',  'Permissions required to approve document revisions.', true),
  ('Quality Administrator', 'QUALITY_ADMIN',      'Full document control administration permissions (GMP-gated).', true),
  ('Training Coordinator',  'TRAINING_COORD',     'Manage training assignments, courses, and completion records.', true),
  ('Read-Only Viewer',      'READ_ONLY',          'View-only access across all modules. No create/edit/approve capability.', true);
