-- V160: Seed default Controlled Copy workflow policies
-- Runtime authorization uses these policies as the source of truth for controlled-copy actions.
-- Actor rows are intentionally explicit. Blank actor_code is not accepted for ACCESS_PROFILE,
-- WORKFLOW_ROLE, or DOCUMENT_WORKFLOW_POOL in controlled-copy authorization.

WITH seeded_policies AS (
    INSERT INTO workflow_action_policies (
        id, module_key, workflow_key, object_type, action_code, from_status,
        document_type_id, required_permission_code, priority, active, is_system, description
    )
    SELECT * FROM (VALUES
        (gen_random_uuid(), 'DOCUMENT_CONTROL', 'CONTROLLED_COPY', 'CONTROLLED_COPY', 'REQUEST_COPY', 'EFFECTIVE', NULL::uuid, 'documents.controlled_copy.request', 100, TRUE, TRUE, 'Request a controlled copy from an effective revision'),
        (gen_random_uuid(), 'DOCUMENT_CONTROL', 'CONTROLLED_COPY', 'CONTROLLED_COPY', 'APPROVE_REQUEST', 'READY_FOR_DISTRIBUTION', NULL::uuid, 'documents.controlled_copy.approve_request', 100, TRUE, TRUE, 'Approve controlled copy request'),
        (gen_random_uuid(), 'DOCUMENT_CONTROL', 'CONTROLLED_COPY', 'CONTROLLED_COPY', 'REJECT_REQUEST', 'READY_FOR_DISTRIBUTION', NULL::uuid, 'documents.controlled_copy.reject_request', 100, TRUE, TRUE, 'Reject controlled copy request'),
        (gen_random_uuid(), 'DOCUMENT_CONTROL', 'CONTROLLED_COPY', 'CONTROLLED_COPY', 'PREPARE_DISTRIBUTION', 'READY_FOR_DISTRIBUTION', NULL::uuid, 'documents.controlled_copy.prepare_distribution', 100, TRUE, TRUE, 'Prepare controlled copy distribution'),
        (gen_random_uuid(), 'DOCUMENT_CONTROL', 'CONTROLLED_COPY', 'CONTROLLED_COPY', 'VIEW_COPY', 'READY_FOR_DISTRIBUTION', NULL::uuid, 'documents.controlled_copy.view', 100, TRUE, TRUE, 'View controlled copy before distribution'),
        (gen_random_uuid(), 'DOCUMENT_CONTROL', 'CONTROLLED_COPY', 'CONTROLLED_COPY', 'VIEW_COPY', 'DISTRIBUTED', NULL::uuid, 'documents.controlled_copy.view', 100, TRUE, TRUE, 'View distributed controlled copy'),
        (gen_random_uuid(), 'DOCUMENT_CONTROL', 'CONTROLLED_COPY', 'CONTROLLED_COPY', 'PREVIEW_FILE', 'READY_FOR_DISTRIBUTION', NULL::uuid, 'documents.controlled_copy.preview_file', 100, TRUE, TRUE, 'Preview controlled copy file before distribution'),
        (gen_random_uuid(), 'DOCUMENT_CONTROL', 'CONTROLLED_COPY', 'CONTROLLED_COPY', 'PREVIEW_FILE', 'DISTRIBUTED', NULL::uuid, 'documents.controlled_copy.preview_file', 100, TRUE, TRUE, 'Preview distributed controlled copy file'),
        (gen_random_uuid(), 'DOCUMENT_CONTROL', 'CONTROLLED_COPY', 'CONTROLLED_COPY', 'DOWNLOAD_FILE', 'DISTRIBUTED', NULL::uuid, 'documents.controlled_copy.download_file', 100, TRUE, TRUE, 'Download distributed controlled copy file'),
        (gen_random_uuid(), 'DOCUMENT_CONTROL', 'CONTROLLED_COPY', 'CONTROLLED_COPY', 'RECALL_COPY', 'READY_FOR_DISTRIBUTION', NULL::uuid, 'documents.controlled_copy.recall', 100, TRUE, TRUE, 'Recall controlled copy before distribution'),
        (gen_random_uuid(), 'DOCUMENT_CONTROL', 'CONTROLLED_COPY', 'CONTROLLED_COPY', 'RECALL_COPY', 'DISTRIBUTED', NULL::uuid, 'documents.controlled_copy.recall', 100, TRUE, TRUE, 'Recall distributed controlled copy'),
        (gen_random_uuid(), 'DOCUMENT_CONTROL', 'CONTROLLED_COPY', 'CONTROLLED_COPY', 'REPORT_LOST_DAMAGED', 'DISTRIBUTED', NULL::uuid, 'documents.controlled_copy.report_lost_damaged', 100, TRUE, TRUE, 'Report controlled copy as lost or damaged'),
        (gen_random_uuid(), 'DOCUMENT_CONTROL', 'CONTROLLED_COPY', 'CONTROLLED_COPY', 'REPLACE_LOST_DAMAGED', 'OBSOLETED', NULL::uuid, 'documents.controlled_copy.replace_lost_damaged', 100, TRUE, TRUE, 'Replace a lost or damaged controlled copy'),
        (gen_random_uuid(), 'DOCUMENT_CONTROL', 'CONTROLLED_COPY', 'CONTROLLED_COPY', 'UPLOAD_EVIDENCE', 'OBSOLETED', NULL::uuid, 'documents.controlled_copy.upload_evidence', 100, TRUE, TRUE, 'Upload evidence for an obsoleted controlled copy'),
        (gen_random_uuid(), 'DOCUMENT_CONTROL', 'CONTROLLED_COPY', 'CONTROLLED_COPY', 'EXPIRE_COPY', 'READY_FOR_DISTRIBUTION', NULL::uuid, 'documents.controlled_copy.expire', 100, TRUE, TRUE, 'Expire a controlled copy before distribution'),
        (gen_random_uuid(), 'DOCUMENT_CONTROL', 'CONTROLLED_COPY', 'CONTROLLED_COPY', 'EXPIRE_COPY', 'DISTRIBUTED', NULL::uuid, 'documents.controlled_copy.expire', 100, TRUE, TRUE, 'Expire a distributed controlled copy'),
        (gen_random_uuid(), 'DOCUMENT_CONTROL', 'CONTROLLED_COPY', 'CONTROLLED_COPY', 'DESTROY_COPY', 'OBSOLETED', NULL::uuid, 'documents.controlled_copy.destroy', 100, TRUE, TRUE, 'Destroy an obsoleted controlled copy'),
        (gen_random_uuid(), 'DOCUMENT_CONTROL', 'CONTROLLED_COPY', 'CONTROLLED_COPY', 'CONFIRM_DESTROY', 'OBSOLETED', NULL::uuid, 'documents.controlled_copy.confirm_destroy', 100, TRUE, TRUE, 'Confirm controlled copy destruction'),
        (gen_random_uuid(), 'DOCUMENT_CONTROL', 'CONTROLLED_COPY', 'CONTROLLED_COPY', 'CANCEL_REQUEST', 'READY_FOR_DISTRIBUTION', NULL::uuid, 'documents.controlled_copy.cancel_request', 100, TRUE, TRUE, 'Cancel a controlled copy before distribution'),
        (gen_random_uuid(), 'DOCUMENT_CONTROL', 'CONTROLLED_COPY', 'CONTROLLED_COPY_BATCH', 'APPROVE_REQUEST', 'READY_FOR_DISTRIBUTION', NULL::uuid, 'documents.controlled_copy.approve_request', 100, TRUE, TRUE, 'Approve a controlled copy batch request'),
        (gen_random_uuid(), 'DOCUMENT_CONTROL', 'CONTROLLED_COPY', 'CONTROLLED_COPY_BATCH', 'REJECT_REQUEST', 'READY_FOR_DISTRIBUTION', NULL::uuid, 'documents.controlled_copy.reject_request', 100, TRUE, TRUE, 'Reject a controlled copy batch request'),
        (gen_random_uuid(), 'DOCUMENT_CONTROL', 'CONTROLLED_COPY', 'CONTROLLED_COPY_BATCH', 'PREPARE_DISTRIBUTION', 'READY_FOR_DISTRIBUTION', NULL::uuid, 'documents.controlled_copy.prepare_distribution', 100, TRUE, TRUE, 'Prepare a controlled copy batch distribution'),
        (gen_random_uuid(), 'DOCUMENT_CONTROL', 'CONTROLLED_COPY', 'CONTROLLED_COPY_BATCH', 'DISTRIBUTE_BATCH', 'READY_FOR_DISTRIBUTION', NULL::uuid, 'documents.controlled_copy.distribute', 100, TRUE, TRUE, 'Distribute a controlled copy batch'),
        (gen_random_uuid(), 'DOCUMENT_CONTROL', 'CONTROLLED_COPY', 'CONTROLLED_COPY_BATCH', 'RECALL_BATCH', 'DISTRIBUTED', NULL::uuid, 'documents.controlled_copy.recall', 100, TRUE, TRUE, 'Recall a controlled copy batch'),
        (gen_random_uuid(), 'DOCUMENT_CONTROL', 'CONTROLLED_COPY', 'CONTROLLED_COPY_BATCH', 'CANCEL_REQUEST', 'READY_FOR_DISTRIBUTION', NULL::uuid, 'documents.controlled_copy.cancel_request', 100, TRUE, TRUE, 'Cancel a controlled copy batch before distribution')
    ) AS v(id, module_key, workflow_key, object_type, action_code, from_status, document_type_id, required_permission_code, priority, active, is_system, description)
    WHERE NOT EXISTS (
        SELECT 1 FROM workflow_action_policies p
        WHERE p.module_key = v.module_key
          AND p.workflow_key = v.workflow_key
          AND p.object_type = v.object_type
          AND p.action_code = v.action_code
          AND p.from_status = v.from_status
          AND p.document_type_id IS NULL
    )
    RETURNING id, action_code, from_status, object_type
)
INSERT INTO workflow_action_policy_actors (policy_id, actor_type, actor_code)
SELECT sp.id, actors.actor_type, NULL
FROM seeded_policies sp
JOIN (VALUES
    ('CONTROLLED_COPY', 'REQUEST_COPY', 'DCO'),
    ('CONTROLLED_COPY', 'REQUEST_COPY', 'DOCUMENT_ADMIN'),
    ('CONTROLLED_COPY', 'REQUEST_COPY', 'OWNER'),
    ('CONTROLLED_COPY', 'APPROVE_REQUEST', 'DCO'),
    ('CONTROLLED_COPY', 'APPROVE_REQUEST', 'DOCUMENT_ADMIN'),
    ('CONTROLLED_COPY', 'REJECT_REQUEST', 'DCO'),
    ('CONTROLLED_COPY', 'REJECT_REQUEST', 'DOCUMENT_ADMIN'),
    ('CONTROLLED_COPY', 'PREPARE_DISTRIBUTION', 'DCO'),
    ('CONTROLLED_COPY', 'PREPARE_DISTRIBUTION', 'DOCUMENT_ADMIN'),
    ('CONTROLLED_COPY', 'VIEW_COPY', 'DCO'),
    ('CONTROLLED_COPY', 'VIEW_COPY', 'DOCUMENT_ADMIN'),
    ('CONTROLLED_COPY', 'VIEW_COPY', 'OWNER'),
    ('CONTROLLED_COPY', 'PREVIEW_FILE', 'DCO'),
    ('CONTROLLED_COPY', 'PREVIEW_FILE', 'DOCUMENT_ADMIN'),
    ('CONTROLLED_COPY', 'PREVIEW_FILE', 'OWNER'),
    ('CONTROLLED_COPY', 'DOWNLOAD_FILE', 'DCO'),
    ('CONTROLLED_COPY', 'DOWNLOAD_FILE', 'DOCUMENT_ADMIN'),
    ('CONTROLLED_COPY', 'DOWNLOAD_FILE', 'OWNER'),
    ('CONTROLLED_COPY', 'RECALL_COPY', 'DCO'),
    ('CONTROLLED_COPY', 'RECALL_COPY', 'DOCUMENT_ADMIN'),
    ('CONTROLLED_COPY', 'REPORT_LOST_DAMAGED', 'DCO'),
    ('CONTROLLED_COPY', 'REPORT_LOST_DAMAGED', 'DOCUMENT_ADMIN'),
    ('CONTROLLED_COPY', 'REPORT_LOST_DAMAGED', 'OWNER'),
    ('CONTROLLED_COPY', 'REPLACE_LOST_DAMAGED', 'DCO'),
    ('CONTROLLED_COPY', 'REPLACE_LOST_DAMAGED', 'DOCUMENT_ADMIN'),
    ('CONTROLLED_COPY', 'UPLOAD_EVIDENCE', 'DCO'),
    ('CONTROLLED_COPY', 'UPLOAD_EVIDENCE', 'DOCUMENT_ADMIN'),
    ('CONTROLLED_COPY', 'UPLOAD_EVIDENCE', 'OWNER'),
    ('CONTROLLED_COPY', 'EXPIRE_COPY', 'DCO'),
    ('CONTROLLED_COPY', 'EXPIRE_COPY', 'DOCUMENT_ADMIN'),
    ('CONTROLLED_COPY', 'DESTROY_COPY', 'DCO'),
    ('CONTROLLED_COPY', 'DESTROY_COPY', 'DOCUMENT_ADMIN'),
    ('CONTROLLED_COPY', 'CONFIRM_DESTROY', 'DCO'),
    ('CONTROLLED_COPY', 'CONFIRM_DESTROY', 'DOCUMENT_ADMIN'),
    ('CONTROLLED_COPY', 'CANCEL_REQUEST', 'DCO'),
    ('CONTROLLED_COPY', 'CANCEL_REQUEST', 'DOCUMENT_ADMIN'),
    ('CONTROLLED_COPY_BATCH', 'APPROVE_REQUEST', 'DCO'),
    ('CONTROLLED_COPY_BATCH', 'APPROVE_REQUEST', 'DOCUMENT_ADMIN'),
    ('CONTROLLED_COPY_BATCH', 'REJECT_REQUEST', 'DCO'),
    ('CONTROLLED_COPY_BATCH', 'REJECT_REQUEST', 'DOCUMENT_ADMIN'),
    ('CONTROLLED_COPY_BATCH', 'PREPARE_DISTRIBUTION', 'DCO'),
    ('CONTROLLED_COPY_BATCH', 'PREPARE_DISTRIBUTION', 'DOCUMENT_ADMIN'),
    ('CONTROLLED_COPY_BATCH', 'DISTRIBUTE_BATCH', 'DCO'),
    ('CONTROLLED_COPY_BATCH', 'DISTRIBUTE_BATCH', 'DOCUMENT_ADMIN'),
    ('CONTROLLED_COPY_BATCH', 'RECALL_BATCH', 'DCO'),
    ('CONTROLLED_COPY_BATCH', 'RECALL_BATCH', 'DOCUMENT_ADMIN'),
    ('CONTROLLED_COPY_BATCH', 'CANCEL_REQUEST', 'DCO'),
    ('CONTROLLED_COPY_BATCH', 'CANCEL_REQUEST', 'DOCUMENT_ADMIN')
) AS actors(object_type, action_code, actor_type)
ON actors.object_type = sp.object_type
AND actors.action_code = sp.action_code
WHERE NOT EXISTS (
    SELECT 1
    FROM workflow_action_policy_actors a
    WHERE a.policy_id = sp.id
      AND a.actor_type = actors.actor_type
      AND a.actor_code IS NULL
);
