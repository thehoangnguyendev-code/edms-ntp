-- Training Assessments: choosing one in the tab Assessment of an activity now writes its content into the enabled Word form APD.0009 as the exam file and the answer key of the activity (two
-- ordinary files, which the organizer can open and change in the editor). The frozen copy kept in its own table is no longer needed: the files are the copy.
DROP TABLE IF EXISTS training_activity_assessments;
ALTER TABLE training_activities ADD COLUMN IF NOT EXISTS assessment_chosen_by UUID REFERENCES app_users(id);
ALTER TABLE training_activities ADD COLUMN IF NOT EXISTS assessment_chosen_at TIMESTAMPTZ;
