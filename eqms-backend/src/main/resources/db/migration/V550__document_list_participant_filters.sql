-- V550: Document list columns Reviewers, Approvers (owner request 2026-10-07).
-- The list filters by "this user is a REVIEWER / APPROVER of the document" and sorts by the first reviewer / approver name, both
-- through document_workflow_participants. V168 indexes (document_id, user_id); these serve the two new lookups.
CREATE INDEX IF NOT EXISTS idx_document_workflow_participants_user_type_document
    ON document_workflow_participants (user_id, participant_type, document_id);
CREATE INDEX IF NOT EXISTS idx_document_workflow_participants_document_type_order
    ON document_workflow_participants (document_id, participant_type, sequence_order);
