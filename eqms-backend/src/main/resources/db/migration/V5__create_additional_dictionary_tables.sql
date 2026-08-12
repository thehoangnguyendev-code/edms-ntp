CREATE TABLE IF NOT EXISTS document_types (
    id UUID PRIMARY KEY,
    short_code VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(120) NOT NULL UNIQUE,
    current_sequence INTEGER NOT NULL DEFAULT 0,
    description VARCHAR(512),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE TABLE IF NOT EXISTS storage_locations (
    id UUID PRIMARY KEY,
    name VARCHAR(120) NOT NULL UNIQUE,
    description VARCHAR(512),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE TABLE IF NOT EXISTS retention_policies (
    id UUID PRIMARY KEY,
    name VARCHAR(120) NOT NULL UNIQUE,
    description VARCHAR(512),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

INSERT INTO document_types (id, short_code, name, current_sequence, description, is_active, created_at, updated_at) VALUES
('11111111-1111-1111-1111-111111111101', 'SOP', 'Standard Operating Procedure', 125, 'Standard procedures for quality operations', TRUE, NOW(), NOW()),
('11111111-1111-1111-1111-111111111102', 'POL', 'Policy', 45, 'Company policies and guidelines', TRUE, NOW(), NOW()),
('11111111-1111-1111-1111-111111111103', 'FORM', 'Forms', 320, 'Standard forms and templates', TRUE, NOW(), NOW()),
('11111111-1111-1111-1111-111111111104', 'QM', 'Quality Manual', 8, 'Quality management system manual', TRUE, NOW(), NOW()),
('11111111-1111-1111-1111-111111111105', 'SPEC', 'Specification', 156, 'Product and material specifications', FALSE, NOW(), NOW())
ON CONFLICT (short_code) DO NOTHING;

INSERT INTO retention_policies (id, name, description, is_active, created_at, updated_at) VALUES
('11111111-1111-1111-1111-111111111201', '7 Years + Current', 'Retain for 7 years plus current year', TRUE, NOW(), NOW()),
('11111111-1111-1111-1111-111111111202', 'Permanent', 'Retain permanently', TRUE, NOW(), NOW()),
('11111111-1111-1111-1111-111111111203', '3 Years', 'Retain for 3 years', TRUE, NOW(), NOW()),
('11111111-1111-1111-1111-111111111204', '5 Years + Current', 'Retain for 5 years plus current year', TRUE, NOW(), NOW()),
('11111111-1111-1111-1111-111111111205', '1 Year', 'Retain for 1 year only', FALSE, NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

INSERT INTO storage_locations (id, name, description, is_active, created_at, updated_at) VALUES
('11111111-1111-1111-1111-111111111301', 'Quality Assurance Archive', 'QA document archive - Building A, Floor 3', TRUE, NOW(), NOW()),
('11111111-1111-1111-1111-111111111302', 'Digital Document Repository', 'SharePoint online storage', TRUE, NOW(), NOW()),
('11111111-1111-1111-1111-111111111303', 'Production Records Room', 'Manufacturing floor document storage', TRUE, NOW(), NOW()),
('11111111-1111-1111-1111-111111111304', 'Regulatory Affairs Archive', 'Regulatory documents - Building B, Floor 2', TRUE, NOW(), NOW()),
('11111111-1111-1111-1111-111111111305', 'Warehouse Storage', 'Physical document storage in warehouse', FALSE, NOW(), NOW())
ON CONFLICT (name) DO NOTHING;
