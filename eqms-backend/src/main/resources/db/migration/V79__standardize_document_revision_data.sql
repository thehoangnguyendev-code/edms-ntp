-- =============================================================================
-- V79: Standardize Document and Document Revision data
--
-- Business Rules enforced:
--   1. A Document with at least one EFFECTIVE revision must have status = ACTIVE.
--   2. The most recent OBSOLETED revision (before a new DRAFT) stays OBSOLETED
--      unless explicitly restored per data audit findings.
--   3. SOP.0001 revision 2.0.0 was incorrectly OBSOLETED when a new DRAFT (3.0.1)
--      was created via Upgrade Revision. It should remain EFFECTIVE because no new
--      revision has been published yet.
--   4. documents.version must match the EFFECTIVE revision's revision_number.
--      If no EFFECTIVE revision, version = latest revision's revision_number.
--   5. document_revisions.document_name must match the parent document's document_name.
--   6. revision_name must be in format: document_name + '_' + revision_number.
-- =============================================================================


-- ─── Step 1: Sync revision.document_name from parent document ─────────────────
-- Ensures revision_name rebuilding in later steps uses the correct document name.
UPDATE document_revisions r
SET
    document_name = d.document_name,
    updated_at    = NOW()
FROM documents d
WHERE r.document_id = d.id
  AND r.document_name IS DISTINCT FROM d.document_name;


-- ─── Step 2: Restore SOP.0001 revision 2.0.0 from OBSOLETED → EFFECTIVE ──────
-- Root cause: The Upgrade Revision flow incorrectly obsoleted the current
-- EFFECTIVE revision (2.0.0) when creating a new DRAFT (3.0.1).
-- Fix: Restore 2.0.0 to EFFECTIVE. It remains effective until 3.0.1 is published.
UPDATE document_revisions r
SET
    status_code = 'EFFECTIVE',
    updated_at  = NOW()
FROM documents d
WHERE r.document_id = d.id
  AND d.document_number = 'SOP.0001'
  AND r.revision_number = '2.0.0'
  AND r.status_code     = 'OBSOLETED';


-- ─── Step 3: Fix document status — ACTIVE when EFFECTIVE revision exists ──────
-- Applies to all documents. SOP.0001 will be fixed here after step 2.
UPDATE documents d
SET
    status_code = 'ACTIVE',
    updated_at  = NOW()
WHERE EXISTS (
    SELECT 1
    FROM document_revisions r
    WHERE r.document_id  = d.id
      AND r.status_code  = 'EFFECTIVE'
)
AND d.status_code != 'ACTIVE';


-- ─── Step 4: Sync documents.version from EFFECTIVE revision ───────────────────
-- If a document has an EFFECTIVE revision, version = that revision's number.
UPDATE documents d
SET
    version    = r.revision_number,
    updated_at = NOW()
FROM document_revisions r
WHERE r.document_id  = d.id
  AND r.status_code  = 'EFFECTIVE'
  AND d.version IS DISTINCT FROM r.revision_number;


-- ─── Step 5: Sync documents.version for docs with NO EFFECTIVE revision ───────
-- Use the latest revision_number (by created_at DESC) as the version.
UPDATE documents d
SET
    version    = (
        SELECT r2.revision_number
        FROM   document_revisions r2
        WHERE  r2.document_id = d.id
        ORDER  BY r2.created_at DESC, r2.id DESC
        LIMIT  1
    ),
    updated_at = NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM document_revisions r3
    WHERE r3.document_id = d.id AND r3.status_code = 'EFFECTIVE'
)
AND EXISTS (
    SELECT 1 FROM document_revisions r4 WHERE r4.document_id = d.id
)
AND d.version IS DISTINCT FROM (
    SELECT r5.revision_number
    FROM   document_revisions r5
    WHERE  r5.document_id = d.id
    ORDER  BY r5.created_at DESC, r5.id DESC
    LIMIT  1
);


-- ─── Step 6: Rebuild revision_name = document_name + '_' + revision_number ────
-- Ensures display consistency across all revisions after step 1 synced names.
UPDATE document_revisions
SET
    revision_name = document_name || '_' || revision_number,
    updated_at    = NOW()
WHERE document_name  IS NOT NULL
  AND revision_number IS NOT NULL
  AND (
      revision_name IS NULL
      OR revision_name <> document_name || '_' || revision_number
  );
