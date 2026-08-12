-- Ensure canonical status lookup labels and codes remain consistent across API consumers.
-- Document lifecycle uses ACTIVE; revision lifecycle uses EFFECTIVE for the published state.

INSERT INTO document_statuses (code, label, sort_order, is_terminal, created_at, updated_at) VALUES
    ('DRAFT', 'Draft', 1, FALSE, NOW(), NOW()),
    ('ACTIVE', 'Active', 2, FALSE, NOW(), NOW()),
    ('OBSOLETED', 'Obsoleted', 3, TRUE, NOW(), NOW()),
    ('CLOSED_CANCELLED', 'Closed - Cancelled', 4, TRUE, NOW(), NOW())
ON CONFLICT (code) DO UPDATE
SET label = EXCLUDED.label,
    sort_order = EXCLUDED.sort_order,
    is_terminal = EXCLUDED.is_terminal,
    updated_at = NOW();

INSERT INTO revision_statuses (code, label, sort_order, is_terminal, created_at, updated_at) VALUES
    ('DRAFT', 'Draft', 1, FALSE, NOW(), NOW()),
    ('PENDING_REVIEW', 'Pending Review', 2, FALSE, NOW(), NOW()),
    ('PENDING_APPROVAL', 'Pending Approval', 3, FALSE, NOW(), NOW()),
    ('PENDING_TRAINING', 'Pending Training', 4, FALSE, NOW(), NOW()),
    ('READY_FOR_PUBLISHING', 'Ready for Publishing', 5, FALSE, NOW(), NOW()),
    ('EFFECTIVE', 'Effective', 6, FALSE, NOW(), NOW()),
    ('OBSOLETED', 'Obsoleted', 7, TRUE, NOW(), NOW()),
    ('CLOSED_CANCELLED', 'Closed - Cancelled', 8, TRUE, NOW(), NOW())
ON CONFLICT (code) DO UPDATE
SET label = EXCLUDED.label,
    sort_order = EXCLUDED.sort_order,
    is_terminal = EXCLUDED.is_terminal,
    updated_at = NOW();

-- Align document status with published revisions when data drifted after legacy imports.
UPDATE documents d
SET status_code = 'ACTIVE',
    updated_at = NOW()
WHERE d.status_code = 'DRAFT'
  AND EXISTS (
      SELECT 1
      FROM document_revisions r
      WHERE r.document_id = d.id
        AND r.status_code = 'EFFECTIVE'
  );
