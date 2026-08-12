-- Ensure the UAT DCO access profile used by user.a.test retains the complete
-- controlled-copy capability set. Authorization is permission-set based; the
-- display name of the user's role is not used at runtime.

INSERT INTO access_profile_permission_sets (access_profile_id, permission_set_id)
SELECT r.id, ps.id
FROM roles r
JOIN permission_sets ps ON ps.code = 'PS_CONTROLLED_COPY_DCO'
WHERE r.code = 'AP_UAT_DCO_QUALITY'
  AND NOT EXISTS (
      SELECT 1
      FROM access_profile_permission_sets existing
      WHERE existing.access_profile_id = r.id
        AND existing.permission_set_id = ps.id
  );

-- The workspace-management capability allows this profile to request copies
-- for other recipients, use batch requests, and distribute/reclaim copies.
INSERT INTO access_profile_permission_sets (access_profile_id, permission_set_id)
SELECT r.id, ps.id
FROM roles r
JOIN permission_sets ps ON ps.code = 'PS_DOCUMENT_DCO'
WHERE r.code = 'AP_UAT_DCO_QUALITY'
  AND NOT EXISTS (
      SELECT 1
      FROM access_profile_permission_sets existing
      WHERE existing.access_profile_id = r.id
        AND existing.permission_set_id = ps.id
  );
