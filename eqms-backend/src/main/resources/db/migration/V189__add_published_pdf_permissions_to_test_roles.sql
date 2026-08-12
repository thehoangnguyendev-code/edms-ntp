-- Every permission set that holds documents.document.view is missing
-- documents.document.preview_published / documents.document.download_published — only the
-- legacy DCO_LEGACY set has them. This meant NO test role (Author/Co-Author/Reviewer/Approver/
-- DCO) could preview or download a published (Effective/Obsoleted) document's PDF at all,
-- since SecureFileAccessService gates PUBLISHED_PDF access with these specific permission
-- codes, distinct from documents.revision.preview (which only covers pre-publish review
-- snapshots). Anyone who can view a document should be able to read its published content —
-- this grants the same pair already implied by holding documents.document.view.

INSERT INTO permission_set_items (id, permission_set_id, permission_id)
SELECT gen_random_uuid(), ps.id, p.id
FROM permission_sets ps
JOIN permissions p ON p.code IN ('documents.document.preview_published', 'documents.document.download_published')
WHERE ps.code IN ('PS_AUTHOR_TEST', 'PS_COAUTHOR_TEST', 'PS_REVIEWER_TEST', 'PS_APPROVER_TEST', 'PS_DCO_TEST')
AND NOT EXISTS (
    SELECT 1 FROM permission_set_items psi
    WHERE psi.permission_set_id = ps.id AND psi.permission_id = p.id
);
