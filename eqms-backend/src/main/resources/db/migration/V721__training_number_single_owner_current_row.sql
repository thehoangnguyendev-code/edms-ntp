-- V720 checked the row as it was when the statement ran, but the check is deferred to the end of the transaction, and Legacy Import saves the revision with the number first and links it to its
-- activity a moment later: the first version of the row (no activity yet) was refused although the row ends the transaction correct. The check now reads the row as it is at the end.
CREATE OR REPLACE FUNCTION training_number_single_owner_check() RETURNS trigger AS $$
DECLARE
    current_number TEXT;
    current_activity UUID;
BEGIN
    IF TG_TABLE_NAME = 'document_revisions' THEN
        SELECT r.training_number, r.training_activity_id INTO current_number, current_activity FROM document_revisions r WHERE r.id = NEW.id;
        IF NOT FOUND THEN
            RETURN NULL;
        END IF;
        IF current_number IS NOT NULL AND btrim(current_number) <> '' AND EXISTS (
            SELECT 1 FROM training_activities a
             WHERE upper(a.training_number) = upper(current_number) AND (current_activity IS NULL OR current_activity <> a.id)) THEN
            RAISE EXCEPTION 'Training Number % belongs to a training activity; the revision must point to that activity', current_number USING ERRCODE = '23514';
        END IF;
    ELSE
        SELECT a.training_number INTO current_number FROM training_activities a WHERE a.id = NEW.id;
        IF NOT FOUND THEN
            RETURN NULL;
        END IF;
        IF EXISTS (
            SELECT 1 FROM document_revisions r
             WHERE r.training_number IS NOT NULL AND upper(r.training_number) = upper(current_number) AND (r.training_activity_id IS NULL OR r.training_activity_id <> NEW.id)) THEN
            RAISE EXCEPTION 'Training Number % is already on a document revision that does not point to this activity', current_number USING ERRCODE = '23514';
        END IF;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;
