-- The rule identifies a workflow coordinator by the stable
-- documents.workspace.manage permission, not an Access Profile display name.
-- Rename the legacy column so the persisted model and API use that language.
ALTER TABLE document_workflow_settings
    RENAME COLUMN dco_cannot_be_reviewer_or_approver
    TO workflow_coordinator_cannot_be_reviewer_or_approver;

-- Prevent two administrators from silently overwriting each other's rule set.
ALTER TABLE document_workflow_settings
    ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 0;
