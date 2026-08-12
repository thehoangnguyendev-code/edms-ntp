-- V173: Generic workflow participants table — Phase -1 of
-- docs/SECURITY_AUTHORIZATION_IMPLEMENTATION_PLAN.md ("Generic hoá Participant + Object Access").
--
-- Only ADDs a new table and copies data into it — nothing is dropped or modified.
-- `revision_workflow_participants` keeps running exactly as before; this table is only read
-- once app.security.generic-workflow-participants-enabled=true (default false). Rollback before
-- go-live is simply `DROP TABLE workflow_participants` if needed.

CREATE TABLE workflow_participants (
    id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    object_type      VARCHAR(80)  NOT NULL,
    object_id        UUID         NOT NULL,
    participant_type VARCHAR(40)  NOT NULL,
    user_id          UUID         NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    action_status    VARCHAR(30),
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_wp_object ON workflow_participants (object_type, object_id);
CREATE INDEX idx_wp_user   ON workflow_participants (user_id);

-- ── Data migration: copy all existing revision_workflow_participants rows ──
-- object_type is always 'DOCUMENT_REVISION' and object_id = revision_id for this copy.
-- New primary keys are generated (workflow_participants.id is independent of
-- revision_workflow_participants.id) — both tables coexist and are not linked by id.
INSERT INTO workflow_participants (object_type, object_id, participant_type, user_id, action_status, created_at, updated_at)
SELECT 'DOCUMENT_REVISION', rwp.revision_id, rwp.participant_type, rwp.user_id, rwp.action_status, rwp.created_at, rwp.updated_at
FROM revision_workflow_participants rwp;
