-- Phase 1-2.4 finding: the hybrid engine's relation model (authorization_relation_definitions,
-- 6 resolvers from V349) only covered actor types resolvable from resource state
-- (AUTHOR/CO_AUTHOR/ASSIGNED_REVIEWER/ASSIGNED_APPROVER via WORKFLOW_PARTICIPANT). Live
-- workflow_action_policy_actors rows also use PERMISSION and ACCESS_PROFILE actor types
-- (RevisionWorkflowAuthorizationService.matchesActor), which had no resolver at all -- the
-- shadow-evaluation run showed 268 mismatches, all "new engine wrongly allows" because those
-- actor requirements were silently dropped. These two resolvers are resource-agnostic (they only
-- need the actor's own permissions/access-profile membership, not resource state), so they are
-- resolved centrally by AuthorizationEngineService itself, not by a per-resource adapter.

ALTER TABLE authorization_relation_definitions
    DROP CONSTRAINT authorization_relation_definitions_resolver_code_check;

ALTER TABLE authorization_relation_definitions
    ADD CONSTRAINT authorization_relation_definitions_resolver_code_check
    CHECK (resolver_code IN (
        'SELF_RESOLVER', 'RESOURCE_OWNER', 'WORKFLOW_PARTICIPANT', 'CONTROLLED_COPY_RECIPIENT',
        'ORGANIZATION_SCOPE', 'OBJECT_GRANT', 'PERMISSION_RESOLVER', 'ACCESS_PROFILE_RESOLVER'
    ));

-- One relation definition per distinct PERMISSION actor_code currently live on a REVISION policy.
INSERT INTO authorization_relation_definitions
    (id, code, display_name, resource_type, resolver_code, resolver_config, description, active, version)
SELECT
    gen_random_uuid(),
    'PERMISSION_' || upper(regexp_replace(wapa.actor_code, '[^a-zA-Z0-9]+', '_', 'g')),
    'Holds permission ' || wapa.actor_code,
    'REVISION',
    'PERMISSION_RESOLVER',
    jsonb_build_object('permissionCode', wapa.actor_code),
    'Auto-seeded from live workflow_action_policy_actors (V353) -- actor is authorized via holding this permission, independent of any resource-state relation.',
    true,
    0
FROM workflow_action_policy_actors wapa
JOIN workflow_action_policies wap ON wap.id = wapa.policy_id
WHERE wap.module_key = 'DOCUMENT_CONTROL' AND wap.workflow_key = 'DOCUMENT_REVISION'
  AND wapa.actor_type = 'PERMISSION' AND wapa.actor_code IS NOT NULL
ON CONFLICT (code, resource_type) DO NOTHING;

-- One relation definition per distinct ACCESS_PROFILE actor_code currently live on a REVISION policy.
INSERT INTO authorization_relation_definitions
    (id, code, display_name, resource_type, resolver_code, resolver_config, description, active, version)
SELECT
    gen_random_uuid(),
    'ACCESS_PROFILE_' || upper(regexp_replace(wapa.actor_code, '[^a-zA-Z0-9]+', '_', 'g')),
    'Member of access profile ' || wapa.actor_code,
    'REVISION',
    'ACCESS_PROFILE_RESOLVER',
    jsonb_build_object('profileCode', wapa.actor_code),
    'Auto-seeded from live workflow_action_policy_actors (V353) -- actor is authorized via membership in this access profile, independent of any resource-state relation.',
    true,
    0
FROM workflow_action_policy_actors wapa
JOIN workflow_action_policies wap ON wap.id = wapa.policy_id
WHERE wap.module_key = 'DOCUMENT_CONTROL' AND wap.workflow_key = 'DOCUMENT_REVISION'
  AND wapa.actor_type = 'ACCESS_PROFILE' AND wapa.actor_code IS NOT NULL
ON CONFLICT (code, resource_type) DO NOTHING;

-- Link every live REVISION workflow_action_policy_actors row to its matching relation definition,
-- so RevisionResourceAdapter.resolvePolicy() sees the exact same actor requirements the legacy
-- evaluator (RevisionWorkflowAuthorizationService.evaluatePolicy) already enforces per policy row.
INSERT INTO workflow_action_policy_relations (id, policy_id, relation_definition_id, require_sequence, priority, active)
SELECT
    gen_random_uuid(),
    wapa.policy_id,
    ard.id,
    false,
    100,
    true
FROM workflow_action_policy_actors wapa
JOIN workflow_action_policies wap ON wap.id = wapa.policy_id
JOIN authorization_relation_definitions ard ON ard.resource_type = 'REVISION' AND (
    (wapa.actor_type IN ('AUTHOR', 'CO_AUTHOR', 'ASSIGNED_REVIEWER', 'ASSIGNED_APPROVER')
        AND ard.code = wapa.actor_type::text)
    OR (wapa.actor_type = 'PERMISSION'
        AND ard.code = 'PERMISSION_' || upper(regexp_replace(wapa.actor_code, '[^a-zA-Z0-9]+', '_', 'g')))
    OR (wapa.actor_type = 'ACCESS_PROFILE'
        AND ard.code = 'ACCESS_PROFILE_' || upper(regexp_replace(wapa.actor_code, '[^a-zA-Z0-9]+', '_', 'g')))
)
WHERE wap.module_key = 'DOCUMENT_CONTROL' AND wap.workflow_key = 'DOCUMENT_REVISION'
ON CONFLICT (policy_id, relation_definition_id) DO NOTHING;
