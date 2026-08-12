-- V144: Backfill legacy submit-for-review electronic signatures that were
-- previously stored as PREPARED.
--
-- Safety rules:
-- 1) Only touch electronic_signatures rows that are still PREPARED.
-- 2) Only match against revision audit logs for submit-for-review actions.
-- 3) Use the nearest audit log by timestamp to avoid changing real Author
--    prepared signatures.
-- 4) Keep the update conservative by requiring a reasonable time window.

WITH candidate_matches AS (
    SELECT
        es.id AS signature_id,
        a.id AS audit_id,
        ROW_NUMBER() OVER (
            PARTITION BY es.id
            ORDER BY
                ABS(EXTRACT(EPOCH FROM (es.signed_at - COALESCE(a.event_time, a.created_at)))),
                COALESCE(a.event_time, a.created_at) DESC,
                a.created_at DESC,
                a.id DESC
        ) AS rn
    FROM electronic_signatures es
    JOIN audit_logs a
      ON UPPER(COALESCE(a.entity_type, '')) = 'REVISION'
     AND a.entity_id = es.revision_id
     AND COALESCE(a.user_id, a.acted_by_user_id) = es.user_id
     AND UPPER(COALESCE(a.action_type, '')) IN ('SUBMIT_FOR_REVIEW', 'SUBMIT', 'SUBMIT_REVIEW')
     AND UPPER(COALESCE(a.from_status, '')) = 'DRAFT'
     AND UPPER(COALESCE(a.to_status, '')) IN ('PENDING_REVIEW', 'PENDING_APPROVAL', 'READY_FOR_PUBLISHING')
    WHERE es.revision_id IS NOT NULL
      AND UPPER(COALESCE(es.meaning, '')) = 'PREPARED'
      AND ABS(EXTRACT(EPOCH FROM (es.signed_at - COALESCE(a.event_time, a.created_at)))) <= 3600
)
UPDATE electronic_signatures es
SET meaning = 'SUBMITTED_FOR_REVIEW'
FROM candidate_matches cm
WHERE es.id = cm.signature_id
  AND cm.rn = 1;
