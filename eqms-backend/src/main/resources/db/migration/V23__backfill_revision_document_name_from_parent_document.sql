UPDATE document_revisions dr
SET document_name = CASE
    WHEN COALESCE(d.document_number, '') <> '' AND COALESCE(d.document_name, '') <> '' THEN d.document_number || ' - ' || d.document_name
    WHEN COALESCE(d.document_number, '') <> '' THEN d.document_number
    WHEN COALESCE(d.document_name, '') <> '' THEN d.document_name
    ELSE 'Untitled Document'
END
FROM documents d
WHERE dr.document_id = d.id;
