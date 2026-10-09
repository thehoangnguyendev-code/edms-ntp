-- Object (document) backups, SDS-BR-001 sections 5 and 20.2.
-- One row per stored version of one object. A version is copied once; every later backup refers to it ("full view").
-- Rows are never changed or removed: a blob that was written is part of the evidence.
CREATE TABLE backup_object_blob (
    id            BIGSERIAL    PRIMARY KEY,
    bucket        VARCHAR(255) NOT NULL,
    object_key    TEXT         NOT NULL,
    version_id    VARCHAR(255) NOT NULL,
    plain_sha256  CHAR(64)     NOT NULL,
    plain_size    BIGINT       NOT NULL,
    cipher_sha256 CHAR(64)     NOT NULL,
    cipher_size   BIGINT       NOT NULL,
    -- relative to the environment folder of the target, for example objects/eqms-gmp-records/ab/<hash>.gpg
    blob_path     TEXT         NOT NULL,
    first_run_id  UUID         NOT NULL REFERENCES backup_run (id),
    stored_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    UNIQUE (bucket, object_key, version_id)
);
CREATE INDEX backup_object_blob_run_idx ON backup_object_blob (first_run_id);
CREATE TRIGGER backup_object_blob_append_only BEFORE UPDATE OR DELETE ON backup_object_blob
    FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
