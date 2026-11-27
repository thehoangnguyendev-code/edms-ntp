-- DEC-TRAINING-2026-11-27-01 (F4): SOP.0003 5.3.6 asks the organizer to notify Human Resources (venue, equipment, materials) and the departments concerned (equipment for a practical
-- training). A line of the preparation can be given to a department; the people who conduct training there are told.
ALTER TABLE training_session_preparation ADD COLUMN IF NOT EXISTS assigned_department_id uuid REFERENCES departments(id);
