-- Training Management: the guard of the lines of a training requirement (V685 replaced the id of the Training Topic of a line by the topic written in it): an approved requirement keeps its plan, which now
-- means the same line number, the same topic text and the same document.
CREATE OR REPLACE FUNCTION training_requirement_line_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE s VARCHAR(16);
BEGIN
    SELECT status INTO s FROM training_requirements WHERE id = COALESCE(OLD.requirement_id, NEW.requirement_id);
    IF TG_OP = 'DELETE' THEN
        IF s <> 'DRAFT' THEN RAISE EXCEPTION 'The lines of a submitted requirement cannot be deleted' USING ERRCODE = '0LPTR'; END IF;
        RETURN OLD;
    END IF;
    IF s <> 'DRAFT' THEN
        IF s <> 'APPROVED' THEN RAISE EXCEPTION 'The lines of a submitted requirement cannot be changed' USING ERRCODE = '0LPTR'; END IF;
        IF NEW.requirement_id <> OLD.requirement_id OR NEW.line_no <> OLD.line_no OR NEW.topic_text IS DISTINCT FROM OLD.topic_text OR NEW.document_id IS DISTINCT FROM OLD.document_id THEN
            RAISE EXCEPTION 'The plan of an approved requirement cannot be changed' USING ERRCODE = '0LPTR';
        END IF;
        IF NEW.planned_month <> OLD.planned_month AND NEW.postponed_from IS NULL THEN
            RAISE EXCEPTION 'A month of an approved requirement can only be postponed, with the old month kept' USING ERRCODE = '0LPTR';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;
