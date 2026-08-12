-- Workflow policies must grant capability through immutable permission codes, never
-- through mutable display-role labels such as DCO or Document Admin.
-- Preserve every existing policy by replacing either legacy actor with one canonical
-- permission actor.  Relation actors (AUTHOR, ASSIGNED_REVIEWER, etc.) remain intact.

INSERT INTO workflow_action_policy_actors (id, policy_id, actor_type, actor_code, created_at)
SELECT gen_random_uuid(), legacy.policy_id, 'PERMISSION', 'documents.workspace.manage', now()
FROM (
    SELECT DISTINCT policy_id
    FROM workflow_action_policy_actors
    WHERE actor_type IN ('DCO', 'DOCUMENT_ADMIN', 'TRAINING_COORDINATOR')
) legacy
WHERE NOT EXISTS (
    SELECT 1
    FROM workflow_action_policy_actors target
    WHERE target.policy_id = legacy.policy_id
      AND target.actor_type = 'PERMISSION'
      AND target.actor_code = 'documents.workspace.manage'
);

DELETE FROM workflow_action_policy_actors
WHERE actor_type IN ('DCO', 'DOCUMENT_ADMIN', 'TRAINING_COORDINATOR', 'WORKFLOW_ROLE', 'DOCUMENT_WORKFLOW_POOL');

-- Notification audiences use the same immutable permission codes. Existing policy
-- JSON is migrated in place so notification delivery remains unchanged after deploy.
UPDATE notification_policies
SET recipient_rules = (
    SELECT COALESCE(jsonb_agg(
        CASE element->>'type'
            WHEN 'QA_MANAGER' THEN jsonb_build_object('type', 'PERMISSION', 'value', 'notifications.recipient.qa_manager')
            WHEN 'DCO' THEN jsonb_build_object('type', 'PERMISSION', 'value', 'documents.workspace.manage')
            ELSE element
        END
    ), '[]'::jsonb)
    FROM jsonb_array_elements(recipient_rules) element
)
WHERE recipient_rules @> '[{"type":"QA_MANAGER"}]'::jsonb
   OR recipient_rules @> '[{"type":"DCO"}]'::jsonb;

UPDATE notification_policies
SET escalation_recipient_rules = (
    SELECT COALESCE(jsonb_agg(
        CASE element->>'type'
            WHEN 'QA_MANAGER' THEN jsonb_build_object('type', 'PERMISSION', 'value', 'notifications.recipient.qa_manager')
            WHEN 'DCO' THEN jsonb_build_object('type', 'PERMISSION', 'value', 'documents.workspace.manage')
            ELSE element
        END
    ), '[]'::jsonb)
    FROM jsonb_array_elements(escalation_recipient_rules) element
)
WHERE escalation_recipient_rules @> '[{"type":"QA_MANAGER"}]'::jsonb
   OR escalation_recipient_rules @> '[{"type":"DCO"}]'::jsonb;
