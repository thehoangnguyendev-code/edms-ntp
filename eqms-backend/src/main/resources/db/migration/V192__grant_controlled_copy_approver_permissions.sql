-- Enables the "Approver" test persona (PS_APPROVER_TEST / Access Profile APPROVER_TEST /
-- Workflow Role DOCUMENT_APPROVER, held by user.f.test) to act as the controlled-copy approver:
-- per product decision, there is no separate Pending-Approval lifecycle stage for controlled
-- copies — the assigned approver reviews the request while it sits in "Ready for Distribution"
-- (visible on All Controlled Copies) and approves it by performing the "Distribute Batch" action.

-- 1) Grant the permissions needed to see and act on controlled copies: view the record, preview
--    and download the file to review it, and distribute the batch (the approval-equivalent action).
INSERT INTO permission_set_items (id, permission_set_id, permission_id)
SELECT gen_random_uuid(), ps.id, p.id
FROM permission_sets ps
JOIN permissions p ON p.code IN (
    'documents.controlled_copy.view',
    'documents.controlled_copy.preview_file',
    'documents.controlled_copy.download_file',
    'documents.controlled_copy.distribute'
)
WHERE ps.code = 'PS_APPROVER_TEST'
AND NOT EXISTS (
    SELECT 1 FROM permission_set_items psi
    WHERE psi.permission_set_id = ps.id AND psi.permission_id = p.id
);

-- 2) The DISTRIBUTE_BATCH workflow-action policy only lists DCO/DOCUMENT_ADMIN as allowed actors
--    (ControlledCopyAuthorizationService.matchesActor). Scope the Approver workflow role into that
--    actor list too, rather than granting the much broader DCO/Document Admin capability.
INSERT INTO workflow_action_policy_actors (id, policy_id, actor_type, actor_code)
SELECT gen_random_uuid(), wap.id, 'WORKFLOW_ROLE', 'DOCUMENT_APPROVER'
FROM workflow_action_policies wap
WHERE wap.workflow_key = 'CONTROLLED_COPY'
  AND wap.object_type = 'CONTROLLED_COPY_BATCH'
  AND wap.action_code = 'DISTRIBUTE_BATCH'
AND NOT EXISTS (
    SELECT 1 FROM workflow_action_policy_actors a
    WHERE a.policy_id = wap.id AND a.actor_type = 'WORKFLOW_ROLE' AND a.actor_code = 'DOCUMENT_APPROVER'
);
