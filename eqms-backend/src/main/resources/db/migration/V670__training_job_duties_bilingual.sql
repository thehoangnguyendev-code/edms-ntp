-- APD.0024, part 4 "Responsibility and Job description": the form is written in Vietnamese with the English under it (in italic), and a cell holds several lines. The user types
-- both languages in the software; the system writes them into the Word form and shows them in the same layout on the screen.
ALTER TABLE training_job_assignment_duties ALTER COLUMN responsibility TYPE TEXT;
ALTER TABLE training_job_assignment_duties ADD COLUMN IF NOT EXISTS responsibility_en TEXT;
ALTER TABLE training_job_assignment_duties ADD COLUMN IF NOT EXISTS description_en TEXT;
