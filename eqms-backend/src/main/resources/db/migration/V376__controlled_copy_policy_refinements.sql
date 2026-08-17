-- Merge "Allow Report Lost" and "Allow Report Damaged" into a single toggle: they were always
-- checked together in practice (report-lost-or-damaged is one workflow action), so keeping two
-- separate flags only added confusing granularity with no real GMP distinction.
ALTER TABLE controlled_copy_policy_settings ADD COLUMN allow_report_lost_damaged BOOLEAN NOT NULL DEFAULT TRUE;
UPDATE controlled_copy_policy_settings SET allow_report_lost_damaged = (allow_report_lost OR allow_report_damaged);
ALTER TABLE controlled_copy_policy_settings DROP COLUMN allow_report_lost;
ALTER TABLE controlled_copy_policy_settings DROP COLUMN allow_report_damaged;

-- Expiry Duration Policy: support Hours/Days/Weeks/Months instead of Days-only, and drop the
-- unused free-text Description field from the Add/Edit Expiry Rule flow.
ALTER TABLE controlled_copy_expiry_limits RENAME COLUMN max_duration_days TO duration_value;
ALTER TABLE controlled_copy_expiry_limits ADD COLUMN duration_unit VARCHAR(10) NOT NULL DEFAULT 'DAYS';
ALTER TABLE controlled_copy_expiry_limits DROP COLUMN description;

-- Redirect controlled-copy delivery to a designated DCO instead of the original requester(s): the
-- DCO gets the printable link/attachment (for recipients without a computer/phone), requesters
-- just get a "your copy was distributed" notification with no link/attachment.
ALTER TABLE controlled_copy_policy_settings ADD COLUMN redirect_delivery_to_dco BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE controlled_copy_policy_settings ADD COLUMN dco_recipient_user_id UUID NULL REFERENCES app_users(id) ON DELETE SET NULL;

-- Notify-only variant sent to the original requester when delivery is redirected to the DCO —
-- no preview link/password, since the requester will get the printed copy from the DCO instead.
INSERT INTO email_templates (id, name, type, subject, content, status, description, variables, created_by)
VALUES (
    '00000000-0000-0000-0000-000000000376',
    'Controlled Copy Distributed (No Direct Access)',
    'controlled-copy-distribution-no-access',
    '{{controlledCopyNumber}} - Controlled Copy Distributed',
    '<div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6;"><p>Hello {{recipientName}},</p><p>Your requested controlled copy has been distributed.</p><div style="padding: 16px; border: 1px solid #e5e7eb; border-radius: 8px; background: #f9fafb;"><p><strong>Document:</strong> {{documentTitle}}</p><p><strong>Revision Number:</strong> {{revisionNumber}}</p><p><strong>Controlled Copy Number:</strong> {{controlledCopyNumber}}</p></div><p style="margin-top: 16px;">The Document Control Officer will provide you with the printed copy.</p><p>Best regards,<br/>{{systemName}}</p></div>',
    'Active',
    'Sent to the original requester when Controlled Copies Policy redirects delivery to the DCO — confirms distribution without a preview link',
    'recipientName,controlledCopyNumber,documentTitle,revisionNumber,systemName',
    'System'
);

-- One aggregated email sent to the DCO after a distribution batch finishes processing, with a
-- ZIP of every succeeded copy's PDF attached (for printing/handing out where recipients have no
-- computer/phone to view the preview link individually).
INSERT INTO email_templates (id, name, type, subject, content, status, description, variables, created_by)
VALUES (
    '00000000-0000-0000-0000-000000000377',
    'Controlled Copy Batch Distributed (DCO ZIP)',
    'controlled-copy-batch-distribution-dco-zip',
    'Controlled Copies Ready for Printing - Batch {{batchNumber}}',
    '<div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6;"><p>Hello {{recipientName}},</p><p>A controlled copy distribution batch has been completed and delivery was routed to you.</p><div style="padding: 16px; border: 1px solid #e5e7eb; border-radius: 8px; background: #f9fafb;"><p><strong>Batch Number:</strong> {{batchNumber}}</p><p><strong>Document:</strong> {{documentTitle}}</p><p><strong>Revision Number:</strong> {{revisionNumber}}</p><p><strong>Copies:</strong> {{copyCount}}</p></div><p style="margin-top: 16px;">All copies in this batch are attached as a single ZIP file. Please print and distribute them to the respective recipients.</p><p>Best regards,<br/>{{systemName}}</p></div>',
    'Active',
    'Sent to the DCO after a distribution batch completes when Controlled Copies Policy redirects delivery to the DCO — one email per batch with all copies zipped together',
    'recipientName,batchNumber,documentTitle,revisionNumber,copyCount,systemName',
    'System'
);
