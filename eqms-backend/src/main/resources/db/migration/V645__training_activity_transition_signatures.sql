-- Every change of state of a training activity is signed: the notice to the trainees (Planned -> Notified), the start of the first session (Notified -> In progress), the sending of the
-- results to QA (In progress -> Pending QA Confirmation). The other changes were already signed (list verified, content reviewed and approved, completion, cancellation, reopening, return).
INSERT INTO electronic_signature_meanings (id, code, display_name)
SELECT gen_random_uuid(), v.code, v.name
FROM (VALUES
 ('TRAINING_ACTIVITY_NOTIFIED',          'Training Notified'),
 ('TRAINING_SESSION_STARTED',            'Training Started'),
 ('TRAINING_SUBMITTED_FOR_CONFIRMATION', 'Results Sent to QA')
) AS v(code, name)
WHERE NOT EXISTS (SELECT 1 FROM electronic_signature_meanings m WHERE m.code = v.code);
