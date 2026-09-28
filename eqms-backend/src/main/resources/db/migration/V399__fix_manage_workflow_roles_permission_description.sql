-- V398 retired the Document Workflow Pool (document_workflow_pool_members) and the pool-management
-- portion of PUT /document-administration (dcoUserIds/reviewerUserIds/approverUserIds). The
-- documents.admin.manage_workflow_roles permission that gates this endpoint still gates something
-- real -- the SoD boolean rule toggles (reviewer-no-approve, require-two-reviewers, etc.) -- but its
-- catalog name/description still describe the removed pool-management capability, which would
-- mislead an Admin browsing the Permission Catalog about what granting this permission actually does.
UPDATE permissions
SET name = 'Manage Document Workflow Rules',
    description = 'Manage segregation-of-duties rules for the Document Revision workflow (e.g. reviewer cannot approve, require two reviewers, author cannot review own revision).'
WHERE code = 'documents.admin.manage_workflow_roles';
