WITH latest_revision_values AS (
    SELECT DISTINCT ON (r.document_id)
        r.document_id,
        r.periodic_review_cycle,
        r.periodic_review_notification
    FROM document_revisions r
    WHERE r.periodic_review_cycle IS NOT NULL
       OR r.periodic_review_notification IS NOT NULL
    ORDER BY r.document_id, r.created_at DESC, r.id DESC
)
UPDATE documents d
SET periodic_review_cycle = COALESCE(d.periodic_review_cycle, l.periodic_review_cycle),
    periodic_review_notification = COALESCE(d.periodic_review_notification, l.periodic_review_notification)
FROM latest_revision_values l
WHERE d.id = l.document_id
  AND (d.periodic_review_cycle IS NULL OR d.periodic_review_notification IS NULL);
