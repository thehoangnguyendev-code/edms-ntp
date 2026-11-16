-- UCC-SIMPLE-2026-11-14 (owner instruction): an Uncontrolled Copy is distributed by a person who holds the permission to distribute and cancelled by a person who holds the
-- permission to cancel; it has no approval step and no rejection. The two permissions of that step are removed from the catalog, with their place in every permission set
-- (permission_set_items cascades) and the segregation-of-duties constraint that existed only for them (request x approve_request).
-- A permission set that held only these two (for example an approver set) now holds no permission for Uncontrolled Copies: an administrator gives it the permission to
-- distribute where it is needed, with an electronic signature. Nothing is granted here.
-- Forward-only, idempotent.
DELETE FROM sod_constraints
 WHERE permission_code_a IN ('documents.uncontrolled_copy.approve_request', 'documents.uncontrolled_copy.reject_request')
    OR permission_code_b IN ('documents.uncontrolled_copy.approve_request', 'documents.uncontrolled_copy.reject_request');
DELETE FROM permissions WHERE code IN ('documents.uncontrolled_copy.approve_request', 'documents.uncontrolled_copy.reject_request');
