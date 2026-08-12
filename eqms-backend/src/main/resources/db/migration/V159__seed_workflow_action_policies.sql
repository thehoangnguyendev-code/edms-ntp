-- V159: Seed default system workflow action policies + authorization permissions (Sprint 4)

-- ── Security permissions for policy management ────────────────────────────────

INSERT INTO permissions (id, code, name, category, module_key, group_key, description, display_order, requires_audit)
SELECT id, code, name, category, module_key, group_key, description, display_order, requires_audit
FROM (VALUES
    ('75111111-1111-1111-1111-111111111901'::uuid,
     'security.workflow_authorization.view',
     'View Workflow Authorization Policies',
     'Workflow Authorization',
     'security',
     'workflow_authorization',
     'View workflow action policy configuration.',
     610,
     FALSE),
    ('75111111-1111-1111-1111-111111111902'::uuid,
     'security.workflow_authorization.manage',
     'Manage Workflow Authorization Policies',
     'Workflow Authorization',
     'security',
     'workflow_authorization',
     'Create, update, and reset workflow action policies.',
     611,
     TRUE)
) AS v(id, code, name, category, module_key, group_key, description, display_order, requires_audit)
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE code = v.code);

-- Assign to DCO / Document Admin roles
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE UPPER(r.code) IN ('DOCUMENT_ADMIN', 'DCO', 'DOCUMENT_CONTROL_OFFICER', 'DOCUMENT_CONTROL_ADMIN', 'SYSTEM_ADMIN', 'QA_ADMIN')
  AND p.code IN ('security.workflow_authorization.view', 'security.workflow_authorization.manage')
  AND NOT EXISTS (
      SELECT 1 FROM role_permissions rp WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

-- ── Helper: insert policy + actors idempotently ───────────────────────────────
-- We insert policies only if no active system policy for (action_code, from_status) exists.

-- 1. COMPLETE_AUTHORING (DRAFT → Author only)
WITH ins AS (
    INSERT INTO workflow_action_policies
        (module_key, workflow_key, object_type, action_code, from_status,
         required_permission_code, priority, active, is_system, description)
    SELECT 'DOCUMENT_CONTROL','DOCUMENT_REVISION','REVISION',
           'COMPLETE_AUTHORING','DRAFT',
           'documents.revision.complete_authoring', 100, TRUE, TRUE,
           'Author completes editing and locks the source file.'
    WHERE NOT EXISTS (
        SELECT 1 FROM workflow_action_policies
        WHERE action_code = 'COMPLETE_AUTHORING' AND from_status = 'DRAFT'
          AND module_key = 'DOCUMENT_CONTROL' AND is_system = TRUE AND active = TRUE
    )
    RETURNING id
)
INSERT INTO workflow_action_policy_actors (policy_id, actor_type)
SELECT id, 'AUTHOR' FROM ins;

-- 2. OPEN_PUBLISHING_WORKSPACE (DRAFT → DCO, DOCUMENT_ADMIN)
WITH ins AS (
    INSERT INTO workflow_action_policies
        (module_key, workflow_key, object_type, action_code, from_status,
         required_permission_code, priority, active, is_system, description)
    SELECT 'DOCUMENT_CONTROL','DOCUMENT_REVISION','REVISION',
           'OPEN_PUBLISHING_WORKSPACE','DRAFT',
           'documents.revision.open_publishing_workspace', 100, TRUE, TRUE,
           'DCO/Document Admin opens the publishing workspace.'
    WHERE NOT EXISTS (
        SELECT 1 FROM workflow_action_policies
        WHERE action_code = 'OPEN_PUBLISHING_WORKSPACE' AND from_status = 'DRAFT'
          AND module_key = 'DOCUMENT_CONTROL' AND is_system = TRUE AND active = TRUE
    )
    RETURNING id
)
INSERT INTO workflow_action_policy_actors (policy_id, actor_type)
SELECT ins.id, a.actor_type
FROM ins
CROSS JOIN (VALUES ('DCO'), ('DOCUMENT_ADMIN')) AS a(actor_type);

-- 3. SUBMIT_FOR_REVIEW (DRAFT → DCO, DOCUMENT_ADMIN)
WITH ins AS (
    INSERT INTO workflow_action_policies
        (module_key, workflow_key, object_type, action_code, from_status,
         required_permission_code, priority, active, is_system, description)
    SELECT 'DOCUMENT_CONTROL','DOCUMENT_REVISION','REVISION',
           'SUBMIT_FOR_REVIEW','DRAFT',
           'documents.revision.submit_review', 100, TRUE, TRUE,
           'DCO/Document Admin submits the revision for review.'
    WHERE NOT EXISTS (
        SELECT 1 FROM workflow_action_policies
        WHERE action_code = 'SUBMIT_FOR_REVIEW' AND from_status = 'DRAFT'
          AND module_key = 'DOCUMENT_CONTROL' AND is_system = TRUE AND active = TRUE
    )
    RETURNING id
)
INSERT INTO workflow_action_policy_actors (policy_id, actor_type)
SELECT ins.id, a.actor_type
FROM ins
CROSS JOIN (VALUES ('DCO'), ('DOCUMENT_ADMIN')) AS a(actor_type);

-- 4. GENERATE_REVIEW_SNAPSHOT (DRAFT → DCO, DOCUMENT_ADMIN)
WITH ins AS (
    INSERT INTO workflow_action_policies
        (module_key, workflow_key, object_type, action_code, from_status,
         required_permission_code, priority, active, is_system, description)
    SELECT 'DOCUMENT_CONTROL','DOCUMENT_REVISION','REVISION',
           'GENERATE_REVIEW_SNAPSHOT','DRAFT',
           'documents.revision.generate_preview', 100, TRUE, TRUE,
           'DCO/Document Admin generates a review snapshot.'
    WHERE NOT EXISTS (
        SELECT 1 FROM workflow_action_policies
        WHERE action_code = 'GENERATE_REVIEW_SNAPSHOT' AND from_status = 'DRAFT'
          AND module_key = 'DOCUMENT_CONTROL' AND is_system = TRUE AND active = TRUE
    )
    RETURNING id
)
INSERT INTO workflow_action_policy_actors (policy_id, actor_type)
SELECT ins.id, a.actor_type
FROM ins
CROSS JOIN (VALUES ('DCO'), ('DOCUMENT_ADMIN')) AS a(actor_type);

-- 5. REGENERATE_SNAPSHOT (DRAFT → DCO, DOCUMENT_ADMIN)
WITH ins AS (
    INSERT INTO workflow_action_policies
        (module_key, workflow_key, object_type, action_code, from_status,
         required_permission_code, priority, active, is_system, description)
    SELECT 'DOCUMENT_CONTROL','DOCUMENT_REVISION','REVISION',
           'REGENERATE_SNAPSHOT','DRAFT',
           'documents.revision.generate_preview', 100, TRUE, TRUE,
           'DCO/Document Admin regenerates the review snapshot.'
    WHERE NOT EXISTS (
        SELECT 1 FROM workflow_action_policies
        WHERE action_code = 'REGENERATE_SNAPSHOT' AND from_status = 'DRAFT'
          AND module_key = 'DOCUMENT_CONTROL' AND is_system = TRUE AND active = TRUE
    )
    RETURNING id
)
INSERT INTO workflow_action_policy_actors (policy_id, actor_type)
SELECT ins.id, a.actor_type
FROM ins
CROSS JOIN (VALUES ('DCO'), ('DOCUMENT_ADMIN')) AS a(actor_type);

-- 6. COMPLETE_REVIEW (PENDING_REVIEW → ASSIGNED_REVIEWER)
WITH ins AS (
    INSERT INTO workflow_action_policies
        (module_key, workflow_key, object_type, action_code, from_status,
         required_permission_code, priority, active, is_system, description)
    SELECT 'DOCUMENT_CONTROL','DOCUMENT_REVISION','REVISION',
           'COMPLETE_REVIEW','PENDING_REVIEW',
           'documents.revision.review', 100, TRUE, TRUE,
           'Assigned pending reviewer completes their review.'
    WHERE NOT EXISTS (
        SELECT 1 FROM workflow_action_policies
        WHERE action_code = 'COMPLETE_REVIEW' AND from_status = 'PENDING_REVIEW'
          AND module_key = 'DOCUMENT_CONTROL' AND is_system = TRUE AND active = TRUE
    )
    RETURNING id
)
INSERT INTO workflow_action_policy_actors (policy_id, actor_type)
SELECT id, 'ASSIGNED_REVIEWER' FROM ins;

-- 7. REJECT_REVIEW (PENDING_REVIEW → ASSIGNED_REVIEWER)
WITH ins AS (
    INSERT INTO workflow_action_policies
        (module_key, workflow_key, object_type, action_code, from_status,
         required_permission_code, priority, active, is_system, description)
    SELECT 'DOCUMENT_CONTROL','DOCUMENT_REVISION','REVISION',
           'REJECT_REVIEW','PENDING_REVIEW',
           'documents.revision.reject_review', 100, TRUE, TRUE,
           'Assigned pending reviewer rejects the revision.'
    WHERE NOT EXISTS (
        SELECT 1 FROM workflow_action_policies
        WHERE action_code = 'REJECT_REVIEW' AND from_status = 'PENDING_REVIEW'
          AND module_key = 'DOCUMENT_CONTROL' AND is_system = TRUE AND active = TRUE
    )
    RETURNING id
)
INSERT INTO workflow_action_policy_actors (policy_id, actor_type)
SELECT id, 'ASSIGNED_REVIEWER' FROM ins;

-- 8. COMPLETE_APPROVAL (PENDING_APPROVAL → ASSIGNED_APPROVER)
WITH ins AS (
    INSERT INTO workflow_action_policies
        (module_key, workflow_key, object_type, action_code, from_status,
         required_permission_code, priority, active, is_system, description)
    SELECT 'DOCUMENT_CONTROL','DOCUMENT_REVISION','REVISION',
           'COMPLETE_APPROVAL','PENDING_APPROVAL',
           'documents.revision.approve', 100, TRUE, TRUE,
           'Assigned pending approver completes approval.'
    WHERE NOT EXISTS (
        SELECT 1 FROM workflow_action_policies
        WHERE action_code = 'COMPLETE_APPROVAL' AND from_status = 'PENDING_APPROVAL'
          AND module_key = 'DOCUMENT_CONTROL' AND is_system = TRUE AND active = TRUE
    )
    RETURNING id
)
INSERT INTO workflow_action_policy_actors (policy_id, actor_type)
SELECT id, 'ASSIGNED_APPROVER' FROM ins;

-- 9. REJECT_APPROVAL (PENDING_APPROVAL → ASSIGNED_APPROVER)
WITH ins AS (
    INSERT INTO workflow_action_policies
        (module_key, workflow_key, object_type, action_code, from_status,
         required_permission_code, priority, active, is_system, description)
    SELECT 'DOCUMENT_CONTROL','DOCUMENT_REVISION','REVISION',
           'REJECT_APPROVAL','PENDING_APPROVAL',
           'documents.revision.reject_approval', 100, TRUE, TRUE,
           'Assigned pending approver rejects the revision.'
    WHERE NOT EXISTS (
        SELECT 1 FROM workflow_action_policies
        WHERE action_code = 'REJECT_APPROVAL' AND from_status = 'PENDING_APPROVAL'
          AND module_key = 'DOCUMENT_CONTROL' AND is_system = TRUE AND active = TRUE
    )
    RETURNING id
)
INSERT INTO workflow_action_policy_actors (policy_id, actor_type)
SELECT id, 'ASSIGNED_APPROVER' FROM ins;

-- 10. COMPLETE_TRAINING (PENDING_TRAINING → DCO, DOCUMENT_ADMIN)
WITH ins AS (
    INSERT INTO workflow_action_policies
        (module_key, workflow_key, object_type, action_code, from_status,
         required_permission_code, priority, active, is_system, description)
    SELECT 'DOCUMENT_CONTROL','DOCUMENT_REVISION','REVISION',
           'COMPLETE_TRAINING','PENDING_TRAINING',
           'documents.revision.complete_training', 100, TRUE, TRUE,
           'DCO/Document Admin marks training as complete.'
    WHERE NOT EXISTS (
        SELECT 1 FROM workflow_action_policies
        WHERE action_code = 'COMPLETE_TRAINING' AND from_status = 'PENDING_TRAINING'
          AND module_key = 'DOCUMENT_CONTROL' AND is_system = TRUE AND active = TRUE
    )
    RETURNING id
)
INSERT INTO workflow_action_policy_actors (policy_id, actor_type)
SELECT ins.id, a.actor_type
FROM ins
CROSS JOIN (VALUES ('DCO'), ('DOCUMENT_ADMIN')) AS a(actor_type);

-- 11. PUBLISH (READY_FOR_PUBLISHING → DCO, DOCUMENT_ADMIN)
WITH ins AS (
    INSERT INTO workflow_action_policies
        (module_key, workflow_key, object_type, action_code, from_status,
         required_permission_code, priority, active, is_system, description)
    SELECT 'DOCUMENT_CONTROL','DOCUMENT_REVISION','REVISION',
           'PUBLISH','READY_FOR_PUBLISHING',
           'documents.revision.publish', 100, TRUE, TRUE,
           'DCO/Document Admin publishes the approved revision.'
    WHERE NOT EXISTS (
        SELECT 1 FROM workflow_action_policies
        WHERE action_code = 'PUBLISH' AND from_status = 'READY_FOR_PUBLISHING'
          AND module_key = 'DOCUMENT_CONTROL' AND is_system = TRUE AND active = TRUE
    )
    RETURNING id
)
INSERT INTO workflow_action_policy_actors (policy_id, actor_type)
SELECT ins.id, a.actor_type
FROM ins
CROSS JOIN (VALUES ('DCO'), ('DOCUMENT_ADMIN')) AS a(actor_type);

-- 12. CANCEL (multiple from_status → DCO, DOCUMENT_ADMIN)
WITH ins AS (
    INSERT INTO workflow_action_policies
        (module_key, workflow_key, object_type, action_code, from_status,
         required_permission_code, priority, active, is_system, description)
    SELECT 'DOCUMENT_CONTROL','DOCUMENT_REVISION','REVISION',
           'CANCEL', status_val,
           'documents.revision.cancel', 100, TRUE, TRUE,
           'DCO/Document Admin cancels the revision from any non-terminal state.'
    FROM (VALUES ('DRAFT'), ('PENDING_REVIEW'), ('PENDING_APPROVAL'),
                 ('PENDING_TRAINING'), ('READY_FOR_PUBLISHING')) AS s(status_val)
    WHERE NOT EXISTS (
        SELECT 1 FROM workflow_action_policies
        WHERE action_code = 'CANCEL' AND from_status = s.status_val
          AND module_key = 'DOCUMENT_CONTROL' AND is_system = TRUE AND active = TRUE
    )
    RETURNING id
)
INSERT INTO workflow_action_policy_actors (policy_id, actor_type)
SELECT ins.id, a.actor_type
FROM ins
CROSS JOIN (VALUES ('DCO'), ('DOCUMENT_ADMIN')) AS a(actor_type);

-- 13. UPGRADE_REVISION (EFFECTIVE → DCO, DOCUMENT_ADMIN)
WITH ins AS (
    INSERT INTO workflow_action_policies
        (module_key, workflow_key, object_type, action_code, from_status,
         required_permission_code, priority, active, is_system, description)
    SELECT 'DOCUMENT_CONTROL','DOCUMENT_REVISION','REVISION',
           'UPGRADE_REVISION','EFFECTIVE',
           'documents.revision.upgrade', 100, TRUE, TRUE,
           'DCO/Document Admin creates a new revision from an effective document.'
    WHERE NOT EXISTS (
        SELECT 1 FROM workflow_action_policies
        WHERE action_code = 'UPGRADE_REVISION' AND from_status = 'EFFECTIVE'
          AND module_key = 'DOCUMENT_CONTROL' AND is_system = TRUE AND active = TRUE
    )
    RETURNING id
)
INSERT INTO workflow_action_policy_actors (policy_id, actor_type)
SELECT ins.id, a.actor_type
FROM ins
CROSS JOIN (VALUES ('DCO'), ('DOCUMENT_ADMIN')) AS a(actor_type);
