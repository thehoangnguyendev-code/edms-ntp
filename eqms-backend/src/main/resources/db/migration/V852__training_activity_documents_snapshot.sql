-- DEC-TRAINING-2026-11-25-6: the documents a related-document training was read with, frozen on the day (owner decision 2026-11-25).
-- One row for each related document and the revision of it that the trainees read, written when the training starts (phase START) and completed when QA confirms it with the revisions that were approved in between (phase COMPLETION).
-- The training records of the people and the "covered by" evidence of the related revisions are written from these rows. Forward-only and idempotent.
CREATE TABLE IF NOT EXISTS training_activity_documents (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    activity_id     UUID NOT NULL REFERENCES training_activities(id) ON DELETE CASCADE,
    document_id     UUID NOT NULL,
    revision_id     UUID NULL,
    document_number TEXT NOT NULL,
    document_name   TEXT NULL,
    revision_number TEXT NULL,
    frozen_phase    VARCHAR(12) NOT NULL CHECK (frozen_phase IN ('START', 'COMPLETION')),
    frozen_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_training_activity_documents UNIQUE (activity_id, document_id)
);
CREATE INDEX IF NOT EXISTS ix_training_activity_documents_activity ON training_activity_documents (activity_id);
