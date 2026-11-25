-- Cancelling a session that was added and is not needed (activity still Planned) is signed (DEC-TRAINING-2026-11-24-4).
INSERT INTO electronic_signature_meanings (id, code, display_name)
SELECT gen_random_uuid(), v.code, v.name
FROM (VALUES
 ('TRAINING_SESSION_CANCELLED', 'Training Session Cancelled', 'The person cancels a session that is not needed before the training starts.')
) AS v(code, name, descr)
WHERE NOT EXISTS (SELECT 1 FROM electronic_signature_meanings m WHERE m.code = v.code);
