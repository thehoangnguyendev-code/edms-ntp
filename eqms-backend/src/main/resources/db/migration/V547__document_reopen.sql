-- V547: Reopen a closed Document (owner decision 2026-10-07).
--
-- An Administrator can reopen a Document that is Closed - Cancelled or Obsoleted, with an e-signature and an audit entry; it
-- returns to the state it was in before it was closed. Only the Document master moves: its Revisions and Controlled Copies stay
-- closed (a new Revision is created, and new Controlled Copies are issued, once the Document is active again).

-- 1) The state before closure, recorded when the Document is closed from now on. Documents closed before this migration have no
--    value: the application then derives it (an Obsolete is only possible from ACTIVE, a Cancel only from DRAFT).
ALTER TABLE documents ADD COLUMN IF NOT EXISTS status_before_closure VARCHAR(50);

-- 2) The permission (created by V295 for cancelled documents) now covers both closed states.
UPDATE permissions
SET name = 'Reopen Document',
    description = 'Reopen a Closed - Cancelled or Obsoleted document to the state it had before it was closed, with an e-signature and an audit entry. Its revisions and controlled copies stay closed.'
WHERE code = 'documents.document.reopen';

-- 3) Administrators only. V295 gave it to SYSTEM_ADMINISTRATION and, later, document-control sets received it as well; those two
--    sets lose it (the removed grants were exported to backups/reopen-permission-grants-before-2026-10-07.csv) and both
--    Administrator sets hold it.
DELETE FROM permission_set_items
WHERE permission_id = (SELECT id FROM permissions WHERE code = 'documents.document.reopen')
  AND permission_set_id IN (SELECT id FROM permission_sets WHERE code IN ('ROLE_DCO', 'ROLE_DOCUMENT_CONTROLLER'));

INSERT INTO permission_set_items (id, permission_set_id, permission_id)
SELECT gen_random_uuid(), ps.id, p.id
FROM permission_sets ps
JOIN permissions p ON p.code = 'documents.document.reopen'
WHERE ps.code IN ('ROLE_ADMINISTRATOR', 'SYSTEM_ADMINISTRATION')
ON CONFLICT (permission_set_id, permission_id) DO NOTHING;

-- 4) The rules the authorization engine reads for REOPEN: one per closed state, any actor holding the permission.
INSERT INTO lifecycle_state_policies
    (module_key, object_type, capability_code, status_code, actor_scope, required_permission_code, priority, is_system, description)
SELECT 'documents', 'DOCUMENT', 'REOPEN', v.status_code, 'ANY', 'documents.document.reopen', 100, TRUE,
       'Any user holding documents.document.reopen may reopen a document that is ' || v.label || '.'
FROM (VALUES ('CLOSED_CANCELLED', 'Closed - Cancelled'), ('OBSOLETED', 'Obsoleted')) AS v(status_code, label)
WHERE NOT EXISTS (
    SELECT 1 FROM lifecycle_state_policies p
    WHERE p.object_type = 'DOCUMENT' AND p.capability_code = 'REOPEN' AND p.status_code = v.status_code);

-- ... and the matching administrator-visible policy for Obsoleted (Closed - Cancelled exists since V295).
WITH inserted AS (
    INSERT INTO workflow_action_policies (
        id, module_key, workflow_key, object_type, action_code, from_status,
        required_permission_code, priority, active, is_system, description, created_at, updated_at, version)
    SELECT gen_random_uuid(), 'DOCUMENT_CONTROL', 'DOCUMENT', 'DOCUMENT', 'REOPEN', 'OBSOLETED',
           'documents.document.reopen', 100, TRUE, TRUE,
           'A user explicitly granted document reopen may reopen an obsoleted document.', now(), now(), 0
    WHERE NOT EXISTS (
        SELECT 1 FROM workflow_action_policies p
        WHERE p.module_key = 'DOCUMENT_CONTROL' AND p.workflow_key = 'DOCUMENT' AND p.object_type = 'DOCUMENT'
          AND p.action_code = 'REOPEN' AND p.from_status = 'OBSOLETED' AND p.document_type_id IS NULL)
    RETURNING id
)
INSERT INTO workflow_action_policy_actors (id, policy_id, actor_type, actor_code, created_at)
SELECT gen_random_uuid(), i.id, 'PERMISSION', 'documents.document.reopen', now() FROM inserted i;

-- 5) The e-signature meaning, so that an administrator can rename its display label like the others.
INSERT INTO electronic_signature_meanings (id, code, display_name)
VALUES (gen_random_uuid(), 'DOCUMENT_REOPENED', 'Document Reopened')
ON CONFLICT (code) DO NOTHING;
