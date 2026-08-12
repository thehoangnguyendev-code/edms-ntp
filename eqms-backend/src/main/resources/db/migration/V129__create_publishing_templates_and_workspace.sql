CREATE TABLE IF NOT EXISTS publishing_templates (
    id UUID PRIMARY KEY,
    template_name VARCHAR(160) NOT NULL UNIQUE,
    document_type VARCHAR(120),
    version_number INT NOT NULL DEFAULT 1,
    status VARCHAR(30) NOT NULL,
    description TEXT,
    cover_template_path VARCHAR(1024),
    header_template_path VARCHAR(1024),
    footer_template_path VARCHAR(1024),
    cover_file_name VARCHAR(255),
    header_file_name VARCHAR(255),
    footer_file_name VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_by VARCHAR(100),
    updated_by VARCHAR(100),
    published_at TIMESTAMP WITH TIME ZONE,
    published_by VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS publishing_template_versions (
    id UUID PRIMARY KEY,
    template_id UUID NOT NULL REFERENCES publishing_templates(id) ON DELETE CASCADE,
    version_number INT NOT NULL,
    template_name VARCHAR(160) NOT NULL,
    document_type VARCHAR(120),
    status VARCHAR(30) NOT NULL,
    description TEXT,
    cover_template_path VARCHAR(1024),
    header_template_path VARCHAR(1024),
    footer_template_path VARCHAR(1024),
    change_summary VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_by VARCHAR(100),
    published_at TIMESTAMP WITH TIME ZONE,
    published_by VARCHAR(100)
);

CREATE INDEX IF NOT EXISTS idx_publishing_template_versions_template_id_version
    ON publishing_template_versions(template_id, version_number DESC);

CREATE TABLE IF NOT EXISTS revision_publishing_metadata (
    id UUID PRIMARY KEY,
    revision_id UUID NOT NULL UNIQUE REFERENCES document_revisions(id) ON DELETE CASCADE,
    publishing_template_id UUID REFERENCES publishing_templates(id) ON DELETE SET NULL,
    publishing_template_version INT,
    publishing_preview_pdf_path VARCHAR(1024),
    publishing_preview_checksum VARCHAR(128),
    publishing_preview_version_id VARCHAR(255),
    published_pdf_path VARCHAR(1024),
    published_pdf_checksum VARCHAR(128),
    published_pdf_version_id VARCHAR(255),
    conversion_engine VARCHAR(100),
    preview_generated_at TIMESTAMP WITH TIME ZONE,
    preview_generated_by_user_id UUID REFERENCES app_users(id) ON DELETE SET NULL,
    published_at TIMESTAMP WITH TIME ZONE,
    published_by_user_id UUID REFERENCES app_users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);
