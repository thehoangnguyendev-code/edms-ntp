-- The statuses of a training activity with the text the screens show. The code stays the machine value (lifecycle, permissions, API logic); the label is what a person reads, served by the
-- API as it is (no screen turns a code into text). Document Control reads it for the "Training Status" of a revision.
CREATE TABLE IF NOT EXISTS training_activity_statuses (
    code        VARCHAR(40)  PRIMARY KEY,
    label       VARCHAR(80)  NOT NULL,
    sort_order  INTEGER      NOT NULL
);
INSERT INTO training_activity_statuses(code, label, sort_order) VALUES
    ('RESERVED', 'Pending Document Approval', 1),
    ('PLANNED', 'Planned', 2),
    ('NOTIFIED', 'Notified', 3),
    ('IN_PROGRESS', 'In progress', 4),
    ('PENDING_QA_CONFIRMATION', 'Pending QA Confirmation', 5),
    ('COMPLETED', 'Completed', 6),
    ('CANCELLED', 'Closed - Cancelled', 7)
ON CONFLICT (code) DO NOTHING;
