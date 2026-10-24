-- Content that was reviewed or approved can be reopened before the training starts; it must then be reviewed and approved again. A confirmation is never
-- changed or deleted (it is immutable), so the reopening is a separate record, and the confirmations that count are read through a view.
CREATE TABLE IF NOT EXISTS training_confirmation_supersessions (
    confirmation_id UUID PRIMARY KEY REFERENCES training_activity_confirmations(id) ON DELETE RESTRICT,
    superseded_by   UUID NOT NULL REFERENCES app_users(id),
    superseded_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    reason          TEXT NOT NULL,
    signature_id    UUID
);

DROP TRIGGER IF EXISTS trg_training_confirmation_supersessions_immutable_row ON training_confirmation_supersessions;
CREATE TRIGGER trg_training_confirmation_supersessions_immutable_row BEFORE DELETE OR UPDATE ON training_confirmation_supersessions
    FOR EACH ROW EXECUTE FUNCTION training_prevent_mutation();
DROP TRIGGER IF EXISTS trg_training_confirmation_supersessions_immutable_stmt ON training_confirmation_supersessions;
CREATE TRIGGER trg_training_confirmation_supersessions_immutable_stmt BEFORE TRUNCATE ON training_confirmation_supersessions
    FOR EACH STATEMENT EXECUTE FUNCTION training_prevent_mutation();

CREATE OR REPLACE VIEW training_active_confirmations AS
SELECT c.* FROM training_activity_confirmations c
 WHERE NOT EXISTS (SELECT 1 FROM training_confirmation_supersessions s WHERE s.confirmation_id = c.id);

INSERT INTO electronic_signature_meanings (id, code, display_name)
SELECT gen_random_uuid(), v.code, v.name
FROM (VALUES
 ('TRAINING_CONTENT_REOPENED',           'Training Content Reopened',           'The person reopens approved training content for correction; it must be reviewed and approved again.'),
 ('TRAINING_RETURNED_FOR_CORRECTION',    'Training Returned for Correction',    'QA returns the results of a training activity to the organizer for correction before confirming it.')
) AS v(code, name, descr)
WHERE NOT EXISTS (SELECT 1 FROM electronic_signature_meanings m WHERE m.code = v.code);
