-- V170: Bring the Document Master lifecycle (Obsolete/Cancel on the DocumentRecord "shell",
-- distinct from the DocumentRevisionRecord workflow already governed by workflow_action_policies
-- / lifecycle_state_policies with object_type='DOCUMENT_REVISION') into the same configurable
-- RBAC model, instead of only the coarse canManageDocumentWorkspace (doc-admin/DCO) bypass.
--
-- Document Master has no workflow participants, so it fits the simpler lifecycle_state_policies
-- engine (ANY actor scope + permission check) rather than the actor-resolution WorkflowActionPolicy
-- engine used for revision transitions.

-- 1) Real, assignable permission codes for the two Document Master transitions.
INSERT INTO permissions (id, code, name, category, module_key, group_key, description, display_order, requires_audit)
SELECT id, code, name, category, module_key, group_key, description, display_order, requires_audit
FROM (VALUES
    ('72111111-1111-1111-1111-111111111220'::uuid, 'documents.document.obsolete', 'Obsolete Document',  'Document Master', 'documents', 'document_master', 'Retire an Active document, obsoleting its effective revision.', 630, TRUE),
    ('72111111-1111-1111-1111-111111111221'::uuid, 'documents.document.cancel',   'Cancel Document',    'Document Master', 'documents', 'document_master', 'Cancel a document master record before or after activation.',    640, TRUE)
) AS v(id, code, name, category, module_key, group_key, description, display_order, requires_audit)
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE code = v.code);

-- Conservative default grant, mirroring the V155 file-access permission seed: existing
-- doc-admin/DCO/QA roles already pass canManageDocumentWorkspace unconditionally, so this
-- is redundant for them but keeps the permission catalog consistent for legacy role rows.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE UPPER(r.code) IN (
    'DOCUMENT_ADMIN', 'DCO', 'DOCUMENT_CONTROL_OFFICER',
    'DOCUMENT_CONTROL_ADMIN', 'QA_ADMIN', 'QA_MANAGER'
)
AND p.code IN ('documents.document.obsolete', 'documents.document.cancel')
AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp WHERE rp.role_id = r.id AND rp.permission_id = p.id
);

-- 2) Lifecycle state policies (object_type = 'DOCUMENT') — additive over the existing
-- canManageDocumentWorkspace bypass in DocumentAuthorizationService: granting a permission
-- set with these codes now lets non-admin users obsolete/cancel documents without needing
-- full doc-admin/DCO rights, without changing behavior for anyone until such a set is assigned.
INSERT INTO lifecycle_state_policies
    (module_key, object_type, capability_code, status_code, actor_scope, required_permission_code, priority, is_system, description)
VALUES
    ('documents', 'DOCUMENT', 'OBSOLETE', 'ACTIVE', 'ANY', 'documents.document.obsolete', 100, TRUE,
     'Any user holding documents.document.obsolete may retire an Active document.'),
    ('documents', 'DOCUMENT', 'CANCEL', NULL, 'ANY', 'documents.document.cancel', 100, TRUE,
     'Any user holding documents.document.cancel may cancel a document master record in any status.');

-- 3) Segregation of duties: the person who authors/submits revisions for a document should
-- not independently hold the authority to obsolete it — mirrors the "Create vs Approve
-- Revision" precedent (V152) but for the master-record lifecycle. Not marked system so admins
-- can tune/remove it if it doesn't fit their SOPs.
INSERT INTO sod_constraints (name, description, permission_code_a, permission_code_b, severity, regulation_ref, system)
SELECT 'Submit Revision vs Obsolete Document',
       'A user who submits document revisions for review should not independently hold authority to obsolete the parent document master record.',
       'documents.revision.submit', 'documents.document.obsolete',
       'WARN', 'General four-eyes / segregation-of-duties principle (EU-GMP Annex 11 §12.1)', false
WHERE NOT EXISTS (
    SELECT 1 FROM sod_constraints
    WHERE (permission_code_a = 'documents.revision.submit' AND permission_code_b = 'documents.document.obsolete')
       OR (permission_code_a = 'documents.document.obsolete' AND permission_code_b = 'documents.revision.submit')
);
