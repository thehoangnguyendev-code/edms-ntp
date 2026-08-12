-- V325 attempted to grant documents.controlled_copy.report_lost_damaged to the "DCO" role by
-- inserting into role_permissions — but that table is retired; effective permissions are
-- resolved via roles -> access_profile_permission_sets -> permission_sets -> permission_set_items
-- (see EffectivePermissionService). The real "DCO" access profile was left without any
-- controlled-copy action permission beyond "request" (only linked to "DCO managed permissions"
-- and "UAT Controlled Copy Requester", neither of which include report/replace/recall/etc.),
-- while the "Controlled Copy DCO" permission set already has the full, correct set. Link them.

INSERT INTO access_profile_permission_sets (access_profile_id, permission_set_id)
SELECT r.id, ps.id
FROM roles r
JOIN permission_sets ps ON ps.name = 'Controlled Copy DCO'
WHERE r.name = 'DCO'
  AND NOT EXISTS (
      SELECT 1 FROM access_profile_permission_sets aps
      WHERE aps.access_profile_id = r.id AND aps.permission_set_id = ps.id
  );
