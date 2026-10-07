-- Independent write journal: survives rollback; no FK locks on the active session.
CREATE TABLE eform_design_engine_writes (
    id uuid PRIMARY KEY,
    source_session_id uuid NOT NULL,
    replacement_session_id uuid NOT NULL,
    revision_id uuid NOT NULL,
    actor_id uuid NOT NULL,
    source_checksum varchar(128) NOT NULL,
    status varchar(20) NOT NULL CHECK (status IN ('PENDING','WRITTEN','COMMITTED','FAILED')),
    storage_object_key text,
    storage_version_id varchar(255),
    checksum varchar(128),
    fields jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_eform_design_engine_reconcile ON eform_design_engine_writes(status,created_at);
