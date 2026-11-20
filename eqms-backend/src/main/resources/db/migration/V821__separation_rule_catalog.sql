-- V821: the catalog of the "a different person" rules an administrator can switch on or off (owner decisions 2026-11-19: the administrator has full authority over the configuration; no rule is
-- fixed; the new rules start OFF).
--
-- A rule is ON while its policy carries an ACTIVE forbidden relation (V807) and OFF while it does not. Switching a rule OFF deletes that row, so the catalog remembers which rules exist, otherwise an
-- OFF rule could not be found again. The catalog does not decide anything: the engine reads the policies. It holds the natural key of the policy and the code of the relation.

CREATE TABLE IF NOT EXISTS separation_rule_catalog (
    id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    module_key    VARCHAR(80)  NOT NULL,
    workflow_key  VARCHAR(80)  NOT NULL,
    object_type   VARCHAR(80)  NOT NULL,
    action_code   VARCHAR(80)  NOT NULL,
    from_status   VARCHAR(80)  NOT NULL,
    relation_code VARCHAR(80)  NOT NULL,
    description   VARCHAR(500),
    sort_order    INTEGER      NOT NULL DEFAULT 100,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT uq_separation_rule_catalog UNIQUE (module_key, workflow_key, object_type, action_code, from_status, relation_code)
);

-- 1. Every rule that exists today (a forbidden relation on a generic policy): Report templates, Training, Report schedules and runs.
INSERT INTO separation_rule_catalog (module_key, workflow_key, object_type, action_code, from_status, relation_code, description)
SELECT DISTINCT p.module_key, p.workflow_key, p.object_type, p.action_code, p.from_status, d.code, d.description
FROM workflow_action_policy_relations r
JOIN workflow_action_policies p ON p.id = r.policy_id AND p.document_type_id IS NULL
JOIN authorization_relation_definitions d ON d.id = r.relation_definition_id
WHERE r.forbidden
ON CONFLICT ON CONSTRAINT uq_separation_rule_catalog DO NOTHING;

-- 2. The new rules of the campaigns of Access Review and of Audit Trail Review (V820). They start OFF: no policy carries the forbidden relation yet.
INSERT INTO separation_rule_catalog (module_key, workflow_key, object_type, action_code, from_status, relation_code, description, sort_order)
VALUES
    ('SECURITY_REVIEW', 'ACCESS_REVIEW_CAMPAIGN', 'ACCESS_REVIEW_CAMPAIGN', 'DECIDE_ITEM', 'IN_PROGRESS', 'ITEM_SUBJECT',
        'A reviewer cannot record a decision on the item about their own account.', 10),
    ('SECURITY_REVIEW', 'ACCESS_REVIEW_CAMPAIGN', 'ACCESS_REVIEW_CAMPAIGN', 'COMPLETE', 'IN_PROGRESS', 'CAMPAIGN_CREATOR',
        'The person who created a campaign cannot be the one who completes (signs) it.', 20),
    ('SECURITY_REVIEW', 'AUDIT_REVIEW_CAMPAIGN', 'AUDIT_REVIEW_CAMPAIGN', 'DECIDE_ITEM', 'IN_PROGRESS', 'ENTRY_PERFORMER',
        'A reviewer cannot record a decision on an audit entry they made themselves.', 10),
    ('SECURITY_REVIEW', 'AUDIT_REVIEW_CAMPAIGN', 'AUDIT_REVIEW_CAMPAIGN', 'COMPLETE', 'IN_PROGRESS', 'CAMPAIGN_CREATOR',
        'The person who created a campaign cannot be the one who completes (signs) it.', 20)
ON CONFLICT ON CONSTRAINT uq_separation_rule_catalog DO NOTHING;
