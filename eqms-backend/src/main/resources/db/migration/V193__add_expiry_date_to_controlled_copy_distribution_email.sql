-- The distribution notification email must show the expiry date and must accurately describe
-- the preview link: it opens a PDF-only preview page (no EQMS login required), not "access into
-- the system" as the previous copy implied. See EmailNotificationService.buildControlledCopyVariables
-- for the expiryDateDisplay variable (formatted date, or "does not expire" when unset).
UPDATE email_templates
SET
    subject = '{{controlledCopyNumber}} - Controlled Copy Available',
    content = '<div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6;"><p>Hello {{recipientName}},</p><p>A new controlled copy is available.</p><div style="padding: 16px; border: 1px solid #e5e7eb; border-radius: 8px; background: #f9fafb;"><p><strong>Document:</strong> {{documentTitle}}</p><p><strong>Revision Number:</strong> {{revisionNumber}}</p><p><strong>Controlled Copy Number:</strong> {{controlledCopyNumber}}</p><p><strong>Expiry Date:</strong> {{expiryDateDisplay}}</p><p><strong>Preview link:</strong> <a href="{{controlledCopyPreviewUrl}}">{{controlledCopyPreviewUrl}}</a></p></div><p style="margin-top: 16px;">Please review the document using the preview link above.</p><p style="margin-top: 8px; color: #6b7280; font-size: 12px;">This link opens a read-only PDF preview of the controlled copy — no EQMS account or login is required. Access via this link is time-limited and audited.</p><p>Best regards,<br/>{{systemName}}</p></div>',
    description = 'Controlled copy distribution notification',
    variables = 'recipientName,controlledCopyNumber,documentTitle,revisionNumber,expiryDateDisplay,controlledCopyPreviewUrl,systemName',
    updated_by = 'System',
    updated_date = CURRENT_TIMESTAMP
WHERE type = 'controlled-copy-distribution-notification'
   OR name = 'Controlled Copy Distribution Notification';
