-- CONFIGURATION-CLEANUP-2026-11-12: settings that were stored but that no screen shows and no code reads.
-- The legacy backup settings (auto backup, "daily", "retention 30 days", "cloud") contradicted the real Backup Policy
-- (permanent retention), and SSO, LDAP, webhooks, API keys and CORS were never built. Company information is not shown anywhere.
-- Forward-only and idempotent: removing a key that is not there changes nothing. backupSettings.onlyOffice and everything else stay.
UPDATE system_configurations
SET general_config = general_config
        - 'companyInfo'
        #- '{backupSettings,enableAutoBackup}'
        #- '{backupSettings,backupFrequency}'
        #- '{backupSettings,backupTime}'
        #- '{backupSettings,retentionDays}'
        #- '{backupSettings,backupLocation}'
        #- '{backupSettings,notifyOnBackupFailure}',
    integrations_config = integrations_config
        - 'sso'
        - 'ldap'
        - 'webhooks'
        - 'enableApiKeyAuth'
        - 'apiRateLimitPerMinute'
        - 'corsAllowedOrigins';
