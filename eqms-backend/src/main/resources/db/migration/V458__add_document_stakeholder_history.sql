-- Permanent, never-deleted record of every user who was ever assigned as Author/Co-Author/
-- Reviewer/Approver on a Document Master. Backs the optional "Retain visibility for removed
-- participants" policy (Document Properties): documentWorkflowParticipantRepository rows are hard-
-- replaced whenever Author/Co-Author/Reviewer/Approver is reconfigured (e.g. via "Edit Revision for
-- Upgrade"), so a removed participant with no separate revision-level footprint would otherwise lose
-- DocumentAuthorizationService#isDirectStakeholder visibility of the Document entirely. This table
-- is always populated regardless of the policy toggle -- the toggle only controls whether
-- isDirectStakeholder consults it -- so enabling the policy later still protects any reassignment
-- that happens from that point on.
CREATE TABLE document_stakeholder_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id),
    user_id UUID NOT NULL REFERENCES app_users(id),
    participant_type VARCHAR(20) NOT NULL,
    first_assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_document_stakeholder_history UNIQUE (document_id, user_id, participant_type)
);

CREATE INDEX idx_document_stakeholder_history_document_user
    ON document_stakeholder_history (document_id, user_id);
