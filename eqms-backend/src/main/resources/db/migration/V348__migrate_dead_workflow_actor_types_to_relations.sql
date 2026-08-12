-- Phase 0.2 of SECURITY_AUTHORIZATION_HYBRID_REFACTOR_PLAN.md: WorkflowActorType dropped 7 dead
-- enum values (DCO, DOCUMENT_ADMIN, TRAINING_COORDINATOR, WORKFLOW_ROLE, DOCUMENT_WORKFLOW_POOL,
-- DEPARTMENT_MANAGER, DOCUMENT_VIEWER -- all already fail-closed no-ops in matchesActor) and added
-- new reserved relation values for the upcoming AuthorizationEngine (SELF, ASSIGNED_COORDINATOR,
-- REQUESTER, RECIPIENT, DEPARTMENT_SCOPE, BUSINESS_UNIT_SCOPE, ALL_RECORDS, EXPLICIT_GRANT).
--
-- Live DB still had 6 rows using 'DOCUMENT_VIEWER' (Controlled Copy REQUEST_COPY/DOWNLOAD_FILE/
-- PREVIEW_FILE/VIEW_COPY actor selectors) -- the Java enum can no longer deserialize this value,
-- which would crash the app the moment ControlledCopyAuthorizationService loads these policies.
-- 'DOCUMENT_VIEWER' meant exactly "recipient of this controlled copy may view/preview/download it"
-- -- the new 'RECIPIENT' relation is its direct semantic successor (see
-- WorkflowActionDefaultPolicyRegistry.dcoDaViewerOwner and DocumentsWorkflowDefinitionProvider,
-- updated in the same change).
--
-- No other dead value (DCO, DOCUMENT_ADMIN, TRAINING_COORDINATOR, WORKFLOW_ROLE,
-- DOCUMENT_WORKFLOW_POOL, DEPARTMENT_MANAGER) had any live row -- verified against the running
-- database before writing this migration.
--
-- Rollback (if needed):
--   UPDATE workflow_action_policy_actors SET actor_type = 'DOCUMENT_VIEWER' WHERE actor_type = 'RECIPIENT'
--     AND policy_id IN (SELECT id FROM workflow_action_policies WHERE object_type = 'CONTROLLED_COPY');

UPDATE workflow_action_policy_actors
SET actor_type = 'RECIPIENT'
WHERE actor_type = 'DOCUMENT_VIEWER';
