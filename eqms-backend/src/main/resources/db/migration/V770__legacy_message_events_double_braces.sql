-- NOTIFICATION-ADMIN-2026-11-12: three e-mail messages (ready for submission, revision cancelled, knowledge sharing) were written with {name} where the registry
-- writes {{name}}. The registry events created from them are rewritten so that their placeholders are filled. Forward-only and idempotent: a text that already has
-- {{name}} is not touched again.
UPDATE notification_template_versions v
SET title = regexp_replace(v.title, '(^|[^{])\{([A-Za-z0-9_]+)\}(?!\})', '\1{{\2}}', 'g'),
    summary = regexp_replace(v.summary, '(^|[^{])\{([A-Za-z0-9_]+)\}(?!\})', '\1{{\2}}', 'g'),
    subject = regexp_replace(v.subject, '(^|[^{])\{([A-Za-z0-9_]+)\}(?!\})', '\1{{\2}}', 'g'),
    body = regexp_replace(v.body, '(^|[^{])\{([A-Za-z0-9_]+)\}(?!\})', '\1{{\2}}', 'g')
FROM notification_policies p
WHERE v.policy_id = p.id
  AND p.event_code IN ('document.ready_for_submission', 'document.revision_cancelled', 'knowledge.share_notice')
  AND v.change_summary LIKE 'Created from the e-mail message%';
