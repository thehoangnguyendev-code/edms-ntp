-- V814: the campaigns of Access Review and of Audit Trail Review join Workflow Authorization (owner directive 2026-11-18: do every module, as it is in code). The rows say what AccessReviewService and
-- AuditTrailReviewService have always checked for an in-progress campaign: the manage permission. Completing a campaign also needs a valid electronic signature, which the service checks. Nothing changes in who
-- may do what. The Segregation of Duties rules between the permissions (for example assigning profiles and deciding an access review) stay in sod_constraints.

WITH inserted AS (
    INSERT INTO workflow_action_policies (
        id, module_key, workflow_key, object_type, action_code, from_status,
        required_permission_code, priority, active, is_system, description, relation_match_rule, created_at, updated_at, version)
    SELECT gen_random_uuid(), 'SECURITY_REVIEW', v.workflow, v.object_type, v.action_code, v.from_status,
           v.permission, 100, TRUE, TRUE, v.description, 'ANY', now(), now(), 0
    FROM (VALUES
        ('ACCESS_REVIEW_CAMPAIGN', 'ACCESS_REVIEW_CAMPAIGN', 'DECIDE_ITEM', 'IN_PROGRESS', 'security.access_review.manage', 'A person who manages access reviews records a decision on an item of an in-progress campaign.'),
        ('ACCESS_REVIEW_CAMPAIGN', 'ACCESS_REVIEW_CAMPAIGN', 'COMPLETE', 'IN_PROGRESS', 'security.access_review.manage', 'The same person completes the campaign when no item is pending, with a signature.'),
        ('ACCESS_REVIEW_CAMPAIGN', 'ACCESS_REVIEW_CAMPAIGN', 'CANCEL', 'IN_PROGRESS', 'security.access_review.manage', 'The same person cancels an in-progress campaign.'),
        ('AUDIT_REVIEW_CAMPAIGN', 'AUDIT_REVIEW_CAMPAIGN', 'DECIDE_ITEM', 'IN_PROGRESS', 'audit.review.manage', 'A person who manages audit trail reviews records a decision on an item of an in-progress campaign.'),
        ('AUDIT_REVIEW_CAMPAIGN', 'AUDIT_REVIEW_CAMPAIGN', 'COMPLETE', 'IN_PROGRESS', 'audit.review.manage', 'The same person completes the campaign when no item is pending, with a signature.'),
        ('AUDIT_REVIEW_CAMPAIGN', 'AUDIT_REVIEW_CAMPAIGN', 'CANCEL', 'IN_PROGRESS', 'audit.review.manage', 'The same person cancels an in-progress campaign.')
    ) AS v(workflow, object_type, action_code, from_status, permission, description)
    WHERE NOT EXISTS (
        SELECT 1 FROM workflow_action_policies p
        WHERE p.module_key = 'SECURITY_REVIEW' AND p.workflow_key = v.workflow AND p.object_type = v.object_type
          AND p.action_code = v.action_code AND p.from_status = v.from_status AND p.document_type_id IS NULL)
    RETURNING id, required_permission_code
)
INSERT INTO workflow_action_policy_actors (id, policy_id, actor_type, actor_code, created_at)
SELECT gen_random_uuid(), i.id, 'PERMISSION', i.required_permission_code, now() FROM inserted i WHERE i.required_permission_code <> '';
