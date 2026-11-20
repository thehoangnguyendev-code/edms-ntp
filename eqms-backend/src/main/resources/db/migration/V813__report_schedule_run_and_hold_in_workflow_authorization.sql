-- V813: the rest of the lifecycle of Report (phase B, after the review of a template of V807 and V809; owner decisions 2026-11-18: every row of AUTHORIZATION_ACTION_CATALOG_REPORT_AS_IS_2026_11_18 is approved as
-- it is in code): the schedule (pause, resume, delete, change the owner), a run that failed (retry) and the legal hold of a report file. The rows say what ReportPlatformService has always checked; nothing
-- changes in who may do what. The rules that mix permissions with ownership are relations computed by the adapter (the person may manage the schedule: holds the manage or the export permission and is
-- either a schedule administrator or its creator, as requireScheduleManagement does).

INSERT INTO authorization_relation_definitions (id, code, display_name, resource_type, resolver_code, resolver_config, description, active, version, created_at, updated_at)
SELECT gen_random_uuid(), v.code, v.display_name, v.resource_type, 'WORKFLOW_PARTICIPANT', v.config::jsonb, v.description, TRUE, 0, now(), now()
FROM (VALUES
    ('MAY_MANAGE', 'May manage the schedule', 'REPORT_SCHEDULE', '{"participantType": "MAY_MANAGE"}', 'Holds the manage or the export permission of reports and is either a schedule administrator or the creator of the schedule.'),
    ('MAY_RETRY', 'May retry the run', 'REPORT_RUN', '{"participantType": "MAY_RETRY"}', 'Holds the create or the export permission of reports and either sees every run or requested this one.'),
    ('HOLD_RIGHT', 'May change a legal hold', 'REPORT_ARTIFACT', '{"participantType": "HOLD_RIGHT"}', 'Holds the retention permission or the definition manage permission of reports.')
) AS v(code, display_name, resource_type, config, description)
WHERE NOT EXISTS (SELECT 1 FROM authorization_relation_definitions d WHERE d.code = v.code AND d.resource_type = v.resource_type);

WITH inserted AS (
    INSERT INTO workflow_action_policies (
        id, module_key, workflow_key, object_type, action_code, from_status,
        required_permission_code, priority, active, is_system, description, relation_match_rule, created_at, updated_at, version)
    SELECT gen_random_uuid(), 'REPORT', v.workflow, v.object_type, v.action_code, v.from_status,
           v.permission, 100, TRUE, TRUE, v.description, 'ANY', now(), now(), 0
    FROM (VALUES
        ('REPORT_SCHEDULE', 'REPORT_SCHEDULE', 'PAUSE', 'ANY', '', 'Whoever may manage the schedule pauses it.'),
        ('REPORT_SCHEDULE', 'REPORT_SCHEDULE', 'RESUME', 'ANY', '', 'Whoever may manage the schedule resumes it.'),
        ('REPORT_SCHEDULE', 'REPORT_SCHEDULE', 'DELETE', 'ANY', '', 'Whoever may manage the schedule deletes it.'),
        ('REPORT_SCHEDULE', 'REPORT_SCHEDULE', 'CHANGE_OWNER', 'ANY', '', 'Whoever may manage the schedule hands it to another active owner, with a reason.'),
        ('REPORT_RUN', 'REPORT_RUN', 'RETRY', 'FAILED', '', 'A person who may request reports and see the run retries a run that failed.'),
        ('REPORT_RUN', 'REPORT_RUN', 'RETRY', 'RETRY_SCHEDULED', '', 'A person who may request reports and see the run retries a run that failed.'),
        ('REPORT_ARTIFACT', 'REPORT_ARTIFACT', 'PLACE_HOLD', 'NOT_HELD', '', 'A person who manages report retention places a legal hold on a report file, with a reason.'),
        ('REPORT_ARTIFACT', 'REPORT_ARTIFACT', 'RELEASE_HOLD', 'HELD', '', 'The same person releases the legal hold, with a reason and a signature.')
    ) AS v(workflow, object_type, action_code, from_status, permission, description)
    WHERE NOT EXISTS (
        SELECT 1 FROM workflow_action_policies p
        WHERE p.module_key = 'REPORT' AND p.workflow_key = v.workflow AND p.object_type = v.object_type
          AND p.action_code = v.action_code AND p.from_status = v.from_status AND p.document_type_id IS NULL)
    RETURNING id, required_permission_code
)
INSERT INTO workflow_action_policy_actors (id, policy_id, actor_type, actor_code, created_at)
SELECT gen_random_uuid(), i.id, 'PERMISSION', i.required_permission_code, now() FROM inserted i WHERE i.required_permission_code <> '';

INSERT INTO workflow_action_policy_relations (id, policy_id, relation_definition_id, require_sequence, priority, active, forbidden)
SELECT gen_random_uuid(), p.id, d.id, FALSE, 100, TRUE, r.forbidden
FROM (VALUES
    ('REPORT_SCHEDULE', 'PAUSE', 'ANY', 'MAY_MANAGE', FALSE),
    ('REPORT_SCHEDULE', 'RESUME', 'ANY', 'MAY_MANAGE', FALSE),
    ('REPORT_SCHEDULE', 'DELETE', 'ANY', 'MAY_MANAGE', FALSE),
    ('REPORT_SCHEDULE', 'CHANGE_OWNER', 'ANY', 'MAY_MANAGE', FALSE),
    ('REPORT_RUN', 'RETRY', 'FAILED', 'MAY_RETRY', FALSE),
    ('REPORT_RUN', 'RETRY', 'RETRY_SCHEDULED', 'MAY_RETRY', FALSE),
    ('REPORT_ARTIFACT', 'PLACE_HOLD', 'NOT_HELD', 'HOLD_RIGHT', FALSE),
    ('REPORT_ARTIFACT', 'RELEASE_HOLD', 'HELD', 'HOLD_RIGHT', FALSE)
) AS r(object_type, action_code, from_status, relation_code, forbidden)
JOIN workflow_action_policies p ON p.module_key = 'REPORT' AND p.object_type = r.object_type AND p.action_code = r.action_code AND p.from_status = r.from_status
JOIN authorization_relation_definitions d ON d.code = r.relation_code AND d.resource_type = r.object_type
ON CONFLICT (policy_id, relation_definition_id) DO NOTHING;
