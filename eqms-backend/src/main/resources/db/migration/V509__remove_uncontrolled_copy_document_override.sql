-- Removes the per-document Uncontrolled Copy eligibility override (V503). Eligibility is now
-- resolved solely from the Document Type rule matrix configured on the Uncontrolled Copy Policy
-- screen; the per-document override layer added redundant, harder-to-audit configuration surface.

ALTER TABLE documents DROP COLUMN IF EXISTS uncontrolled_copy_override;
ALTER TABLE documents DROP COLUMN IF EXISTS uncontrolled_copy_override_reason;
ALTER TABLE documents DROP COLUMN IF EXISTS uncontrolled_copy_override_by_user_id;
ALTER TABLE documents DROP COLUMN IF EXISTS uncontrolled_copy_override_at;

DELETE FROM permission_dependencies
WHERE permission_code = 'documents.document.manage_uncontrolled_copy_eligibility'
   OR depends_on_code = 'documents.document.manage_uncontrolled_copy_eligibility';

DELETE FROM permission_set_items
WHERE permission_id IN (SELECT id FROM permissions WHERE code = 'documents.document.manage_uncontrolled_copy_eligibility');

DELETE FROM permissions WHERE code = 'documents.document.manage_uncontrolled_copy_eligibility';
