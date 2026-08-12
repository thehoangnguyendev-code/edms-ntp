-- V169: Lifecycle State Policies — configurable state-based visibility/capability rules
-- (Veeva-style lifecycle security). Externalizes the strict participant-visibility rule
-- introduced with app.security.participant-visibility-strict so admins can tune it per
-- capability × revision status × document type without code changes.
--
-- Evaluation model (additive, ALLOW-only): a user may perform <capability_code> on a
-- revision when ANY active matching row (status_code NULL = any status, document_type_id
-- NULL = all types; highest priority first) passes BOTH its actor_scope check
-- (ANY / AUTHOR / PARTICIPANT) AND its required_permission_code check (NULL = none).
-- No matching row -> denied. Admin bypass (doc-admin/DCO/superadmin) stays structural
-- in code and is never expressed as a policy row.

CREATE TABLE IF NOT EXISTS lifecycle_state_policies (
    id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    module_key                VARCHAR(80)  NOT NULL DEFAULT 'documents',
    object_type               VARCHAR(80)  NOT NULL DEFAULT 'DOCUMENT_REVISION',
    capability_code           VARCHAR(80)  NOT NULL,
    status_code               VARCHAR(80)  NULL,
    document_type_id          UUID         NULL,
    actor_scope               VARCHAR(30)  NOT NULL,
    required_permission_code  VARCHAR(160) NULL,
    priority                  INT          NOT NULL DEFAULT 100,
    active                    BOOLEAN      NOT NULL DEFAULT TRUE,
    is_system                 BOOLEAN      NOT NULL DEFAULT FALSE,
    description               TEXT         NULL,
    created_by                UUID         NULL,
    created_at                TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_by                UUID         NULL,
    updated_at                TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lsp_lookup
    ON lifecycle_state_policies (module_key, object_type, capability_code, active);

CREATE INDEX IF NOT EXISTS idx_lsp_document_type
    ON lifecycle_state_policies (document_type_id)
    WHERE document_type_id IS NOT NULL;

-- ── System seeds: exact parity with the Phase A hardcoded strict rule ─────────

-- VIEW: effective-like revisions readable by any view-permission holder
INSERT INTO lifecycle_state_policies
    (capability_code, status_code, actor_scope, required_permission_code, priority, is_system, description)
VALUES
    ('VIEW', 'EFFECTIVE',  'ANY', 'documents.document.view', 100, TRUE,
     'Effective revisions are readable by any user holding the document view permission.'),
    ('VIEW', 'OBSOLETED',  'ANY', 'documents.document.view', 100, TRUE,
     'Obsoleted revisions remain readable by any user holding the document view permission.'),
-- VIEW: author and assigned participants see the revision in every status
    ('VIEW', NULL, 'AUTHOR', NULL, 90, TRUE,
     'The revision author can always view their own revision.'),
    ('VIEW', NULL, 'PARTICIPANT', NULL, 90, TRUE,
     'Assigned workflow participants (co-author/reviewer/approver) can view the revision in any status.'),
-- PREVIEW: in-flight snapshot content restricted to author/participants
    ('PREVIEW', 'PENDING_REVIEW', 'PARTICIPANT', 'documents.revision.preview', 100, TRUE,
     'Assigned participants may preview the review snapshot during review.'),
    ('PREVIEW', 'PENDING_APPROVAL', 'PARTICIPANT', 'documents.revision.preview', 100, TRUE,
     'Assigned participants may preview the review snapshot during approval.'),
    ('PREVIEW', 'PENDING_TRAINING', 'PARTICIPANT', 'documents.revision.preview', 100, TRUE,
     'Assigned participants may preview the review snapshot during training.'),
    ('PREVIEW', 'READY_FOR_PUBLISHING', 'PARTICIPANT', 'documents.revision.preview', 100, TRUE,
     'Assigned participants may preview the review snapshot while ready for publishing.'),
    ('PREVIEW', 'PENDING_REVIEW', 'AUTHOR', 'documents.revision.preview', 100, TRUE,
     'The author may preview the review snapshot during review.'),
    ('PREVIEW', 'PENDING_APPROVAL', 'AUTHOR', 'documents.revision.preview', 100, TRUE,
     'The author may preview the review snapshot during approval.'),
    ('PREVIEW', 'PENDING_TRAINING', 'AUTHOR', 'documents.revision.preview', 100, TRUE,
     'The author may preview the review snapshot during training.'),
    ('PREVIEW', 'READY_FOR_PUBLISHING', 'AUTHOR', 'documents.revision.preview', 100, TRUE,
     'The author may preview the review snapshot while ready for publishing.')
ON CONFLICT DO NOTHING;
