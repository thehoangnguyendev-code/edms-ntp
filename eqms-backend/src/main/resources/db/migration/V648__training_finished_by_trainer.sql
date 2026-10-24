-- The order of the end of a training (APD.0117): the trainer sends the attendance list (signed), records the results, finishes the training (signed; the results are then written in the column
-- "Training result" of the list) and only then sends the results to QA. "Finish Training" is a step of its own, kept with the signature.
ALTER TABLE training_activities ADD COLUMN IF NOT EXISTS results_finished_at TIMESTAMPTZ;
ALTER TABLE training_activities ADD COLUMN IF NOT EXISTS results_finished_by UUID REFERENCES app_users(id);
ALTER TABLE training_activities ADD COLUMN IF NOT EXISTS results_signature_id UUID;

-- Activities whose results already went to QA were finished at that time.
UPDATE training_activities a SET results_finished_at = COALESCE(e.at, a.updated_at)
  FROM (SELECT activity_id, min(occurred_at) AS at FROM training_events WHERE event_type = 'PENDING_QA_CONFIRMATION' GROUP BY activity_id) e
 WHERE e.activity_id = a.id AND a.results_finished_at IS NULL;
UPDATE training_activities SET results_finished_at = COALESCE(confirmed_at, updated_at) WHERE status IN ('PENDING_QA_CONFIRMATION', 'COMPLETED') AND results_finished_at IS NULL;

INSERT INTO electronic_signature_meanings (id, code, display_name)
SELECT gen_random_uuid(), v.code, v.name
FROM (VALUES ('TRAINING_RESULTS_FINISHED', 'Training Finished by Trainer')) AS v(code, name)
WHERE NOT EXISTS (SELECT 1 FROM electronic_signature_meanings m WHERE m.code = v.code);
