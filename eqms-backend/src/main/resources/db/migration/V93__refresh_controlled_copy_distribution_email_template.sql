UPDATE email_templates
SET
    subject = '{{controlledCopyNumber}} - Controlled Copy Available',
    content = '<div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6;"><p>Hello {{recipientName}},</p><p>A new controlled copy is available.</p><div style="padding: 16px; border: 1px solid #e5e7eb; border-radius: 8px; background: #f9fafb;"><p><strong>Document:</strong> {{documentTitle}}</p><p><strong>Revision Number:</strong> {{revisionNumber}}</p><p><strong>Controlled Copy Number:</strong> {{controlledCopyNumber}}</p><p><strong>Link preview:</strong> <a href="{{controlledCopyPreviewUrl}}">{{controlledCopyPreviewUrl}}</a></p></div><p style="margin-top: 16px;">Please review the document in the system.</p><p style="margin-top: 8px; color: #6b7280; font-size: 12px;">This email contains a secure link only. No file is attached. Access is authenticated and audited in the system.</p><p>Best regards,<br/>{{systemName}}</p></div>',
    description = 'Controlled copy distribution notification',
    variables = 'recipientName,controlledCopyNumber,documentTitle,revisionNumber,controlledCopyPreviewUrl,systemName',
    updated_by = 'System',
    updated_date = CURRENT_TIMESTAMP
WHERE type = 'controlled-copy-distribution-notification'
   OR name = 'Controlled Copy Distribution Notification';
