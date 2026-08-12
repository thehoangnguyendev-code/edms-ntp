ALTER TABLE controlled_copy_policy_settings
    ADD COLUMN max_expiry_duration_days INTEGER;

CREATE TABLE controlled_copy_expiry_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_type_id UUID NULL REFERENCES document_types(id),
    department_id UUID NULL REFERENCES departments(id),
    max_duration_days INTEGER NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    is_system BOOLEAN NOT NULL DEFAULT FALSE,
    description VARCHAR(255),
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by UUID,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cc_expiry_limits_doctype ON controlled_copy_expiry_limits(document_type_id);
CREATE INDEX idx_cc_expiry_limits_dept ON controlled_copy_expiry_limits(department_id);
