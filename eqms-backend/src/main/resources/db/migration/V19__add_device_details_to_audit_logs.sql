ALTER TABLE audit_logs
    ADD COLUMN IF NOT EXISTS device_browser VARCHAR(80),
    ADD COLUMN IF NOT EXISTS device_model VARCHAR(120),
    ADD COLUMN IF NOT EXISTS device_platform VARCHAR(80),
    ADD COLUMN IF NOT EXISTS device_platform_version VARCHAR(40);
