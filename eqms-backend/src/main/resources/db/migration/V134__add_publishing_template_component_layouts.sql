CREATE TABLE IF NOT EXISTS publishing_template_components (
    id UUID PRIMARY KEY,
    template_id UUID NOT NULL REFERENCES publishing_templates(id) ON DELETE CASCADE,
    component_type VARCHAR(20) NOT NULL,
    layout VARCHAR(20) NOT NULL,
    object_key VARCHAR(1024),
    file_name VARCHAR(255),
    checksum VARCHAR(128),
    detected_placeholders TEXT,
    version_number INT NOT NULL DEFAULT 1,
    status VARCHAR(30) NOT NULL,
    uploaded_at TIMESTAMP WITH TIME ZONE,
    uploaded_by_user_id UUID REFERENCES app_users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_publishing_template_components_template_component_layout
    ON publishing_template_components(template_id, component_type, layout);

CREATE INDEX IF NOT EXISTS idx_publishing_template_components_template_id
    ON publishing_template_components(template_id);

ALTER TABLE revision_publishing_metadata
    ADD COLUMN IF NOT EXISTS selected_publishing_layout VARCHAR(20);

UPDATE revision_publishing_metadata
SET selected_publishing_layout = COALESCE(selected_publishing_layout, 'PORTRAIT');

INSERT INTO publishing_template_components (
    id,
    template_id,
    component_type,
    layout,
    object_key,
    file_name,
    checksum,
    detected_placeholders,
    version_number,
    status,
    uploaded_at,
    uploaded_by_user_id,
    created_at,
    updated_at
)
SELECT
    gen_random_uuid(),
    pt.id,
    'cover',
    'PORTRAIT',
    pt.cover_template_path,
    pt.cover_file_name,
    NULL,
    '[]',
    1,
    COALESCE(pt.status, 'DRAFT'),
    pt.updated_at,
    NULL,
    COALESCE(pt.created_at, NOW()),
    COALESCE(pt.updated_at, NOW())
FROM publishing_templates pt
WHERE pt.cover_template_path IS NOT NULL
  AND NOT EXISTS (
      SELECT 1
      FROM publishing_template_components c
      WHERE c.template_id = pt.id
        AND c.component_type = 'cover'
        AND c.layout = 'PORTRAIT'
  );

INSERT INTO publishing_template_components (
    id,
    template_id,
    component_type,
    layout,
    object_key,
    file_name,
    checksum,
    detected_placeholders,
    version_number,
    status,
    uploaded_at,
    uploaded_by_user_id,
    created_at,
    updated_at
)
SELECT
    gen_random_uuid(),
    pt.id,
    'header',
    'PORTRAIT',
    pt.header_template_path,
    pt.header_file_name,
    NULL,
    '[]',
    1,
    COALESCE(pt.status, 'DRAFT'),
    pt.updated_at,
    NULL,
    COALESCE(pt.created_at, NOW()),
    COALESCE(pt.updated_at, NOW())
FROM publishing_templates pt
WHERE pt.header_template_path IS NOT NULL
  AND NOT EXISTS (
      SELECT 1
      FROM publishing_template_components c
      WHERE c.template_id = pt.id
        AND c.component_type = 'header'
        AND c.layout = 'PORTRAIT'
  );

INSERT INTO publishing_template_components (
    id,
    template_id,
    component_type,
    layout,
    object_key,
    file_name,
    checksum,
    detected_placeholders,
    version_number,
    status,
    uploaded_at,
    uploaded_by_user_id,
    created_at,
    updated_at
)
SELECT
    gen_random_uuid(),
    pt.id,
    'footer',
    'PORTRAIT',
    pt.footer_template_path,
    pt.footer_file_name,
    NULL,
    '[]',
    1,
    COALESCE(pt.status, 'DRAFT'),
    pt.updated_at,
    NULL,
    COALESCE(pt.created_at, NOW()),
    COALESCE(pt.updated_at, NOW())
FROM publishing_templates pt
WHERE pt.footer_template_path IS NOT NULL
  AND NOT EXISTS (
      SELECT 1
      FROM publishing_template_components c
      WHERE c.template_id = pt.id
        AND c.component_type = 'footer'
        AND c.layout = 'PORTRAIT'
  );
