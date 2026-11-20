-- V833: the actors of a workflow action policy are kept only where something reads them (owner decision 2026-11-20).
--
-- The Hybrid engine decides from the permission, the relations and the state of the record and never reads a policy's actors. The ONE step that still reads them is
-- REQUEST_COPY of a Controlled Copy (ControlledCopyAuthorizationService#evaluateInternal): it has no record yet, so it cannot go through the engine. The actors of every
-- other policy therefore decided nothing while the policy screen asked for them. They are deleted; the table stays for REQUEST_COPY.
-- The rows removed from DEV (146) are kept as a record in docs/validation/evidence/visibility_tiers_2026_11_20/removed_policy_actors_DEV_2026_11_20.csv. No decision changes.
DELETE FROM workflow_action_policy_actors a
USING workflow_action_policies p
WHERE p.id = a.policy_id
  AND NOT (p.object_type = 'CONTROLLED_COPY' AND p.action_code = 'REQUEST_COPY');
