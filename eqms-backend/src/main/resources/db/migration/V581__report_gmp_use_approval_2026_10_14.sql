-- REPORT-GMP-USE-APPROVAL-2026-10-14 (owner answers, 2026-10-14).
-- A template may be marked "for GMP use" when it is created. Such a template runs only while the version it was approved at is the
-- current version. Approval needs a permission held by a QA person, an electronic signature, and an approver who is not the author.
-- Forward-only, idempotent.
ALTER TABLE report_definitions ADD COLUMN IF NOT EXISTS gmp_use BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE report_definitions ADD COLUMN IF NOT EXISTS gmp_approved_version INTEGER;
ALTER TABLE report_definitions ADD COLUMN IF NOT EXISTS gmp_approved_by_user_id UUID REFERENCES app_users(id);
ALTER TABLE report_definitions ADD COLUMN IF NOT EXISTS gmp_approved_at TIMESTAMPTZ;
ALTER TABLE report_definitions ADD COLUMN IF NOT EXISTS gmp_approval_signature_id VARCHAR(64);

INSERT INTO permissions (id, code, name, category, module_key, group_key, description, display_order, requires_audit)
SELECT gen_random_uuid(), 'reports.definition.approve_gmp', 'Approve Report for GMP Use', 'Reporting', 'report', 'report_configuration',
       'Approve a report template that is marked for GMP use. The approver must not be the author of the current version.', 180, TRUE
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE code = 'reports.definition.approve_gmp');

INSERT INTO electronic_signature_meanings (id, code, display_name)
VALUES (gen_random_uuid(), 'REPORT_GMP_APPROVAL', 'Report Approved for GMP Use')
ON CONFLICT (code) DO NOTHING;
