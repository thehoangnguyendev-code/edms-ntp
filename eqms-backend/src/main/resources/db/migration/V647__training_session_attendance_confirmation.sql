-- APD.0117 item 5 ("Confirmation of the trainer"): the trainer of a session confirms, with a signature, that the attendance of the session is recorded in full (everyone present, online or absent,
-- every absence with its reason). The attendance list goes to QA only when every held session is confirmed. A correction of an attendance afterwards clears the confirmation of its session.
ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS attendance_confirmed_at TIMESTAMPTZ;
ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS attendance_confirmed_by UUID REFERENCES app_users(id);
ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS attendance_signature_id UUID;

-- Activities whose list was already sent keep working: their sessions count as confirmed at that time.
UPDATE training_sessions s SET attendance_confirmed_at = a.attendance_sent_at, attendance_confirmed_by = a.attendance_sent_by, attendance_signature_id = a.attendance_signature_id
  FROM training_activities a
 WHERE a.id = s.activity_id AND a.attendance_sent_at IS NOT NULL AND s.attendance_confirmed_at IS NULL AND s.status = 'PLANNED' AND s.held_on IS NOT NULL;
