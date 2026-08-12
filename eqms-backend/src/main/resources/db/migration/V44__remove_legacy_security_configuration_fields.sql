UPDATE system_configurations
SET security_config = security_config
    - 'enableAutoLogout'
    - 'autoLogoutMinutes'
    - 'ipSecurity'
    - 'auditSettings'
WHERE security_config IS NOT NULL;
