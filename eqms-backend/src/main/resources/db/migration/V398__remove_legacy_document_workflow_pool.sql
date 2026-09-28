-- Removes the legacy Document Workflow Pool mechanism (document_workflow_pool_members), superseded
-- by the Access Profile + Workflow Role catalog (access_profile_workflow_roles, V172+). Confirmed
-- before writing this migration:
--   - No FE screen can read or write pool membership any more (GET /document-administration/users
--     and the dcoUserIds/reviewerUserIds/approverUserIds fields of PUT /document-administration have
--     zero callers in eqms/src).
--   - The only code that ever read this table at runtime, ControlledCopyAuthorizationService
--     #matchesDocumentWorkflowPool, is itself dead (zero call sites anywhere in the backend) --
--     removed in the same change as this migration.
--   - RevisionService/DocumentService only had the repository injected, never called it.
-- Net effect: nobody's real authorization depends on this table today.
--
-- Preserve DCO parity for the one real (non-test-seed) account found in the legacy pool -- the
-- ADMINISTRATOR access profile did not otherwise hold the DCO workflow role in the new catalog.
-- The other legacy pool rows (dco.lead2, doc.controller1, linhttd, workflow.dco1, hadt,
-- quality.lead1, toanlv, trangtt, huyenpn, tuanda, approver.lead2, quality.lead2) are UAT/test seed
-- accounts and are intentionally NOT migrated, per product decision.
INSERT INTO access_profile_workflow_roles (access_profile_id, workflow_role)
SELECT r.id, 'DCO'
FROM roles r
WHERE r.code = 'ADMINISTRATOR'
ON CONFLICT (access_profile_id, workflow_role) DO NOTHING;

DROP TABLE IF EXISTS document_workflow_pool_members;
