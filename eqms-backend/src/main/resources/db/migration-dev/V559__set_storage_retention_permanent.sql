-- DEV ONLY (lives in db/migration-dev, loaded only by the dev compose file). Owner decision 2026-10-08: object retention is
-- permanent, i.e. the longest period Object Lock accepts (100 years), instead of 5 years. Applies to objects stored after the
-- change; objects already stored keep the period they were written with.
-- A production change goes through Integration Settings (Retention Period = Permanent) with a reason and an e-signature.
UPDATE system_configurations
SET integrations_config = jsonb_set(integrations_config, '{storage,minioRetentionYears}', '100'),
    updated_at = now()
WHERE integrations_config ? 'storage';
