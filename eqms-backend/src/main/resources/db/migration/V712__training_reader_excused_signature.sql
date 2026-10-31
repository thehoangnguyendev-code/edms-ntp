-- A person of a self-reading who cannot read in this training is recorded as absent by the trainer or organizer, with a reason and an electronic signature (owner decision 2026-10-31).
INSERT INTO electronic_signature_meanings (id, code, display_name)
SELECT gen_random_uuid(), v.code, v.name
FROM (VALUES ('TRAINING_READER_EXCUSED', 'Reader Excused from Self-reading')) AS v(code, name)
WHERE NOT EXISTS (SELECT 1 FROM electronic_signature_meanings m WHERE m.code = v.code);
