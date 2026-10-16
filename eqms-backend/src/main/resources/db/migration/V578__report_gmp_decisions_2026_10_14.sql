-- Decisions of 2026-10-14 (see eqms-backend/docs/governance/DECISION_LOG.md, REPORT-* entries).
-- Forward-only: no row is deleted and no report file is removed from storage.

-- 1. REPORT-TEST-TEMPLATES: the three TEST_ templates seeded by V533 are soft-deleted and kept as history.
UPDATE report_definitions
   SET deleted_at = COALESCE(deleted_at, now()),
       active = false,
       updated_at = now()
 WHERE code IN ('TEST_DOCUMENT_REGISTER', 'TEST_DOCUMENT_LIFECYCLE', 'TEST_DEPARTMENT_REGISTER');

-- 2. REPORT-FILE-RETENTION-PERMANENT: no report definition is linked to a retention period, and no
--    report file that has not been purged carries an expiry date.
UPDATE report_definitions
   SET retention_policy_id = NULL,
       updated_at = now()
 WHERE retention_policy_id IS NOT NULL;

UPDATE report_artifacts
   SET expires_at = NULL
 WHERE expires_at IS NOT NULL
   AND purged_at IS NULL;

-- 3. REPORT-ANALYTICS-PRODUCTION: the analytics screens (Overview, Quality Analytics) are behind a feature flag that is
--    off by default. The flag is added to the stored feature list; an administrator may switch it on in Settings.
UPDATE system_configurations
   SET features_config = features_config || jsonb_build_array(jsonb_build_object(
           'id', 'feat-report-analytics',
           'name', 'Quality Analytics and Reports Overview',
           'description', 'Design preview with sample data. Off until real analytics exist (REPORT-ANALYTICS-PRODUCTION-2026-10-14).',
           'enabled', false,
           'category', 'System')),
       updated_at = now()
 WHERE NOT (features_config @> '[{"id": "feat-report-analytics"}]');
