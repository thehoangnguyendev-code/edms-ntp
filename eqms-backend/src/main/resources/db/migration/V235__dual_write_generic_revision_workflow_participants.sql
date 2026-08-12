-- Keep the generic participant projection in lock-step with the established
-- revision_workflow_participants source while the generic-read feature flag is
-- off.  This is additive: legacy writes and legacy reads remain unchanged.
--
-- Sequence is required to preserve sequential reviewer semantics; the original
-- generic table did not retain it, so it could not safely become a read source.
ALTER TABLE workflow_participants
    ADD COLUMN IF NOT EXISTS sequence_order integer NOT NULL DEFAULT 1;

WITH ranked AS (
    SELECT id,
           row_number() OVER (
               PARTITION BY object_type, object_id, participant_type, user_id, sequence_order
               ORDER BY created_at, id
           ) AS row_number
    FROM workflow_participants
)
DELETE FROM workflow_participants participant
USING ranked
WHERE participant.id = ranked.id
  AND ranked.row_number > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uq_workflow_participants_assignment
    ON workflow_participants (object_type, object_id, participant_type, user_id, sequence_order);

-- Reconcile all historical rows before enabling the new read path.  The DELETE
-- is intentionally restricted to DOCUMENT_REVISION; future modules own their
-- own adapters and must not be affected by this migration.
DELETE FROM workflow_participants
WHERE object_type = 'DOCUMENT_REVISION';

INSERT INTO workflow_participants (
    object_type, object_id, participant_type, user_id, action_status,
    sequence_order, created_at, updated_at
)
SELECT
    'DOCUMENT_REVISION', revision_id, participant_type, user_id,
    COALESCE(action_status, 'PENDING'), sequence_order, created_at, updated_at
FROM revision_workflow_participants
ON CONFLICT (object_type, object_id, participant_type, user_id, sequence_order)
DO UPDATE SET
    action_status = EXCLUDED.action_status,
    updated_at = EXCLUDED.updated_at;

CREATE OR REPLACE FUNCTION sync_generic_revision_workflow_participant()
RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        DELETE FROM workflow_participants
        WHERE object_type = 'DOCUMENT_REVISION'
          AND object_id = OLD.revision_id
          AND participant_type = OLD.participant_type
          AND user_id = OLD.user_id
          AND sequence_order = OLD.sequence_order;
        RETURN OLD;
    END IF;

    IF TG_OP = 'UPDATE' THEN
        DELETE FROM workflow_participants
        WHERE object_type = 'DOCUMENT_REVISION'
          AND object_id = OLD.revision_id
          AND participant_type = OLD.participant_type
          AND user_id = OLD.user_id
          AND sequence_order = OLD.sequence_order;
    END IF;

    INSERT INTO workflow_participants (
        object_type, object_id, participant_type, user_id, action_status,
        sequence_order, created_at, updated_at
    ) VALUES (
        'DOCUMENT_REVISION', NEW.revision_id, NEW.participant_type, NEW.user_id,
        COALESCE(NEW.action_status, 'PENDING'), NEW.sequence_order, NEW.created_at, NEW.updated_at
    ) ON CONFLICT (object_type, object_id, participant_type, user_id, sequence_order)
    DO UPDATE SET
        action_status = EXCLUDED.action_status,
        updated_at = EXCLUDED.updated_at;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_generic_revision_workflow_participant
    ON revision_workflow_participants;

CREATE TRIGGER trg_sync_generic_revision_workflow_participant
AFTER INSERT OR UPDATE OR DELETE ON revision_workflow_participants
FOR EACH ROW EXECUTE FUNCTION sync_generic_revision_workflow_participant();

-- Operational reconciliation evidence.  A release gate must show zero rows
-- from this view before app.security.generic-workflow-participants-enabled is
-- enabled for DOCUMENT_REVISION reads.
CREATE OR REPLACE VIEW authorization_participant_reconciliation AS
SELECT
    'MISSING_GENERIC'::varchar AS discrepancy_type,
    legacy.revision_id AS resource_id,
    legacy.participant_type,
    legacy.user_id,
    legacy.sequence_order,
    legacy.action_status AS legacy_action_status,
    NULL::varchar AS generic_action_status
FROM revision_workflow_participants legacy
LEFT JOIN workflow_participants generic_participant
  ON generic_participant.object_type = 'DOCUMENT_REVISION'
 AND generic_participant.object_id = legacy.revision_id
 AND generic_participant.participant_type = legacy.participant_type
 AND generic_participant.user_id = legacy.user_id
 AND generic_participant.sequence_order = legacy.sequence_order
WHERE generic_participant.id IS NULL
UNION ALL
SELECT
    'EXTRA_GENERIC'::varchar,
    generic_participant.object_id,
    generic_participant.participant_type,
    generic_participant.user_id,
    generic_participant.sequence_order,
    NULL::varchar,
    generic_participant.action_status
FROM workflow_participants generic_participant
LEFT JOIN revision_workflow_participants legacy
  ON legacy.revision_id = generic_participant.object_id
 AND legacy.participant_type = generic_participant.participant_type
 AND legacy.user_id = generic_participant.user_id
 AND legacy.sequence_order = generic_participant.sequence_order
WHERE generic_participant.object_type = 'DOCUMENT_REVISION'
  AND legacy.id IS NULL
UNION ALL
SELECT
    'ACTION_STATUS_MISMATCH'::varchar,
    legacy.revision_id,
    legacy.participant_type,
    legacy.user_id,
    legacy.sequence_order,
    legacy.action_status,
    generic_participant.action_status
FROM revision_workflow_participants legacy
JOIN workflow_participants generic_participant
  ON generic_participant.object_type = 'DOCUMENT_REVISION'
 AND generic_participant.object_id = legacy.revision_id
 AND generic_participant.participant_type = legacy.participant_type
 AND generic_participant.user_id = legacy.user_id
 AND generic_participant.sequence_order = legacy.sequence_order
WHERE COALESCE(legacy.action_status, 'PENDING') <> COALESCE(generic_participant.action_status, 'PENDING');
