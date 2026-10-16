-- REPORT-TEMPLATE-APPROVAL-2026-10-14 and REPORT-NAME-FORMAT-2026-10-14 (owner request, 2026-10-14).
-- Every template version goes through Draft -> Pending approval -> Approved. Only an approved current version can run.
-- Templates that existed before this migration return to Draft: they must pass the approval flow again before they run.
-- A template may take its display name from a name format (rule) maintained in Report Administration.
-- Forward-only, idempotent where PostgreSQL allows it.

-- 1. Name formats (rules for report template names).
CREATE TABLE IF NOT EXISTS report_name_formats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(80) NOT NULL UNIQUE,
    name VARCHAR(120) NOT NULL,
    separator VARCHAR(5) NOT NULL,
    description VARCHAR(500),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS report_name_format_parts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    format_id UUID NOT NULL REFERENCES report_name_formats(id) ON DELETE CASCADE,
    display_order INTEGER NOT NULL,
    part_type VARCHAR(20) NOT NULL CHECK (part_type IN ('FIXED', 'INPUT')),
    fixed_text VARCHAR(100),
    input_label VARCHAR(100),
    input_rule VARCHAR(20) CHECK (input_rule IN ('TEXT', 'UPPER_CODE', 'DIGITS')),
    max_length INTEGER CHECK (max_length BETWEEN 1 AND 200),
    UNIQUE (format_id, display_order)
);

INSERT INTO report_name_formats (id, code, name, separator, description, active)
SELECT gen_random_uuid(), 'EQMS_REPORT_TITLE', 'EQMS report title', ' - ', 'Example rule: a fixed prefix and a topic typed for each template.', TRUE
WHERE NOT EXISTS (SELECT 1 FROM report_name_formats WHERE code = 'EQMS_REPORT_TITLE');

INSERT INTO report_name_format_parts (id, format_id, display_order, part_type, fixed_text, input_label, input_rule, max_length)
SELECT gen_random_uuid(), f.id, 1, 'FIXED', 'EQMS', NULL, NULL, NULL FROM report_name_formats f
WHERE f.code = 'EQMS_REPORT_TITLE' AND NOT EXISTS (SELECT 1 FROM report_name_format_parts p WHERE p.format_id = f.id);

INSERT INTO report_name_format_parts (id, format_id, display_order, part_type, fixed_text, input_label, input_rule, max_length)
SELECT gen_random_uuid(), f.id, 2, 'INPUT', NULL, 'Report topic', 'TEXT', 100 FROM report_name_formats f
WHERE f.code = 'EQMS_REPORT_TITLE' AND NOT EXISTS (SELECT 1 FROM report_name_format_parts p WHERE p.format_id = f.id AND p.display_order = 2);

-- 2. Approval state of each template version. The gmp_* approval columns of V581 become the general approval columns.
ALTER TABLE report_definitions RENAME COLUMN gmp_approved_version TO approved_version;
ALTER TABLE report_definitions RENAME COLUMN gmp_approved_by_user_id TO approved_by_user_id;
ALTER TABLE report_definitions RENAME COLUMN gmp_approved_at TO approved_at;
ALTER TABLE report_definitions RENAME COLUMN gmp_approval_signature_id TO approval_signature_id;
ALTER TABLE report_definitions ADD COLUMN IF NOT EXISTS approval_status VARCHAR(30) NOT NULL DEFAULT 'DRAFT';
ALTER TABLE report_definitions DROP CONSTRAINT IF EXISTS chk_report_definitions_approval_status;
ALTER TABLE report_definitions ADD CONSTRAINT chk_report_definitions_approval_status CHECK (approval_status IN ('DRAFT', 'PENDING_APPROVAL', 'APPROVED'));
ALTER TABLE report_definitions ADD COLUMN IF NOT EXISTS submitted_version INTEGER;
ALTER TABLE report_definitions ADD COLUMN IF NOT EXISTS submitted_by_user_id UUID REFERENCES app_users(id);
ALTER TABLE report_definitions ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;
ALTER TABLE report_definitions ADD COLUMN IF NOT EXISTS approval_comment TEXT;
-- Existing templates are not approved by this migration: they return to Draft and must be approved again.
UPDATE report_definitions SET approval_status = 'DRAFT', approved_version = NULL, approved_by_user_id = NULL, approved_at = NULL, approval_signature_id = NULL;

-- 3. Name format used by a template, and the values typed for its input parts.
ALTER TABLE report_definitions ADD COLUMN IF NOT EXISTS name_format_id UUID REFERENCES report_name_formats(id);
ALTER TABLE report_definitions ADD COLUMN IF NOT EXISTS name_values JSONB NOT NULL DEFAULT '{}'::jsonb;

-- 4. Permission renamed to fit general approval; new permission to maintain name formats.
UPDATE permissions
   SET code = 'reports.definition.approve',
       name = 'Approve Report Template',
       description = 'Approve or reject a report template version. The approver must not be its author or the person who submitted it.'
 WHERE code = 'reports.definition.approve_gmp';
INSERT INTO permissions (id, code, name, category, module_key, group_key, description, display_order, requires_audit)
SELECT gen_random_uuid(), 'reports.definition.approve', 'Approve Report Template', 'Reporting', 'report', 'report_configuration',
       'Approve or reject a report template version. The approver must not be its author or the person who submitted it.', 180, TRUE
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE code = 'reports.definition.approve');
INSERT INTO permissions (id, code, name, category, module_key, group_key, description, display_order, requires_audit)
SELECT gen_random_uuid(), 'reports.name_format.manage', 'Manage Report Name Formats', 'Reporting', 'report', 'report_configuration',
       'Create and change the rules that give report template names.', 181, TRUE
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE code = 'reports.name_format.manage');

-- 5. Electronic signature meaning renamed to fit general approval.
UPDATE electronic_signature_meanings
   SET code = 'REPORT_TEMPLATE_APPROVAL', display_name = 'Report Template Approved'
 WHERE code = 'REPORT_GMP_APPROVAL' AND NOT EXISTS (SELECT 1 FROM electronic_signature_meanings WHERE code = 'REPORT_TEMPLATE_APPROVAL');
INSERT INTO electronic_signature_meanings (id, code, display_name)
SELECT gen_random_uuid(), 'REPORT_TEMPLATE_APPROVAL', 'Report Template Approved'
WHERE NOT EXISTS (SELECT 1 FROM electronic_signature_meanings WHERE code = 'REPORT_TEMPLATE_APPROVAL');
