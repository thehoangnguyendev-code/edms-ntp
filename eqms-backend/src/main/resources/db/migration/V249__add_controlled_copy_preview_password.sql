-- Per user request: the controlled copy preview link is protected by a URL token alone today
-- (anyone with the link can open it). Add a second factor — a random password issued alongside
-- the access token, sent only in the distribution email, required to unlock the preview. Same
-- lifecycle as the token: issued/cleared together, valid until the copy's expiry date.
ALTER TABLE controlled_copies ADD COLUMN IF NOT EXISTS preview_password VARCHAR(32);

UPDATE email_templates
SET
    subject = '{{controlledCopyNumber}} - Controlled Copy Available',
    content = '<div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6;"><p>Hello {{recipientName}},</p><p>A new controlled copy is available.</p><div style="padding: 16px; border: 1px solid #e5e7eb; border-radius: 8px; background: #f9fafb;"><p><strong>Document:</strong> {{documentTitle}}</p><p><strong>Revision Number:</strong> {{revisionNumber}}</p><p><strong>Controlled Copy Number:</strong> {{controlledCopyNumber}}</p><p><strong>Expiry Date:</strong> {{expiryDateDisplay}}</p><p><strong>Preview link:</strong> <a href="{{controlledCopyPreviewUrl}}">{{controlledCopyPreviewUrl}}</a></p><p><strong>Preview password:</strong> {{previewPassword}}</p></div><p style="margin-top: 16px;">Please review the document using the preview link above. You will be asked to enter the password shown here before the preview opens.</p><p style="margin-top: 8px; color: #6b7280; font-size: 12px;">This link opens a read-only PDF preview of the controlled copy — no EQMS account or login is required. The password is valid until the expiry date above; access via this link is time-limited and audited.</p><p>Best regards,<br/>{{systemName}}</p></div>',
    description = 'Controlled copy distribution notification',
    variables = 'recipientName,controlledCopyNumber,documentTitle,revisionNumber,expiryDateDisplay,controlledCopyPreviewUrl,previewPassword,systemName',
    updated_by = 'System',
    updated_date = CURRENT_TIMESTAMP
WHERE type = 'controlled-copy-distribution-notification'
   OR name = 'Controlled Copy Distribution Notification';
