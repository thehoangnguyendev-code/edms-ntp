-- Phase 0.4 of SECURITY_AUTHORIZATION_HYBRID_REFACTOR_PLAN.md (§5.1): maps a
-- workflow_action_policies row to one or more authorization_relation_definitions rows.
-- Purely additive -- no enforcement path reads this table yet (that starts when
-- AuthorizationEngineService, Phase 0.5, is wired into a module's shadow evaluation).
--
-- relation_match_rule lives on workflow_action_policies itself (one policy = one rule for all
-- its required relations), not per relation row, so it cannot become inconsistent across rows
-- for the same policy.
--
-- Rollback (if needed):
--   DROP TABLE workflow_action_policy_relations;
--   ALTER TABLE workflow_action_policies DROP COLUMN relation_match_rule;

ALTER TABLE workflow_action_policies
    ADD COLUMN relation_match_rule VARCHAR(10) NOT NULL DEFAULT 'ANY';

ALTER TABLE workflow_action_policies
    ADD CONSTRAINT workflow_action_policies_relation_match_rule_check
        CHECK (relation_match_rule IN ('ANY', 'ALL'));

CREATE TABLE workflow_action_policy_relations (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_id               UUID        NOT NULL REFERENCES workflow_action_policies(id) ON DELETE CASCADE,
    relation_definition_id  UUID        NOT NULL REFERENCES authorization_relation_definitions(id) ON DELETE RESTRICT,
    -- Only meaningful when the relation resolves via WORKFLOW_PARTICIPANT (Reviewer/Approver):
    -- must the actor be the next pending participant in sequence_order, not just any participant.
    require_sequence        BOOLEAN     NOT NULL DEFAULT false,
    priority                INT         NOT NULL DEFAULT 100,
    active                  BOOLEAN     NOT NULL DEFAULT true,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (policy_id, relation_definition_id)
);

CREATE INDEX idx_workflow_action_policy_relations_policy
    ON workflow_action_policy_relations (policy_id, active);
