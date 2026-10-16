-- V608: The document-expiry notifications are English only (owner request, 2026-10-16).
-- V607 seeded the EMAIL template versions for document.expired and document.expired_copy_holder in
-- Vietnamese and English. This keeps the English content only, on the existing EMAIL versions, so
-- no new version number is created. Idempotent.

UPDATE notification_template_versions v
SET subject = CASE p.event_code
        WHEN 'document.expired' THEN '[EQMS] Document expired: {{documentNumber}}'
        WHEN 'document.expired_copy_holder' THEN '[EQMS] Your copy is void: {{documentNumber}}'
    END,
    body = CASE p.event_code
        WHEN 'document.expired' THEN '<p><b>Document {{documentNumber}} — {{documentTitle}} has passed its Valid Until date and is no longer valid.</b></p>'
            || '<p>Its electronic copies have been voided. Do not use this document, including any printed copy, and do not request new copies until the document has been reviewed and extended or replaced by a newer version.</p>'
            || '<p>Link: {{actionUrl}}</p>'
        WHEN 'document.expired_copy_holder' THEN '<p><b>The controlled copy you hold of {{documentNumber}} — {{documentTitle}} is void because the document has expired.</b></p>'
            || '<p>Do not use the electronic copy or the printed copy issued to you. Document Control (DCO) will recall your printed copy.</p>'
            || '<p>Link: {{actionUrl}}</p>'
    END
FROM notification_policies p
WHERE p.id = v.policy_id
  AND v.channel = 'EMAIL'
  AND p.event_code IN ('document.expired', 'document.expired_copy_holder');
