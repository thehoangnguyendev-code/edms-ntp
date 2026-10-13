-- Object version aliases (SDS-BR-001 section 11.4.2, WP3.1 slice 4). After a restore, an object can come back under a new MinIO
-- version id. The original version id stays in every record; this table maps it to the current one. Rows are written only by the
-- restore (step R8) into the restored database, before it replaces production. Production reads them only when MinIO reports that
-- the original version does not exist, and the SHA-256 is checked before any byte is returned.
CREATE TABLE object_version_alias (
    id                   BIGSERIAL PRIMARY KEY,
    bucket               VARCHAR(255) NOT NULL,
    object_key           VARCHAR(1024) NOT NULL,
    original_version_id  VARCHAR(255) NOT NULL,
    current_version_id   VARCHAR(255) NOT NULL,
    sha256               VARCHAR(64)  NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
    restore_request_id   VARCHAR(60),
    created_at           TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT object_version_alias_original_uk UNIQUE (bucket, object_key, original_version_id)
);
