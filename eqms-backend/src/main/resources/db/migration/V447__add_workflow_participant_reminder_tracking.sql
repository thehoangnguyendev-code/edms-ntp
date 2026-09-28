-- Tracks reminder/escalation sent for a pending Review/Approval assignment so the daily job
-- never repeats itself for the same waiting period. Reset whenever the assignment is reset.
ALTER TABLE revision_workflow_participants
    ADD COLUMN IF NOT EXISTS last_reminded_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS escalated_at TIMESTAMPTZ;
