-- What a training file is for: the content, the exam paper, or the answer key (the answer key is shown only to the organizers and the content reviewers/approvers).
ALTER TABLE training_materials ADD COLUMN IF NOT EXISTS purpose VARCHAR(20) NOT NULL DEFAULT 'CONTENT';
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_training_materials_purpose') THEN
        ALTER TABLE training_materials ADD CONSTRAINT ck_training_materials_purpose CHECK (purpose IN ('CONTENT', 'EXAM', 'ANSWER_KEY'));
    END IF;
END $$;
