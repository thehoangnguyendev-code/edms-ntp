-- T-P1-4 (F-08/Q1): seed email templates for the Complete Editing -> DCO handover
-- and DCO Cancel -> Author/Co-Author notifications introduced alongside V345's
-- narrowing of the SUBMIT_FOR_REVIEW actor to the DCO/DOCUMENT_CONTROLLER access profiles.

INSERT INTO email_templates (id, name, type, subject, content, status, description, variables, created_by)
VALUES (
    '00000000-0000-0000-0000-000000000346',
    'Revision Ready for Submission',
    'document-ready-for-submission',
    'Revision Ready for Your Review: {documentNumber}',
    '<p>Hello,</p><p>The author has finished editing revision <strong>{documentNumber} - {documentTitle}</strong> and it is now ready for you to check and submit for review.</p><p>Please open the revision workspace to verify the content before submitting it for review.</p><p>Best regards,<br/>EQMS System</p>',
    'Active',
    'Notifies Document Control (DCO) that an author has completed editing and the revision is ready to be checked and submitted for review',
    'documentNumber,documentTitle',
    'System'
);

INSERT INTO email_templates (id, name, type, subject, content, status, description, variables, created_by)
VALUES (
    '00000000-0000-0000-0000-000000000347',
    'Revision Cancelled',
    'document-revision-cancelled',
    'Revision Cancelled: {documentNumber}',
    '<p>Hello,</p><p>Your revision <strong>{documentNumber} - {documentTitle}</strong> has been cancelled by {actorName}.</p><p>Reason: {comment}</p><p>Best regards,<br/>EQMS System</p>',
    'Active',
    'Notifies the Author and Co-Author(s) that Document Control (DCO) has cancelled their revision, including the reason',
    'documentNumber,documentTitle,actorName,comment',
    'System'
);
