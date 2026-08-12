-- A previous workflow implementation incorrectly changed a READY immutable
-- review snapshot back to GENERATING when a Reviewer completed their action.
-- Reconcile only records for which the immutable snapshot history proves that
-- the exact stored preview already exists. This is a controlled data repair;
-- it does not generate, replace, or alter any GMP record file.
UPDATE document_revisions revision
SET snapshot_status = 'READY',
    snapshot_error = NULL
WHERE revision.status_code IN ('PENDING_APPROVAL', 'PENDING_TRAINING', 'READY_FOR_PUBLISHING')
  AND revision.snapshot_status = 'GENERATING'
  AND revision.preview_file_path IS NOT NULL
  AND EXISTS (
      SELECT 1
      FROM revision_snapshot_history history
      WHERE history.revision_id = revision.id
        AND revision.preview_file_path LIKE '%' || history.object_key || '%'
  );
