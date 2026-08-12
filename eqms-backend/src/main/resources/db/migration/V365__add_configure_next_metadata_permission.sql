-- documents.document.edit_metadata is overloaded: it also gates an Author editing their own
-- brand-new Draft document before the first revision exists (DocumentAuthorizationService.
-- canEditInitialDocumentDraft). Removing edit_metadata from the Author permission set to enforce
-- "only DCO can edit General Information on an Active document" would have silently broken every
-- Author's ability to create/edit their own initial Draft. Instead, split out a dedicated
-- permission -- mirroring the existing documents.revision.configure_next_reviewers/approvers/
-- related_documents/correlated_documents pattern -- for editing General Information fields
-- (Author, Co-Author, Periodic Review Cycle/Notification, Review Date, Description) while
-- configuring the next revision of an Active document. Only DCO-facing permission sets receive it.

INSERT INTO permissions (id, code, name, category, module_key, group_key, description, display_order, requires_audit)
VALUES (
    gen_random_uuid(),
    'documents.document.configure_next_metadata',
    'Configure Next Revision Metadata',
    'Revision Configuration',
    'documents',
    'revision_configuration',
    'Change Author, Co-Author, Periodic Review Cycle/Notification, Review Date and Description inherited by the next revision of an Active document.',
    666,
    true
);

INSERT INTO permission_set_items (id, permission_set_id, permission_id)
SELECT gen_random_uuid(), ps.id, p.id
FROM permission_sets ps, permissions p
WHERE ps.name IN ('Document Control Officer', 'UAT Document DCO')
  AND p.code = 'documents.document.configure_next_metadata';
