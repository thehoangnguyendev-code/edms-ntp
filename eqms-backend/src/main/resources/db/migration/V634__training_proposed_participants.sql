-- The people the author of a document proposes for its training, chosen while the document is prepared (before any session exists).
-- They are only a proposal: when the first session of the activity is added, they are put on its list as a draft; the person who organizes the
-- training still confirms the list with an electronic signature (SOP.0003 5.3.4), and may remove or add people before that.
CREATE TABLE IF NOT EXISTS training_proposed_participants (
    id             UUID PRIMARY KEY,
    activity_id    UUID NOT NULL REFERENCES training_activities(id) ON DELETE CASCADE,
    person_user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
    proposed_by    UUID REFERENCES app_users(id) ON DELETE SET NULL,
    proposed_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    applied_at     TIMESTAMPTZ,
    CONSTRAINT ux_training_proposed_participant UNIQUE (activity_id, person_user_id)
);
CREATE INDEX IF NOT EXISTS ix_training_proposed_participants_activity ON training_proposed_participants (activity_id);
