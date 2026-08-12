CREATE TABLE email_templates (
    id UUID PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    type VARCHAR(50) NOT NULL,
    subject VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    status VARCHAR(20) NOT NULL,
    description VARCHAR(500),
    variables TEXT, -- comma-separated list of variables (e.g. "otpCode,expiresIn")
    usage_count INT DEFAULT 0,
    last_used TIMESTAMP WITH TIME ZONE,
    created_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_date TIMESTAMP WITH TIME ZONE,
    created_by VARCHAR(100),
    updated_by VARCHAR(100)
);

-- Seed system templates
INSERT INTO email_templates (id, name, type, subject, content, status, description, created_by)
VALUES (
    '00000000-0000-0000-0000-000000000001', 
    'MFA OTP Login Code', 
    'password-reset', -- using standard types from frontend
    'Your Verification Code: {otpCode}', 
    '<p>Hello,</p><p>Your verification code for login is: <strong>{otpCode}</strong></p><p>This code will expire in {expiresIn} minutes.</p><p>If you did not request this code, please ignore this email.</p><p>Best regards,<br/>EQMS System</p>', 
    'Active', 
    'Standard template for login 2FA OTP codes', 
    'System'
);

INSERT INTO email_templates (id, name, type, subject, content, status, description, created_by)
VALUES (
    '00000000-0000-0000-0000-000000000002', 
    'Password Reset Link', 
    'password-reset', 
    'Password Reset Request', 
    '<p>Hello,</p><p>You requested a password reset. Please click the link below to set a new password:</p><p><a href="{resetLink}">{resetLink}</a></p><p>This link is valid for 24 hours.</p><p>If you did not request a password reset, please ignore this email.</p><p>Best regards,<br/>EQMS System</p>', 
    'Active', 
    'Standard template for password resets', 
    'System'
);
