-- The DCO's batch-ZIP email now also carries a "download" button (an ordinary, login-required app
-- link that rebuilds the same ZIP on demand -- see ControlledCopyController#downloadDcoBatchZip),
-- since some mail clients strip large attachments and the DCO may read the email from a device
-- other than the one they'll actually download/print from.
UPDATE email_templates
SET content = '<div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6;"><p>Hello {{recipientName}},</p><p>A controlled copy distribution batch has been completed and delivery was routed to you.</p><div style="padding: 16px; border: 1px solid #e5e7eb; border-radius: 8px; background: #f9fafb;"><p><strong>Batch Number:</strong> {{batchNumber}}</p><p><strong>Document:</strong> {{documentTitle}}</p><p><strong>Revision Number:</strong> {{revisionNumber}}</p><p><strong>Copies:</strong> {{copyCount}}</p></div><p style="margin-top: 16px;">All copies in this batch are attached as a single ZIP file. If your mail client removed the attachment, use the button below instead (requires your eQMS login):</p><p style="margin-top: 16px;"><a href="{{dcoZipDownloadUrl}}" style="display: inline-block; padding: 10px 20px; background: #059669; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600;">Download the ZIP</a></p><p style="margin-top: 16px;">Please print and distribute them to the respective recipients.</p><p>Best regards,<br/>{{systemName}}</p></div>',
    updated_date = now()
WHERE type = 'controlled-copy-batch-distribution-dco-zip';
