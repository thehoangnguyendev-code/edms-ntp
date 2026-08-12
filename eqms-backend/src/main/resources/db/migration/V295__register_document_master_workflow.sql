-- Register Document Master as a first-class workflow beside Document Revision and
-- Controlled Copy.  All grants use immutable permission/access-profile codes; display
-- names are never evaluated at runtime.

INSERT INTO permissions (id, code, name, category, module_key, group_key, description, display_order, requires_audit)
SELECT v.id, v.code, v.name, v.category, v.module_key, v.group_key, v.description, v.display_order, v.requires_audit
FROM (VALUES
    ('72111111-1111-1111-1111-111111111222'::uuid, 'documents.document.reopen',
     'Reopen Cancelled Document', 'Document Master', 'documents', 'document_master',
     'Reopen a closed-cancelled Draft document with an auditable activity summary.', 650, TRUE)
) AS v(id, code, name, category, module_key, group_key, description, display_order, requires_audit)
WHERE NOT EXISTS (SELECT 1 FROM permissions p WHERE p.code = v.code);

-- Reopen is an exceptional governance action.  The immutable SYSTEM_ADMINISTRATION
-- permission set, not an editable display label, receives the grant by default.
INSERT INTO permission_set_items (id, permission_set_id, permission_id)
SELECT gen_random_uuid(), ps.id, p.id
FROM permission_sets ps
JOIN permissions p ON p.code = 'documents.document.reopen'
WHERE ps.code = 'SYSTEM_ADMINISTRATION'
ON CONFLICT (permission_set_id, permission_id) DO NOTHING;

WITH defaults(action_code, from_status, permission_code, description) AS (
    VALUES
        ('UPDATE_METADATA', 'DRAFT', 'documents.workspace.manage',
         'A user granted document workspace management may update Draft document metadata.'),
        ('CANCEL', 'DRAFT', 'documents.document.cancel',
         'A user granted document workspace management may cancel a Draft document.'),
        ('REOPEN', 'CLOSED_CANCELLED', 'documents.document.reopen',
         'A user explicitly granted document reopen may reopen a closed-cancelled document.'),
        ('OBSOLETE', 'ACTIVE', 'documents.document.obsolete',
         'A user granted document workspace management may obsolete an Active document.')
), inserted AS (
    INSERT INTO workflow_action_policies (
        id, module_key, workflow_key, object_type, action_code, from_status,
        required_permission_code, priority, active, is_system, description,
        created_at, updated_at, version
    )
    SELECT gen_random_uuid(), 'DOCUMENT_CONTROL', 'DOCUMENT', 'DOCUMENT',
           d.action_code, d.from_status, d.permission_code, 100, TRUE, TRUE,
           d.description, now(), now(), 0
    FROM defaults d
    WHERE NOT EXISTS (
        SELECT 1 FROM workflow_action_policies p
        WHERE p.module_key = 'DOCUMENT_CONTROL' AND p.workflow_key = 'DOCUMENT'
          AND p.object_type = 'DOCUMENT' AND p.action_code = d.action_code
          AND p.from_status = d.from_status AND p.document_type_id IS NULL
    )
    RETURNING id, action_code
)
INSERT INTO workflow_action_policy_actors (id, policy_id, actor_type, actor_code, created_at)
SELECT gen_random_uuid(), i.id, 'PERMISSION',
       CASE WHEN i.action_code = 'REOPEN' THEN 'documents.document.reopen'
            ELSE 'documents.workspace.manage' END,
       now()
FROM inserted i;

-- Remove the old duplicate master-action representation.  Revision state policies
-- remain untouched because they govern revision read/preview access, not transitions.
DELETE FROM lifecycle_state_policies
WHERE object_type = 'DOCUMENT'
  AND capability_code IN ('CANCEL', 'OBSOLETE');

-- Correct the lifecycle order introduced by V282; the canonical revision sequence
-- is Draft, Review, Approval, Training, Ready for Publishing, Effective, Obsoleted, Cancelled.
UPDATE revision_statuses
SET sort_order = 5, updated_at = now()
WHERE code = 'READY_FOR_PUBLISHING' AND sort_order <> 5;
