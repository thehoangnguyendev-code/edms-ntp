-- Cancel Document should only be allowed while the Document Master is still Draft
-- (mirrors BE guard added in DocumentService.cancelDocument and SDS section 5.1.2).
UPDATE lifecycle_state_policies
SET status_code = 'DRAFT'
WHERE object_type = 'DOCUMENT'
  AND capability_code = 'CANCEL'
  AND status_code IS NULL;
