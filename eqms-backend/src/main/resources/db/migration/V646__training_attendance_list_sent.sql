-- SOP.0003 5.3.6 and APD.0117: once the attendance is recorded (the "Signature" column of the list), the organizing department sends the attendance list to QA, and from then on the
-- revision of the document can be completed ("Complete Training" in Document Control). The results of the assessment follow later (5.3.7). The send is a step of its own, signed, and kept.
ALTER TABLE training_activities ADD COLUMN IF NOT EXISTS attendance_sent_at TIMESTAMPTZ;
ALTER TABLE training_activities ADD COLUMN IF NOT EXISTS attendance_sent_by UUID REFERENCES app_users(id);
ALTER TABLE training_activities ADD COLUMN IF NOT EXISTS attendance_signature_id UUID;

-- Activities that already sent their results (or are completed) sent their list at that time.
UPDATE training_activities a SET attendance_sent_at = e.at
  FROM (SELECT activity_id, min(occurred_at) AS at FROM training_events WHERE event_type = 'PENDING_QA_CONFIRMATION' GROUP BY activity_id) e
 WHERE e.activity_id = a.id AND a.attendance_sent_at IS NULL;
UPDATE training_activities SET attendance_sent_at = COALESCE(confirmed_at, updated_at) WHERE status = 'COMPLETED' AND attendance_sent_at IS NULL;

INSERT INTO permissions (id, code, name, category, module_key, group_key, description, display_order, requires_audit)
SELECT gen_random_uuid(), 'training.attendance.receive', 'Receive Training Attendance Lists', 'Training Management', 'training', 'training_activity',
       'Be told when the attendance list of a training is sent to QA, and when the results are sent, so that the revision can be completed in Document Control and the results written in the list.', 245, TRUE
WHERE NOT EXISTS (SELECT 1 FROM permissions p WHERE p.code = 'training.attendance.receive');

INSERT INTO electronic_signature_meanings (id, code, display_name)
SELECT gen_random_uuid(), v.code, v.name
FROM (VALUES ('TRAINING_ATTENDANCE_SENT', 'Attendance List Sent to QA')) AS v(code, name)
WHERE NOT EXISTS (SELECT 1 FROM electronic_signature_meanings m WHERE m.code = v.code);
