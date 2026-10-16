-- REPORT-LEGAL-HOLD-2026-10-14 and REPORT-DEFINITION-SIGNATURE-2026-10-14: two electronic signature meanings for reports.
-- Forward-only, idempotent.
INSERT INTO electronic_signature_meanings (id, code, display_name)
VALUES
    (gen_random_uuid(), 'REPORT_LEGAL_HOLD_RELEASE', 'Report Legal Hold Released'),
    (gen_random_uuid(), 'REPORT_DEFINITION_CHANGE', 'Report Definition Change')
ON CONFLICT (code) DO NOTHING;
