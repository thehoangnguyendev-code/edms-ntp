CREATE TABLE IF NOT EXISTS system_configurations (
    id UUID PRIMARY KEY,
    config_key VARCHAR(100) NOT NULL UNIQUE,
    general_config JSONB NOT NULL,
    security_config JSONB NOT NULL,
    documents_config JSONB NOT NULL,
    notifications_config JSONB NOT NULL,
    integrations_config JSONB NOT NULL,
    features_config JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

INSERT INTO system_configurations (
    id,
    config_key,
    general_config,
    security_config,
    documents_config,
    notifications_config,
    integrations_config,
    features_config
)
SELECT
    '11111111-1111-1111-1111-111111111190'::UUID,
    'default',
    '{
      "systemName": "EQMS Enterprise",
      "systemDisplayName": "EQMS - Quality Management System",
      "systemLogo": "/assets/logo.png",
      "systemFavicon": "/assets/favicon.ico",
      "adminEmail": "admin@eqms.com",
      "maintenanceMode": false,
      "dateTimeFormat": "DD/MM/YYYY HH:mm:ss",
      "timeZone": "UTC+7",
      "companyInfo": {
        "companyName": "ACME Corporation",
        "companyAddress": "123 Business Street, Tech City, TC 12345",
        "companyPhone": "+1-555-0123",
        "companyWebsite": "https://www.acme-corp.com",
        "taxId": "TAX-123456789",
        "industry": "Pharmaceutical Manufacturing",
        "regulatoryBody": "FDA, ISO 9001:2015"
      },
      "backupSettings": {
        "enableAutoBackup": true,
        "backupFrequency": "daily",
        "backupTime": "02:00",
        "retentionDays": 30,
        "backupLocation": "cloud",
        "notifyOnBackupFailure": true
      },
      "locale": {
        "language": "en",
        "numberFormat": "en-US",
        "currencyCode": "USD",
        "firstDayOfWeek": "monday"
      },
      "appearance": {
        "theme": "light",
        "primaryColor": "emerald",
        "compactMode": false,
        "showBreadcrumbs": true,
        "sidebarDefaultCollapsed": false,
        "animationsEnabled": true
      }
    }'::jsonb,
    '{
      "passwordMinLength": 12,
      "requireSpecialChars": true,
      "requireNumbers": true,
      "requireUppercase": true,
      "requireLowercase": true,
      "passwordExpiryDays": 90,
      "enablePasswordExpiry": true,
      "preventPasswordReuse": true,
      "passwordHistoryCount": 5,
      "sessionTimeoutMinutes": 30,
      "enable2FA": true,
      "enableAutoLogout": true,
      "autoLogoutMinutes": 15,
      "enableAccountLockout": true,
      "maxLoginAttempts": 5,
      "ipSecurity": {
        "enableIpWhitelisting": false,
        "whitelistedIps": [],
        "enableGeoBlocking": false,
        "blockedCountries": [],
        "allowVpnConnections": true
      },
      "auditSettings": {
        "enableDetailedAuditLog": true,
        "logLevel": "standard",
        "retainLogsForDays": 365,
        "logSensitiveData": false,
        "enableRealTimeAlerts": true,
        "alertOnSuspiciousActivity": true
      }
    }'::jsonb,
    '{
      "defaultRetentionPeriodDays": 365,
      "enableWatermark": true,
      "allowDownload": false,
      "maxFileSizeMB": 25,
      "versionControl": {
        "enableAutoVersioning": true,
        "maxVersionsToKeep": 10,
        "compareVersionsEnabled": true,
        "requireVersionNotes": true,
        "majorMinorVersioning": true
      },
      "eSignature": {
        "enableESignature": true,
        "requirePasswordForSigning": true,
        "allowDigitalCertificates": false,
        "signingMethods": ["password", "otp"],
        "enforceSigningOrder": true,
        "signatureValidityDays": 365
      }
    }'::jsonb,
    '{
      "enableEmailNotifications": true,
      "enableInAppNotifications": true,
      "enableTelegramNotifications": false,
      "enableWhatsAppNotifications": false,
      "emailDigestFrequency": "daily",
      "emailConfig": {
        "smtpHost": "smtp.gmail.com",
        "smtpPort": 587,
        "smtpUsername": "noreply@eqms.com",
        "smtpPassword": "••••••••••••",
        "senderEmail": "noreply@eqms.com",
        "senderName": "EQMS Notification",
        "useSSL": true
      },
      "telegramConfig": {
        "botToken": "",
        "chatId": ""
      },
      "whatsappConfig": {
        "phoneNumberId": "",
        "accessToken": "",
        "businessAccountId": ""
      },
      "smsConfig": {
        "enableSms": false,
        "provider": "twilio",
        "accountSid": "",
        "authToken": "",
        "fromNumber": "",
        "rateLimitPerHour": 100
      },
      "enableCustomTemplates": false,
      "templates": [],
      "triggers": {
        "documentApproval": true,
        "taskAssignment": true,
        "systemAlerts": true,
        "capaDue": true
      }
    }'::jsonb,
    '{
      "sso": {
        "enableSso": false,
        "provider": "azure-ad",
        "entityId": "",
        "ssoUrl": "",
        "certificate": "",
        "autoProvisionUsers": false,
        "defaultRole": "viewer"
      },
      "ldap": {
        "enableLdap": false,
        "serverUrl": "",
        "baseDn": "",
        "bindDn": "",
        "bindPassword": "",
        "userSearchFilter": "(sAMAccountName={username})",
        "groupSearchFilter": "(member={dn})",
        "syncSchedule": "daily",
        "lastSyncDate": ""
      },
      "webhooks": [],
      "storage": {
        "provider": "aws-s3",
        "bucketName": "eqms-documents-prod",
        "region": "ap-southeast-1",
        "accessKeyId": "AKIA••••••••••••",
        "secretAccessKey": "••••••••••••••••••••",
        "basePath": "/documents",
        "enableCdn": true,
        "cdnUrl": "https://cdn.eqms.company.com"
      },
      "enableApiKeyAuth": true,
      "apiRateLimitPerMinute": 60,
      "corsAllowedOrigins": [
        "https://eqms.company.com",
        "https://admin.eqms.company.com"
      ]
    }'::jsonb,
    '[
      {
        "id": "feat-001",
        "name": "Electronic Document Management (EDMS)",
        "description": "Core module for document lifecycle management, versioning, and controlled access.",
        "enabled": true,
        "category": "Core"
      },
      {
        "id": "feat-002",
        "name": "Training Management System (TMS)",
        "description": "Manage employee training records, curriculum, and compliance tracking.",
        "enabled": true,
        "category": "Core"
      },
      {
        "id": "feat-003",
        "name": "Quality Events (CAPA/Deviation)",
        "description": "Module for managing non-conformances, investigations, and corrective actions.",
        "enabled": true,
        "category": "Quality"
      },
      {
        "id": "feat-004",
        "name": "Audit Management",
        "description": "Planning and executing internal and external audits with findings tracking.",
        "enabled": false,
        "category": "Quality"
      }
    ]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM system_configurations WHERE config_key = 'default');
