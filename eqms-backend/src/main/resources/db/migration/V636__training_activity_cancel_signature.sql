-- Cancelling a training activity that has been notified (or later) is signed: people have been told, sessions may have been held.
INSERT INTO electronic_signature_meanings (id, code, display_name)
SELECT gen_random_uuid(), v.code, v.name
FROM (VALUES
 ('TRAINING_ACTIVITY_CANCELLED', 'Training Activity Cancelled', 'The person cancels a training activity after the people were notified.')
) AS v(code, name, descr)
WHERE NOT EXISTS (SELECT 1 FROM electronic_signature_meanings m WHERE m.code = v.code);
