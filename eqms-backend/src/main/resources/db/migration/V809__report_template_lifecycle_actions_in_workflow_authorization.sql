-- V809: the other actions of the lifecycle of a report template (submit, upgrade, enable or disable, discard a draft revision, delete) join the review in Workflow Authorization
-- (phase B; owner decisions 2026-11-18: every row of the Report Action Catalog is approved as it is in code). The rows say what ReportTemplateService has always required: the permission.
-- The state of the template (draft, effective, version) stays a precondition of the service, not a decision of the engine, so these policies apply from any state (from_status ANY).
-- A GMP template is never deleted (owner decision 2026-10-14): the engine asks for DELETE_GMP, for which no policy exists, and refuses.
WITH inserted AS (
    INSERT INTO workflow_action_policies (
        id, module_key, workflow_key, object_type, action_code, from_status,
        required_permission_code, priority, active, is_system, description, created_at, updated_at, version)
    SELECT gen_random_uuid(), 'REPORT', 'REPORT_TEMPLATE', 'REPORT_TEMPLATE', v.action_code, 'ANY',
           v.permission, 100, TRUE, TRUE, v.description, now(), now(), 0
    FROM (VALUES
        ('SUBMIT', 'reports.definition.manage', 'A holder of the manage permission submits a draft template for approval.'),
        ('UPGRADE', 'reports.definition.upgrade', 'A holder of the upgrade permission starts a new revision of a template that has an effective revision.'),
        ('SET_ENABLED', 'reports.definition.set_enabled', 'A holder of the enable permission turns an approved template on or off.'),
        ('DISCARD_REVISION', 'reports.definition.discard_revision', 'A holder of the discard permission discards an open draft revision.'),
        ('DELETE', 'reports.definition.manage', 'A holder of the manage permission deletes a template that is not for GMP decisions. A GMP template is disabled, never deleted (no DELETE_GMP policy exists).')
    ) AS v(action_code, permission, description)
    WHERE NOT EXISTS (
        SELECT 1 FROM workflow_action_policies p
        WHERE p.module_key = 'REPORT' AND p.workflow_key = 'REPORT_TEMPLATE' AND p.object_type = 'REPORT_TEMPLATE'
          AND p.action_code = v.action_code AND p.from_status = 'ANY' AND p.document_type_id IS NULL)
    RETURNING id, required_permission_code
)
INSERT INTO workflow_action_policy_actors (id, policy_id, actor_type, actor_code, created_at)
SELECT gen_random_uuid(), i.id, 'PERMISSION', i.required_permission_code, now() FROM inserted i;
