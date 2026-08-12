UPDATE system_configurations
SET notifications_config = jsonb_set(notifications_config, '{enableEmailNotifications}', 'false');
