-- Preserve evidence for objects written before a worker fails. Never automatically purge these.
CREATE TABLE report_artifact_publication_journal (
 artifact_id UUID PRIMARY KEY, run_id UUID NOT NULL REFERENCES report_runs(id) ON DELETE RESTRICT,
 attempt_number INTEGER NOT NULL, object_key TEXT NOT NULL, sha256 VARCHAR(64) NOT NULL,
 status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','PUBLISHED')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), published_at TIMESTAMPTZ
);
CREATE INDEX report_publication_pending_idx ON report_artifact_publication_journal(status,created_at);
