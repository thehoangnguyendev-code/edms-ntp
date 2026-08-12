CREATE TABLE IF NOT EXISTS publishing_template_placeholder_styles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES publishing_templates(id) ON DELETE CASCADE,
    template_version_id UUID NULL REFERENCES publishing_template_versions(id) ON DELETE SET NULL,
    template_version_number INTEGER NOT NULL,
    component_type VARCHAR(20) NOT NULL,
    layout VARCHAR(20) NOT NULL,
    placeholder_key VARCHAR(160) NOT NULL,
    placeholder_token VARCHAR(255) NOT NULL,
    placeholder_type VARCHAR(40) NOT NULL,
    style_json TEXT NOT NULL,
    created_by VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by VARCHAR(100),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uk_publishing_template_placeholder_style UNIQUE (
        template_id,
        template_version_number,
        component_type,
        layout,
        placeholder_key
    )
);

CREATE INDEX IF NOT EXISTS idx_publishing_placeholder_styles_template_version
    ON publishing_template_placeholder_styles(template_id, template_version_number);

CREATE INDEX IF NOT EXISTS idx_publishing_placeholder_styles_slot
    ON publishing_template_placeholder_styles(template_id, component_type, layout);
