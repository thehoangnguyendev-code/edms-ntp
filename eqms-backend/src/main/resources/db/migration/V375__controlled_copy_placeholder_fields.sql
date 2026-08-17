CREATE TABLE controlled_copy_placeholder_fields (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    field_key VARCHAR(60) NOT NULL UNIQUE,
    label VARCHAR(120) NOT NULL,
    description VARCHAR(255),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE controlled_copies
    ADD COLUMN custom_placeholder_values JSONB;
