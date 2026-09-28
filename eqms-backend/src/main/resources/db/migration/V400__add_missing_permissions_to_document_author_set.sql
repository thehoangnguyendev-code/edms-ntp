-- PS_DOCUMENT_AUTHOR was missing two permissions an Author genuinely needs in normal, everyday use:
--   - documents.document.configure_initial_workflow: NewDocumentView.tsx's document-creation form
--     already lets the creator pick Reviewers/Approvers inline; DocumentService#saveDraftAssignments
--     gates exactly that action on this permission (plus document ownership). Without it, an Author
--     holding only PS_DOCUMENT_AUTHOR is denied while creating their very first document.
--   - documents.revision.update_draft_metadata: distinct from documents.document.edit_metadata
--     (already granted) -- this gates editing the Draft *revision's* own metadata, not the Document
--     Master's. An Author actively drafting needs both.
INSERT INTO permission_set_items (id, permission_set_id, permission_id)
SELECT gen_random_uuid(), ps.id, p.id
FROM permission_sets ps
JOIN permissions p ON p.code IN (
    'documents.document.configure_initial_workflow',
    'documents.revision.update_draft_metadata'
)
WHERE ps.code = 'PS_DOCUMENT_AUTHOR'
ON CONFLICT (permission_set_id, permission_id) DO NOTHING;
