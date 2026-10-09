-- DEV ENVIRONMENT ONLY (owner decision B, 2026-10-08). See docs/plans/MINIO_STORAGE_LAYOUT_CHANGE_PLAN.md.
-- New writes go to eqms-gmp-records (object lock) and templates go to eqms-templates (no lock). Existing objects stay in
-- eqms-gmp-revisions and are still read through the minio:// URIs stored in the database.
-- Production MUST NOT receive this migration as-is: the bucket change there must go through Integration Settings with a
-- reason and an e-signature. Remove or convert this file before any production deployment.
UPDATE system_configurations
SET integrations_config = jsonb_set(
        jsonb_set(integrations_config, '{storage,minioBucket}', '"eqms-gmp-records"'),
        '{storage,minioTemplatesBucket}', '"eqms-templates"'),
    updated_at = now()
WHERE integrations_config ? 'storage';
