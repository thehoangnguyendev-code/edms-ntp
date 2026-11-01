-- A Training Number belongs to one training activity. The activity is the owner; a document revision that carries the number must point to that activity (training_activity_id).
-- Before this, a number typed from a paper record on a revision (Legacy Import) and a number issued to an activity lived in two tables with no rule between them, so the same number could
-- be on both. The rule is checked at the end of the transaction (deferred), because Legacy Import saves the revision with the number first and links it to its activity a moment later.
-- (V718 gave every revision with a paper number its activity; on DEV no row broke the rule when this was written.)

CREATE OR REPLACE FUNCTION training_number_single_owner_check() RETURNS trigger AS $$
BEGIN
    IF TG_TABLE_NAME = 'document_revisions' THEN
        IF NEW.training_number IS NOT NULL AND btrim(NEW.training_number) <> '' AND EXISTS (
            SELECT 1 FROM training_activities a
             WHERE upper(a.training_number) = upper(NEW.training_number) AND (NEW.training_activity_id IS NULL OR NEW.training_activity_id <> a.id)) THEN
            RAISE EXCEPTION 'Training Number % belongs to a training activity; the revision must point to that activity', NEW.training_number USING ERRCODE = '23514';
        END IF;
    ELSE
        IF EXISTS (
            SELECT 1 FROM document_revisions r
             WHERE r.training_number IS NOT NULL AND upper(r.training_number) = upper(NEW.training_number) AND (r.training_activity_id IS NULL OR r.training_activity_id <> NEW.id)) THEN
            RAISE EXCEPTION 'Training Number % is already on a document revision that does not point to this activity', NEW.training_number USING ERRCODE = '23514';
        END IF;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ctrg_revision_training_number_owner ON document_revisions;
CREATE CONSTRAINT TRIGGER ctrg_revision_training_number_owner AFTER INSERT OR UPDATE OF training_number, training_activity_id ON document_revisions
    DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION training_number_single_owner_check();

DROP TRIGGER IF EXISTS ctrg_activity_training_number_owner ON training_activities;
CREATE CONSTRAINT TRIGGER ctrg_activity_training_number_owner AFTER INSERT OR UPDATE OF training_number ON training_activities
    DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION training_number_single_owner_check();
