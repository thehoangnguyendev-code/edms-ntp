-- V807: the review of a report template (approve, return) becomes the first workflow of a module other than Document Control in Workflow Authorization
-- (phase B of AUTHORIZATION_SYSTEM_WIDE_HYBRID_PLAN_2026_11_15; owner decisions 2026-11-18: every row of the Report Action Catalog is approved as it is in code).
--
-- Nothing changes in who may approve or return a template: the rows below say what ReportTemplateService.approve / reject have always checked, so that the engine can decide it,
-- the screens can show it, and an administrator can see which person is kept apart ("a different person").

-- 1. A relation a policy can FORBID: the actor must NOT hold it on the resource (runtime separation of duties). Every existing row is a required relation (false).
ALTER TABLE workflow_action_policy_relations ADD COLUMN IF NOT EXISTS forbidden BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. The relations of a report template that the review cares about. The adapter (ReportTemplateResourceAdapter) resolves both from the version under review.
INSERT INTO authorization_relation_definitions (id, code, display_name, resource_type, resolver_code, resolver_config, description, active, version, created_at, updated_at)
SELECT gen_random_uuid(), v.code, v.display_name, 'REPORT_TEMPLATE', 'WORKFLOW_PARTICIPANT', v.config::jsonb, v.description, TRUE, 0, now(), now()
FROM (VALUES
    ('AUTHOR',    'Author of the version',     '{"participantType": "AUTHOR"}',    'The person who last changed the version under review (the template, or its open revision).'),
    ('SUBMITTER', 'Submitter of the version',  '{"participantType": "SUBMITTER"}', 'The person who submitted the version under review for approval.')
) AS v(code, display_name, config, description)
WHERE NOT EXISTS (SELECT 1 FROM authorization_relation_definitions d WHERE d.code = v.code AND d.resource_type = 'REPORT_TEMPLATE');

-- 3. The policies: four actions from Pending Approval. A template for GMP decisions is reviewed with the GMP permission (the engine asks for the action with the suffix _GMP when the
--    template is, or the revision under review makes it, a GMP template). Either way the reviewer must not be the author or the submitter.
WITH inserted AS (
    INSERT INTO workflow_action_policies (
        id, module_key, workflow_key, object_type, action_code, from_status,
        required_permission_code, priority, active, is_system, description, created_at, updated_at, version)
    SELECT gen_random_uuid(), 'REPORT', 'REPORT_TEMPLATE', 'REPORT_TEMPLATE', v.action_code, 'PENDING_APPROVAL',
           v.permission, 100, TRUE, TRUE, v.description, now(), now(), 0
    FROM (VALUES
        ('APPROVE',     'reports.definition.approve',     'A holder of the approval permission approves a template that is not for GMP decisions, unless they wrote or submitted the version.'),
        ('APPROVE_GMP', 'reports.definition.approve_gmp', 'A holder of the GMP approval permission approves a template for GMP decisions, unless they wrote or submitted the version.'),
        ('REJECT',      'reports.definition.approve',     'A holder of the approval permission returns a template that is not for GMP decisions to Draft, unless they wrote or submitted the version.'),
        ('REJECT_GMP',  'reports.definition.approve_gmp', 'A holder of the GMP approval permission returns a template for GMP decisions to Draft, unless they wrote or submitted the version.')
    ) AS v(action_code, permission, description)
    WHERE NOT EXISTS (
        SELECT 1 FROM workflow_action_policies p
        WHERE p.module_key = 'REPORT' AND p.workflow_key = 'REPORT_TEMPLATE' AND p.object_type = 'REPORT_TEMPLATE'
          AND p.action_code = v.action_code AND p.from_status = 'PENDING_APPROVAL' AND p.document_type_id IS NULL)
    RETURNING id, required_permission_code
)
INSERT INTO workflow_action_policy_actors (id, policy_id, actor_type, actor_code, created_at)
SELECT gen_random_uuid(), i.id, 'PERMISSION', i.required_permission_code, now() FROM inserted i;

INSERT INTO workflow_action_policy_relations (id, policy_id, relation_definition_id, require_sequence, priority, active, forbidden)
SELECT gen_random_uuid(), policy.id, definition.id, FALSE, 100, TRUE, TRUE
FROM workflow_action_policies policy
JOIN authorization_relation_definitions definition ON definition.resource_type = 'REPORT_TEMPLATE' AND definition.code IN ('AUTHOR', 'SUBMITTER')
WHERE policy.module_key = 'REPORT' AND policy.workflow_key = 'REPORT_TEMPLATE'
ON CONFLICT (policy_id, relation_definition_id) DO NOTHING;
