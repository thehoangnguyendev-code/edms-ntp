CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE prompt_specifications (
    id UUID PRIMARY KEY,
    module_name VARCHAR(120) NOT NULL,
    prompt_title VARCHAR(200) NOT NULL,
    prompt_text TEXT NOT NULL,
    spec_payload JSONB NOT NULL,
    status VARCHAR(32) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_prompt_specifications_module_name
    ON prompt_specifications (module_name);

CREATE INDEX idx_prompt_specifications_status
    ON prompt_specifications (status);

CREATE TABLE prompt_generation_runs (
    id UUID PRIMARY KEY,
    prompt_specification_id UUID NOT NULL,
    target_frontend_path VARCHAR(255),
    target_backend_path VARCHAR(255),
    target_database_path VARCHAR(255),
    status VARCHAR(32) NOT NULL,
    generated_at TIMESTAMPTZ NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT fk_prompt_generation_runs_specification
        FOREIGN KEY (prompt_specification_id)
        REFERENCES prompt_specifications (id)
        ON DELETE CASCADE
);

CREATE INDEX idx_prompt_generation_runs_specification_id
    ON prompt_generation_runs (prompt_specification_id);

CREATE TABLE prompt_generated_artifacts (
    id UUID PRIMARY KEY,
    generation_run_id UUID NOT NULL,
    artifact_type VARCHAR(32) NOT NULL,
    file_path VARCHAR(255) NOT NULL,
    content_hash VARCHAR(128),
    created_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT fk_prompt_generated_artifacts_run
        FOREIGN KEY (generation_run_id)
        REFERENCES prompt_generation_runs (id)
        ON DELETE CASCADE
);

CREATE INDEX idx_prompt_generated_artifacts_generation_run_id
    ON prompt_generated_artifacts (generation_run_id);
