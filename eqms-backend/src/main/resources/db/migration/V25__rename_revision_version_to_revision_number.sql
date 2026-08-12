ALTER TABLE document_revisions
    RENAME COLUMN version TO revision_number;

UPDATE document_revisions dr
SET document_number = d.document_number
FROM documents d
WHERE dr.document_id = d.id;
