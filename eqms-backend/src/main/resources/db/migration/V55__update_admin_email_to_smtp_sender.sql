-- Update admin user's email to match the configured SMTP sender email if it exists and is not the default
UPDATE app_users
SET email = COALESCE(
    (SELECT notifications_config -> 'emailConfig' ->> 'senderEmail' 
     FROM system_configurations 
     WHERE config_key = 'default' 
       AND notifications_config -> 'emailConfig' ->> 'senderEmail' IS NOT NULL 
       AND notifications_config -> 'emailConfig' ->> 'senderEmail' <> '' 
       AND notifications_config -> 'emailConfig' ->> 'senderEmail' <> 'noreply@eqms.com'
       AND notifications_config -> 'emailConfig' ->> 'senderEmail' <> '••••••••••••'),
    'admin@example.com' -- standard fallback
)
WHERE username = 'admin';
