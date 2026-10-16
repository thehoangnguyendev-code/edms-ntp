-- REPORT-TEMPLATE-APPROVAL-2026-10-14 (owner answers, 2026-10-14): returning a version to draft is signed electronically,
-- and the example name rule seeded by V582 is removed when no template uses it. Forward-only, idempotent.

-- 1. Electronic signature meaning for returning a version to draft.
INSERT INTO electronic_signature_meanings (id, code, display_name)
SELECT gen_random_uuid(), 'REPORT_TEMPLATE_REJECTION', 'Report Template Returned to Draft'
WHERE NOT EXISTS (SELECT 1 FROM electronic_signature_meanings WHERE code = 'REPORT_TEMPLATE_REJECTION');

-- 2. The example name rule is removed, unless a template already names itself with it.
DELETE FROM report_name_formats f
 WHERE f.code = 'EQMS_REPORT_TITLE'
   AND NOT EXISTS (SELECT 1 FROM report_definitions d WHERE d.name_format_id = f.id);
