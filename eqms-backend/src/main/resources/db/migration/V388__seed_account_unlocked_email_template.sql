-- Unlocking an account now also issues a fresh temporary password (the account was locked
-- out after repeated failed login attempts, so the old password is treated as
-- compromised/forgotten). Seed the notification email sent to the user with their username,
-- the new temporary password and a direct login link, plus an instruction to change it.

INSERT INTO email_templates (id, name, type, subject, content, status, description, variables, created_by)
VALUES (
    '00000000-0000-0000-0000-000000000388',
    'Account Unlocked - Temporary Password',
    'account-unlocked',
    'Your EQMS Account Has Been Unlocked',
    '<p>Hello {fullName},</p><p>Your EQMS account was locked after too many failed login attempts. An administrator has unlocked it and issued a new temporary password.</p><p><strong>Username:</strong> {username}<br/><strong>Temporary Password:</strong> {tempPassword}</p><p><a href="{loginLink}">Click here to log in</a></p><p>For security, you will be required to set a new password immediately after logging in. If you did not expect this, please contact your system administrator right away.</p><p>Best regards,<br/>EQMS System</p>',
    'Active',
    'Notifies a user that their locked account has been unlocked and provides the new temporary password, username and login link',
    'fullName,username,tempPassword,loginLink',
    'System'
);
