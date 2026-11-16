-- DEV data change (owner instruction 2026-11-14): the four permission sets that lost approve_request / reject_request (V784) are given the permission to distribute
-- Uncontrolled Copies. The two sets that held nothing else for Uncontrolled Copies (PS_APPROVER_TEST, PS_DCV_UC_APPROVER) are also given the permission to view them: without
-- it the person could not open the list of the requests that wait for distribution. DEV only; on another database an administrator makes the same change in Permission Sets,
-- with an electronic signature.
INSERT INTO permission_set_items (permission_set_id, permission_id)
SELECT ps.id, p.id
  FROM permission_sets ps JOIN permissions p ON p.code = 'documents.uncontrolled_copy.distribute'
 WHERE ps.code IN ('PS_APPROVER_TEST', 'PS_DCV_UC_APPROVER', 'PS_DOCUMENT_APPROVER', 'PS_UAT_DOCUMENT_APPROVER')
ON CONFLICT DO NOTHING;
INSERT INTO permission_set_items (permission_set_id, permission_id)
SELECT ps.id, p.id
  FROM permission_sets ps JOIN permissions p ON p.code = 'documents.uncontrolled_copy.view'
 WHERE ps.code IN ('PS_APPROVER_TEST', 'PS_DCV_UC_APPROVER')
ON CONFLICT DO NOTHING;
SELECT ps.code, string_agg(p.code, ', ' ORDER BY p.code) AS uncontrolled_copy_permissions
  FROM permission_sets ps JOIN permission_set_items i ON i.permission_set_id = ps.id JOIN permissions p ON p.id = i.permission_id
 WHERE ps.code IN ('PS_APPROVER_TEST', 'PS_DCV_UC_APPROVER', 'PS_DOCUMENT_APPROVER', 'PS_UAT_DOCUMENT_APPROVER') AND p.code LIKE 'documents.uncontrolled_copy.%'
 GROUP BY ps.code ORDER BY ps.code;
