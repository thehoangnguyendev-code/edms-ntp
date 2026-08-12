-- V63: Update seeded document and revision versions to three-digit format (0.0.1 and 1.0.0)

-- Update version in documents table
UPDATE documents
SET version = '0.0.1'
WHERE document_number IN ('SOP.1001', 'SOP.1002', 'SOP.1003', 'SOP.1004', 'SOP.1005', 'SOP.1008');

UPDATE documents
SET version = '1.0.0'
WHERE document_number IN ('SOP.1006', 'SOP.1007');

-- Update revision_number and revision_name in document_revisions table
UPDATE document_revisions
SET revision_number = '0.0.1',
    revision_name = document_name || '_0.0.1'
WHERE document_number IN ('SOP.1001', 'SOP.1002', 'SOP.1003', 'SOP.1004', 'SOP.1005', 'SOP.1008');

UPDATE document_revisions
SET revision_number = '1.0.0',
    revision_name = document_name || '_1.0.0'
WHERE document_number IN ('SOP.1006', 'SOP.1007');
