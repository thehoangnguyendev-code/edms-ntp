-- Job assignment (APD.0024, SOP.0003 5.3.8): besides the training the matrix requires for the Job Role, the person who assigns can tick other trainings (a topic or a SOP) that the
-- person must have completed before the assignment can be signed. The check is made at once, on the draft, and again when the assignment is signed.
CREATE TABLE IF NOT EXISTS training_job_required_items (
    assignment_id UUID    NOT NULL REFERENCES training_job_assignments(id) ON DELETE CASCADE,
    sort_order    INTEGER NOT NULL,
    topic_id      UUID    REFERENCES training_topics(id),
    document_id   UUID    REFERENCES documents(id),
    PRIMARY KEY (assignment_id, sort_order),
    CHECK ((topic_id IS NULL) <> (document_id IS NULL))
);
CREATE OR REPLACE FUNCTION training_job_required_guard() RETURNS trigger AS $$
DECLARE s VARCHAR(20);
BEGIN
    SELECT status INTO s FROM training_job_assignments WHERE id = COALESCE(OLD.assignment_id, NEW.assignment_id);
    IF s IN ('PENDING_RECEIVER','EFFECTIVE','OBSOLETED') THEN RAISE EXCEPTION 'The required trainings of a signed job assignment cannot be changed' USING ERRCODE = '0LPTR'; END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_training_job_required_guard ON training_job_required_items;
CREATE TRIGGER trg_training_job_required_guard BEFORE INSERT OR UPDATE OR DELETE ON training_job_required_items FOR EACH ROW EXECUTE FUNCTION training_job_required_guard();
