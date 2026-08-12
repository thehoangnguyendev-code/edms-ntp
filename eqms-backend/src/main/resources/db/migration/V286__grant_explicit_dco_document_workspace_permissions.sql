-- Complete the Document Control entitlement cut-over.
--
-- A DCO's ability to see every document and operate the controlled workspace
-- must come from explicit, assignable permissions.  It must not be inferred
-- from a legacy role_name, a workflow-pool member row, or a system-admin flag.
-- This migration preserves all existing DCO capabilities by granting the two
-- dedicated permissions to the canonical DCO permission sets.

INSERT INTO permission_set_items (permission_set_id, permission_id)
SELECT ps.id, p.id
FROM permission_sets ps
JOIN permissions p ON p.code IN (
    'documents.document.view_all',
    'documents.workspace.manage'
)
WHERE ps.code IN ('PS_DOCUMENT_DCO', 'PS_UAT_DOCUMENT_DCO')
  AND NOT EXISTS (
      SELECT 1
      FROM permission_set_items existing
      WHERE existing.permission_set_id = ps.id
        AND existing.permission_id = p.id
  );

-- Preserve any active custom Access Profile that was previously marked as a
-- Document Control operator workflow role. It receives the canonical DCO set
-- once, after which the workflow-role marker is descriptive only and no longer
-- grants entitlement.
INSERT INTO access_profile_permission_sets (access_profile_id, permission_set_id, assigned_at)
SELECT DISTINCT workflow_role.access_profile_id, dco_set.id, now()
FROM access_profile_workflow_roles workflow_role
JOIN permission_sets dco_set ON dco_set.code = 'PS_DOCUMENT_DCO' AND dco_set.active = TRUE
WHERE workflow_role.workflow_role IN ('DCO', 'DOCUMENT_ADMIN')
  AND NOT EXISTS (
      SELECT 1
      FROM access_profile_permission_sets existing
      WHERE existing.access_profile_id = workflow_role.access_profile_id
        AND existing.permission_set_id = dco_set.id
  );
