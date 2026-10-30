-- Training Management: the numbering of the essay questions in the form of an assessment (Part II): CONTINUE after the multiple-choice questions (the default, as before) or RESTART at question 1.
ALTER TABLE training_assessment_defs ADD COLUMN IF NOT EXISTS essay_numbering VARCHAR(10) NOT NULL DEFAULT 'CONTINUE';
ALTER TABLE training_assessment_defs DROP CONSTRAINT IF EXISTS ck_training_assessment_essay_numbering;
ALTER TABLE training_assessment_defs ADD CONSTRAINT ck_training_assessment_essay_numbering CHECK (essay_numbering IN ('CONTINUE', 'RESTART'));
