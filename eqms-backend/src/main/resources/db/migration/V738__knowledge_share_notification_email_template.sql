-- E-mail (and inbox notice) to the Department Head, or the Head of Unit, each time a delegate shares in the Knowledge Base, takes a share of
-- his own away, or makes a link. One template with the variables of the event; the type is registered in EmailTemplateTypeUtils.
INSERT INTO email_templates (id, name, type, subject, content, status, description, variables, created_by)
VALUES (
    '00000000-0000-0000-0000-000000000738',
    'Knowledge Base Sharing by a Delegate',
    'knowledge-share-notification',
    'Knowledge Base sharing: {actionTitle}',
    '<p>Hello {recipientName},</p><p><strong>{actorName}</strong>, who may share for you, {actionText}.</p><p>Item: <strong>{itemLabel}</strong><br/>Scope: {scopeName}<br/>Details: {detail}</p><p>This is recorded in the Audit Trail. You can see and remove what was shared by right-clicking the item in the Knowledge explorer and choosing Share.</p><p>Best regards,<br/>EQMS System</p>',
    'Active',
    'Tells a Department Head or Head of Unit that a person who may share on his behalf has shared, removed a share or made a link in the Knowledge Base',
    'actionTitle,actorName,actionText,itemLabel,scopeName,detail,recipientName',
    'System'
);
