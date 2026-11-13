-- REPORT-RUN-SIGNATURE-2026-11-12: a run of the Audit Trail report is signed by the person who requests it.
-- Forward-only, idempotent.
INSERT INTO electronic_signature_meanings (id, code, display_name, action_name)
VALUES (gen_random_uuid(), 'REPORT_RUN_REQUESTED', 'Report Run Requested', 'Report Run Requested')
ON CONFLICT (code) DO NOTHING;
