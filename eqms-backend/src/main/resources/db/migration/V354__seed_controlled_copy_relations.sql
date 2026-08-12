-- Phase 3 (Controlled Copy cutover): seeds authorization_relation_definitions and
-- workflow_action_policy_relations for CONTROLLED_COPY / CONTROLLED_COPY_BATCH, mirroring the
-- live workflow_action_policy_actors rows exactly the same way V353 did for Revision.
--
-- Legacy actor_type semantics here are non-obvious and deliberately preserved as-is (not
-- redesigned): OWNER actually means "is the requester or the specific recipient of this copy"
-- (ControlledCopyAuthorizationService.matchesRequesterOrRecipient), and RECIPIENT actually means
-- "can view the parent document" (matchesDocumentViewer). DISTRIBUTE_COPY/DISTRIBUTE_BATCH are
-- intentionally excluded below -- the legacy evaluator bypasses actor matching entirely for those
-- two actions (permission alone suffices), so seeding a relation for them would make the new
-- engine stricter than the legacy evaluator it must shadow.

-- OWNER relation for CONTROLLED_COPY: requester-or-recipient of this specific copy/batch.
-- Resolved by the adapter (ControlledCopyResourceAdapter/ControlledCopyBatchResourceAdapter)
-- via ControlledCopyAuthorizationService.matchesRequesterOrRecipient, not generically -- config
-- is empty like DOCUMENT's OWNER (RESOURCE_OWNER is a marker resolver here, not literally used).
INSERT INTO authorization_relation_definitions
    (id, code, display_name, resource_type, resolver_code, resolver_config, description, active, version)
VALUES
    (gen_random_uuid(), 'OWNER', 'Requester or recipient of this controlled copy', 'CONTROLLED_COPY',
        'RESOURCE_OWNER', '{}'::jsonb,
        'Adapter-resolved via ControlledCopyAuthorizationService.matchesRequesterOrRecipient (V354).', true, 0),
    (gen_random_uuid(), 'OWNER', 'Requester of this distribution batch', 'CONTROLLED_COPY_BATCH',
        'RESOURCE_OWNER', '{}'::jsonb,
        'Adapter-resolved via ControlledCopyAuthorizationService.matchesRequesterOrRecipient (V354).', true, 0)
ON CONFLICT (code, resource_type) DO NOTHING;

-- RECIPIENT relation definition for CONTROLLED_COPY already exists (V349, resolver
-- CONTROLLED_COPY_RECIPIENT) -- reused here for adapter-resolved "can view parent document"
-- (ControlledCopyAuthorizationService.matchesDocumentViewer), not literally a recipient lookup.

-- One relation definition per distinct PERMISSION actor_code live on a CONTROLLED_COPY(_BATCH)
-- policy, excluding DISTRIBUTE_COPY/DISTRIBUTE_BATCH (see header comment).
INSERT INTO authorization_relation_definitions
    (id, code, display_name, resource_type, resolver_code, resolver_config, description, active, version)
SELECT DISTINCT
    gen_random_uuid(),
    'PERMISSION_' || upper(regexp_replace(wapa.actor_code, '[^a-zA-Z0-9]+', '_', 'g')),
    'Holds permission ' || wapa.actor_code,
    wap.object_type,
    'PERMISSION_RESOLVER',
    jsonb_build_object('permissionCode', wapa.actor_code),
    'Auto-seeded from live workflow_action_policy_actors (V354) -- actor is authorized via holding this permission, independent of any resource-state relation.',
    true,
    0
FROM workflow_action_policy_actors wapa
JOIN workflow_action_policies wap ON wap.id = wapa.policy_id
WHERE wap.module_key = 'DOCUMENT_CONTROL' AND wap.workflow_key = 'CONTROLLED_COPY'
  AND wapa.actor_type = 'PERMISSION' AND wapa.actor_code IS NOT NULL
  AND wap.action_code NOT IN ('DISTRIBUTE_COPY', 'DISTRIBUTE_BATCH')
ON CONFLICT (code, resource_type) DO NOTHING;

-- Link every live CONTROLLED_COPY(_BATCH) workflow_action_policy_actors row (excluding the two
-- global-distribution actions) to its matching relation definition.
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
JOIN authorization_relation_definitions ard ON ard.resource_type = wap.object_type AND (
    (wapa.actor_type IN ('OWNER', 'RECIPIENT') AND ard.code = wapa.actor_type::text)
    OR (wapa.actor_type = 'PERMISSION'
        AND ard.code = 'PERMISSION_' || upper(regexp_replace(wapa.actor_code, '[^a-zA-Z0-9]+', '_', 'g')))
)
WHERE wap.module_key = 'DOCUMENT_CONTROL' AND wap.workflow_key = 'CONTROLLED_COPY'
  AND wap.action_code NOT IN ('DISTRIBUTE_COPY', 'DISTRIBUTE_BATCH')
ON CONFLICT (policy_id, relation_definition_id) DO NOTHING;
