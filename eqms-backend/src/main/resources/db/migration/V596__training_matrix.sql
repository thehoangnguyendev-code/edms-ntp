-- Training Management, the training matrix (SDS-TR-001 section 4.1, 4.2 and 3.4): standard topics, one matrix for each department, versions that are prepared, approved by the
-- person designated, and then never changed. Forward-only and idempotent.

CREATE TABLE IF NOT EXISTS training_topics (
    id            UUID PRIMARY KEY,
    code          VARCHAR(40)  NOT NULL UNIQUE,
    name          VARCHAR(255) NOT NULL,
    scope         VARCHAR(24)  NOT NULL CHECK (scope IN ('FACTORY_GENERAL','DEPARTMENT_GENERAL','OTHER')),
    department_id UUID REFERENCES departments(id) ON DELETE RESTRICT,
    active        BOOLEAN NOT NULL DEFAULT TRUE,
    version       INTEGER NOT NULL DEFAULT 1,
    created_by    UUID REFERENCES app_users(id),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS training_matrices (
    id                 UUID PRIMARY KEY,
    department_id      UUID NOT NULL UNIQUE REFERENCES departments(id) ON DELETE RESTRICT,
    code               VARCHAR(60) NOT NULL UNIQUE,
    current_version_id UUID,
    created_by         UUID REFERENCES app_users(id),
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS training_matrix_versions (
    id                   UUID PRIMARY KEY,
    matrix_id            UUID NOT NULL REFERENCES training_matrices(id) ON DELETE RESTRICT,
    version_no           INTEGER NOT NULL,
    status               VARCHAR(20) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','PENDING_APPROVAL','EFFECTIVE','OBSOLETE')),
    change_reason        TEXT,
    reject_reason        TEXT,
    prepared_by          UUID REFERENCES app_users(id),
    submitted_at         TIMESTAMPTZ,
    approved_by          UUID REFERENCES app_users(id),
    approved_at          TIMESTAMPTZ,
    effective_at         TIMESTAMPTZ,
    prepare_signature_id UUID,
    approve_signature_id UUID,
    content_sha256       VARCHAR(64),
    version              INTEGER NOT NULL DEFAULT 1,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (matrix_id, version_no)
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_training_matrix_effective ON training_matrix_versions (matrix_id) WHERE status = 'EFFECTIVE';
CREATE UNIQUE INDEX IF NOT EXISTS ux_training_matrix_open_draft ON training_matrix_versions (matrix_id) WHERE status IN ('DRAFT','PENDING_APPROVAL');

CREATE TABLE IF NOT EXISTS training_matrix_rows (
    id              UUID PRIMARY KEY,
    version_id      UUID NOT NULL REFERENCES training_matrix_versions(id) ON DELETE RESTRICT,
    row_no          INTEGER NOT NULL,
    row_group       VARCHAR(24) NOT NULL CHECK (row_group IN ('FACTORY_GENERAL','DEPARTMENT_GENERAL','SOP')),
    topic_id        UUID REFERENCES training_topics(id),
    document_id     UUID REFERENCES documents(id),
    annual_required BOOLEAN NOT NULL DEFAULT FALSE,
    note            VARCHAR(500),
    UNIQUE (version_id, row_no),
    CHECK ((topic_id IS NULL) <> (document_id IS NULL))
);

CREATE TABLE IF NOT EXISTS training_matrix_cells (
    row_id      UUID NOT NULL REFERENCES training_matrix_rows(id) ON DELETE RESTRICT,
    position_id UUID NOT NULL REFERENCES positions(id) ON DELETE RESTRICT,
    PRIMARY KEY (row_id, position_id)
);

-- A version that is effective or obsolete, and its rows and cells, cannot be changed or deleted. The only change allowed on a version is the
-- passage from EFFECTIVE to OBSOLETE (when the next version is approved) and from DRAFT or PENDING_APPROVAL onwards.
CREATE OR REPLACE FUNCTION training_matrix_version_guard() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        IF OLD.status IN ('EFFECTIVE','OBSOLETE') THEN RAISE EXCEPTION 'A matrix version that was approved cannot be deleted' USING ERRCODE = '0LPTR'; END IF;
        RETURN OLD;
    END IF;
    IF OLD.status = 'OBSOLETE' THEN RAISE EXCEPTION 'An obsolete matrix version cannot be changed' USING ERRCODE = '0LPTR'; END IF;
    IF OLD.status = 'EFFECTIVE' AND NEW.status <> 'OBSOLETE' THEN RAISE EXCEPTION 'An effective matrix version cannot be changed' USING ERRCODE = '0LPTR'; END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_training_matrix_version_guard ON training_matrix_versions;
CREATE TRIGGER trg_training_matrix_version_guard BEFORE UPDATE OR DELETE ON training_matrix_versions FOR EACH ROW EXECUTE FUNCTION training_matrix_version_guard();

CREATE OR REPLACE FUNCTION training_matrix_content_guard() RETURNS trigger AS $$
DECLARE v UUID; s VARCHAR(20);
BEGIN
    IF TG_TABLE_NAME = 'training_matrix_rows' THEN
        v := COALESCE(OLD.version_id, NEW.version_id);
    ELSE
        SELECT r.version_id INTO v FROM training_matrix_rows r WHERE r.id = COALESCE(OLD.row_id, NEW.row_id);
    END IF;
    SELECT status INTO s FROM training_matrix_versions WHERE id = v;
    IF s IN ('EFFECTIVE','OBSOLETE','PENDING_APPROVAL') THEN RAISE EXCEPTION 'The content of an approved or submitted matrix version cannot be changed' USING ERRCODE = '0LPTR'; END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_training_matrix_rows_guard ON training_matrix_rows;
CREATE TRIGGER trg_training_matrix_rows_guard BEFORE UPDATE OR DELETE ON training_matrix_rows FOR EACH ROW EXECUTE FUNCTION training_matrix_content_guard();
DROP TRIGGER IF EXISTS trg_training_matrix_cells_guard ON training_matrix_cells;
CREATE TRIGGER trg_training_matrix_cells_guard BEFORE UPDATE OR DELETE ON training_matrix_cells FOR EACH ROW EXECUTE FUNCTION training_matrix_content_guard();
