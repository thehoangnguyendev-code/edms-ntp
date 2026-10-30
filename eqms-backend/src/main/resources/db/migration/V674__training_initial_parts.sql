-- SOP.0003 5.1 (initial training): every new employee gets three parts of training, each given by a unit: (1) occupational safety and company policy (HR), (2) general principles of GMP (QA),
-- (3) job-specific training (the related department; it is the matrix of the Job Roles of the person). The three parts, their names and the units are the ones of the SOP and can be changed by
-- Training Administration (owner decision 2026-10-26). The trainings of parts 1 and 2 are chosen among the trainings that are required of all employees (V673); part 3 comes from the matrix.
CREATE TABLE IF NOT EXISTS training_initial_parts (
    id          UUID PRIMARY KEY,
    part_no     INTEGER      NOT NULL UNIQUE CHECK (part_no BETWEEN 1 AND 3),
    name_vi     VARCHAR(255) NOT NULL,
    name_en     VARCHAR(255) NOT NULL,
    unit_text   VARCHAR(160) NOT NULL,
    from_matrix BOOLEAN      NOT NULL DEFAULT FALSE,
    version     INTEGER      NOT NULL DEFAULT 1,
    updated_by  UUID,
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS training_initial_part_topics (
    part_id  UUID NOT NULL REFERENCES training_initial_parts(id) ON DELETE CASCADE,
    topic_id UUID NOT NULL REFERENCES training_topics(id),
    PRIMARY KEY (part_id, topic_id)
);
INSERT INTO training_initial_parts(id, part_no, name_vi, name_en, unit_text, from_matrix) VALUES
    (gen_random_uuid(), 1, 'An toàn lao động và chính sách, nội quy của công ty', 'Occupational safety and company policy', 'Phòng HCNS / HR department', FALSE),
    (gen_random_uuid(), 2, 'Đào tạo nguyên tắc chung của GMP', 'General principles training of GMP', 'QA', FALSE),
    (gen_random_uuid(), 3, 'Đào tạo chuyên môn công việc', 'Job-specific training', 'Bộ phận liên quan / Related department', TRUE)
ON CONFLICT (part_no) DO NOTHING;
-- a new employee is one who started in the last this many days
ALTER TABLE training_settings ADD COLUMN IF NOT EXISTS initial_training_days INTEGER NOT NULL DEFAULT 90 CHECK (initial_training_days BETWEEN 1 AND 730);
