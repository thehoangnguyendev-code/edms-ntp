-- A Reject used to reuse the "ready for your review/approval" templates and reach only Document
-- Control. These two dedicated templates tell the Author, Co-Authors, Reviewers and Document
-- Control that the revision was sent back to Draft, by whom, and why.

INSERT INTO email_templates (id, name, type, subject, content, status, description, variables, created_by)
VALUES (
    '00000000-0000-0000-0000-000000000448',
    'Revision Review Rejected',
    'document-review-rejected',
    'Review Rejected: {documentNumber}',
    '<p>Hello {recipientName},</p><p>Revision <strong>{documentNumber} - {documentTitle}</strong> was <strong>rejected during review</strong> by {actorName} and has been returned to Draft. The current review round is closed.</p><p>Reason: {workflowComment}</p><p>The Author can now open the revision to address the comments; any Reviewer access to the Word Online copy has been withdrawn.</p><p><a href="{revisionUrl}">Open the revision</a></p><p>Best regards,<br/>EQMS System</p>',
    'Active',
    'Notifies the Author, Co-Author(s), Reviewers and Document Control that a Reviewer rejected the revision and it is back in Draft, including the reason',
    'recipientName,documentNumber,documentTitle,actorName,workflowComment,revisionUrl',
    'System'
);

INSERT INTO email_templates (id, name, type, subject, content, status, description, variables, created_by)
VALUES (
    '00000000-0000-0000-0000-000000000449',
    'Revision Approval Rejected',
    'document-approval-rejected',
    'Approval Rejected: {documentNumber}',
    '<p>Hello {recipientName},</p><p>Revision <strong>{documentNumber} - {documentTitle}</strong> was <strong>rejected at approval</strong> by {actorName} and has been returned to Draft. The review and approval steps will have to be repeated.</p><p>Reason: {workflowComment}</p><p><a href="{revisionUrl}">Open the revision</a></p><p>Best regards,<br/>EQMS System</p>',
    'Active',
    'Notifies the Author, Co-Author(s), Reviewers and Document Control that the Approver rejected the revision and it is back in Draft, including the reason',
    'recipientName,documentNumber,documentTitle,actorName,workflowComment,revisionUrl',
    'System'
);
