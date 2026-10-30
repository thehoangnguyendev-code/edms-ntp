-- Training Management: how an item of an assessment is laid out when it is written into the form APD.0009.
-- option_layout: the answers of a question to choose from are listed one under the other (VERTICAL, the default) or in two columns (TWO_COLUMNS).
-- answer_lines: the number of ruled lines the form gives for the answer of an essay question (NULL: the default of the form, 8).
ALTER TABLE training_assessment_def_items ADD COLUMN IF NOT EXISTS option_layout varchar(12) NOT NULL DEFAULT 'VERTICAL';
ALTER TABLE training_assessment_def_items ADD COLUMN IF NOT EXISTS answer_lines integer;
ALTER TABLE training_assessment_def_items ADD CONSTRAINT ck_training_assessment_item_layout CHECK (option_layout IN ('VERTICAL', 'TWO_COLUMNS'));
ALTER TABLE training_assessment_def_items ADD CONSTRAINT ck_training_assessment_item_lines CHECK (answer_lines IS NULL OR answer_lines BETWEEN 1 AND 30);
