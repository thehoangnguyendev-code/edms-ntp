-- Training Management: the catalog of Training Topics (Training Administration) is removed. SOP.0003 does not ask for it: a training topic is the content of a training, written by the person who plans it
-- (a document from Document Control gives its number and name). A matrix row, a line of a training requirement and an item required by a job assignment now carry the topic as text
-- (topic_text) or the document; the row of a matrix keeps its group (row_group) and whether Quality Assurance locked it (locked: the head of department cannot take it out).
-- What was recorded as done is compared with the topic by its text (case, spaces and accents ignored by the server), or by the document number.
-- the key of a topic text: what is compared (case and the spaces between the words ignored)
CREATE OR REPLACE FUNCTION training_topic_key(p text) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT lower(btrim(regexp_replace(coalesce(p, ''), '\s+', ' ', 'g'))) $$;

-- the content of an approved matrix is guarded by triggers; this migration only writes the same content in another form (the name of the topic instead of its id), so the guards are off for its length
ALTER TABLE training_matrix_rows DISABLE TRIGGER trg_training_matrix_rows_guard;
ALTER TABLE training_matrix_cells DISABLE TRIGGER trg_training_matrix_cells_guard;
ALTER TABLE training_requirement_lines DISABLE TRIGGER trg_training_requirement_line_guard;
ALTER TABLE training_job_required_items DISABLE TRIGGER trg_training_job_required_guard;

ALTER TABLE training_matrix_rows ADD COLUMN IF NOT EXISTS topic_text varchar(500);
ALTER TABLE training_matrix_rows ADD COLUMN IF NOT EXISTS locked boolean NOT NULL DEFAULT false;
ALTER TABLE training_requirement_lines ADD COLUMN IF NOT EXISTS topic_text varchar(500);
ALTER TABLE training_job_required_items ADD COLUMN IF NOT EXISTS topic_text varchar(500);

UPDATE training_matrix_rows r
   SET topic_text = t.name,
       locked = (r.all_employees AND t.required_for_all AND t.active)
  FROM training_topics t WHERE t.id = r.topic_id;
UPDATE training_requirement_lines l SET topic_text = t.name FROM training_topics t WHERE t.id = l.topic_id;
UPDATE training_job_required_items i SET topic_text = t.name FROM training_topics t WHERE t.id = i.topic_id;

ALTER TABLE training_matrix_rows DROP COLUMN topic_id;
ALTER TABLE training_requirement_lines DROP COLUMN topic_id;
ALTER TABLE training_job_required_items DROP COLUMN topic_id;

ALTER TABLE training_matrix_rows ADD CONSTRAINT ck_training_matrix_rows_content CHECK ((topic_text IS NULL) <> (document_id IS NULL));
ALTER TABLE training_requirement_lines ADD CONSTRAINT ck_training_requirement_lines_content CHECK ((topic_text IS NULL) <> (document_id IS NULL));
ALTER TABLE training_job_required_items ADD CONSTRAINT ck_training_job_required_items_content CHECK ((topic_text IS NULL) <> (document_id IS NULL));

DROP TABLE IF EXISTS training_topics;

ALTER TABLE training_matrix_rows ENABLE TRIGGER trg_training_matrix_rows_guard;
ALTER TABLE training_matrix_cells ENABLE TRIGGER trg_training_matrix_cells_guard;
ALTER TABLE training_requirement_lines ENABLE TRIGGER trg_training_requirement_line_guard;
ALTER TABLE training_job_required_items ENABLE TRIGGER trg_training_job_required_guard;
