-- V62: Fix document status of seeded records to be ACTIVE when revision workspace is active
UPDATE documents
SET status_code = 'ACTIVE'
WHERE document_number IN ('SOP.1001', 'SOP.1002', 'SOP.1003', 'SOP.1004', 'SOP.1005');
