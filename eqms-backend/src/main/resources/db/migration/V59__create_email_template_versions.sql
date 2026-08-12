CREATE TABLE IF NOT EXISTS email_template_versions (
    id UUID PRIMARY KEY,
    template_id UUID NOT NULL REFERENCES email_templates(id) ON DELETE CASCADE,
    version_number INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(50) NOT NULL,
    subject VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    status VARCHAR(20) NOT NULL,
    description VARCHAR(500),
    logo_url TEXT,
    logo_file_name VARCHAR(255),
    copyright TEXT,
    contact_email VARCHAR(255),
    variables TEXT,
    change_summary VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_by VARCHAR(100),
    published_at TIMESTAMP WITH TIME ZONE,
    published_by VARCHAR(100)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_email_template_versions_template_version
    ON email_template_versions (template_id, version_number);

