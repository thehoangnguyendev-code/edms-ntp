-- DEC-TRAINING-2026-11-27-01 (D2): SOP.0003 5.3.2 and section 3 — QA prepares one annual training requirement for the whole plant and the Quality Manager approves it.
-- A plant-wide requirement is held by the department that prepares it (Quality Assurance); its suggestions come from the annual rows of every department.
ALTER TABLE training_requirements ADD COLUMN IF NOT EXISTS plant_wide boolean NOT NULL DEFAULT false;

-- The contents SOP.0003 5.3.2 says the annual requirement includes. A line whose title has the keyword covers it; a requirement without such a line is flagged (not blocked).
CREATE TABLE IF NOT EXISTS training_annual_mandatory_topics (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name       varchar(200) NOT NULL UNIQUE,
    name_vi    varchar(200),
    keyword    varchar(100) NOT NULL,
    active     boolean NOT NULL DEFAULT true
);
INSERT INTO training_annual_mandatory_topics (name, name_vi, keyword) VALUES
 ('General GMP', 'GMP chung', 'gmp'),
 ('Data integrity', 'Toàn vẹn dữ liệu', 'data integrity'),
 ('Aseptic technique', 'Kỹ thuật vô trùng', 'aseptic')
ON CONFLICT (name) DO NOTHING;
