CREATE TABLE IF NOT EXISTS user_languages (
    id UUID PRIMARY KEY,
    code VARCHAR(40) NOT NULL UNIQUE,
    name VARCHAR(120) NOT NULL UNIQUE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

INSERT INTO user_languages (id, code, name, sort_order, is_active, created_at, updated_at) VALUES
    ('91111111-1111-1111-1111-111111111101', 'EN', 'English', 1, TRUE, NOW(), NOW()),
    ('91111111-1111-1111-1111-111111111102', 'VI', 'Vietnamese', 2, TRUE, NOW(), NOW()),
    ('91111111-1111-1111-1111-111111111103', 'JA', 'Japanese', 3, TRUE, NOW(), NOW()),
    ('91111111-1111-1111-1111-111111111104', 'ZH', 'Chinese', 4, TRUE, NOW(), NOW())
ON CONFLICT (code) DO NOTHING;
