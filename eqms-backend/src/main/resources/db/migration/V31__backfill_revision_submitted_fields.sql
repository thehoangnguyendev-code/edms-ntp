WITH submit_history AS (
    SELECT DISTINCT ON (rwh.revision_id)
        rwh.revision_id,
        rwh.acted_by_user_id,
        rwh.created_at
    FROM revision_workflow_history rwh
    WHERE UPPER(rwh.action_type) IN ('SUBMIT_FOR_REVIEW', 'SUBMIT', 'SUBMITTED')
    ORDER BY rwh.revision_id, rwh.created_at ASC
)
UPDATE document_revisions dr
SET submitted_by_user_id = COALESCE(dr.submitted_by_user_id, submit_history.acted_by_user_id),
    submitted_on = COALESCE(
        dr.submitted_on,
        submit_history.created_at AT TIME ZONE 'UTC'
    )
FROM submit_history
WHERE dr.id = submit_history.revision_id
  AND (dr.submitted_by_user_id IS NULL OR dr.submitted_on IS NULL);
