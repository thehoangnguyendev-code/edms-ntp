-- author.test1 (PS_AUTHOR_TEST) has documents.revision.upload_source (the "who may upload the
-- revision file" gate) but was missing documents.document.edit_metadata -- the initial-draft
-- edit gate checked by DocumentAuthorizationService#canEditInitialDocumentDraft, which requires
-- BOTH upload_source and edit_metadata together for the assigned Author's own-draft path. Without
-- edit_metadata, the "Edit Document" action (the only entry point into uploading the first
-- revision file on a brand-new Document that has no revision yet) never appears for the Author,
-- even though they are the correctly assigned author_user_id on the Document. Confirmed against
-- the real production PS_DOCUMENT_AUTHOR role, which already bundles edit_metadata alongside
-- upload_source.

INSERT INTO permission_set_items (id, permission_set_id, permission_id)
SELECT gen_random_uuid(), ps.id, p.id
FROM permission_sets ps
JOIN permissions p ON p.code = 'documents.document.edit_metadata'
WHERE ps.code = 'PS_AUTHOR_TEST'
  AND NOT EXISTS (
      SELECT 1 FROM permission_set_items psi WHERE psi.permission_set_id = ps.id AND psi.permission_id = p.id
  );
