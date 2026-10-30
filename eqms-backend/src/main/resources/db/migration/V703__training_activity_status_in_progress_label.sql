-- The label of the status IN_PROGRESS of a training activity is written "In Progress" (owner request 2026-10-29, the capital letters of the other statuses). The code is unchanged; only the text
-- the API serves changes. Forward-only and idempotent.
UPDATE training_activity_statuses SET label = 'In Progress' WHERE code = 'IN_PROGRESS' AND label <> 'In Progress';
