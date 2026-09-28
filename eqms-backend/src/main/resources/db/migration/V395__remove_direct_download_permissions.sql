-- GMP decision: direct download of the master/source file is no longer a supported capability.
-- The only sanctioned path to obtain a copy of a document/revision is the Controlled Copy
-- distribution workflow (documents.controlled_copy.download_file / download_evidence), which is
-- untouched by this migration.
DELETE FROM role_permissions
WHERE permission_id IN (
    SELECT id FROM permissions
    WHERE code IN ('documents.document.download_published', 'documents.revision.download_source')
);

DELETE FROM permission_set_items
WHERE permission_id IN (
    SELECT id FROM permissions
    WHERE code IN ('documents.document.download_published', 'documents.revision.download_source')
);

DELETE FROM permissions
WHERE code IN ('documents.document.download_published', 'documents.revision.download_source');
