-- Continuation of Legacy Import groundwork (Phase 1, additive-only, see V453). "Historical
-- Reviewer(s)"/"Historical Approver" are a record of who reviewed/approved the paper original --
-- plain reference text, never a RevisionWorkflowParticipant row and never an electronic
-- signature -- so they can never be mistaken for an EQMS-executed electronic review/approval.
-- The only real electronic signature in the Legacy Import flow is LEGACY_DOCUMENT_IMPORT (V453),
-- signed by the person who performed the import.
ALTER TABLE document_revisions
    ADD COLUMN legacy_historical_reviewers TEXT,
    ADD COLUMN legacy_historical_approver TEXT;
