-- Knowledge Categories Hierarchies: the Determinator field decides which Knowledge Base a document
-- belongs to; the ordered Levels are the document fields that build the tree inside it.
CREATE TABLE knowledge_category_hierarchies (
    id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    name                VARCHAR(200) NOT NULL,
    description         TEXT,
    determinator_field  VARCHAR(40)  NOT NULL,
    active              BOOLEAN      NOT NULL DEFAULT TRUE,
    is_default          BOOLEAN      NOT NULL DEFAULT FALSE,
    lock_version        BIGINT       NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
    created_by          UUID         REFERENCES app_users(id) ON DELETE SET NULL,
    updated_by          UUID         REFERENCES app_users(id) ON DELETE SET NULL,
    CONSTRAINT chk_kch_default_active CHECK (NOT is_default OR active)
);
CREATE UNIQUE INDEX uq_kch_name ON knowledge_category_hierarchies (lower(name));
-- At most one default hierarchy drives the Knowledge portal and the Knowledge Base field of a new document.
CREATE UNIQUE INDEX uq_kch_single_default ON knowledge_category_hierarchies (is_default) WHERE is_default;

CREATE TABLE knowledge_category_levels (
    id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    hierarchy_id   UUID        NOT NULL REFERENCES knowledge_category_hierarchies(id) ON DELETE CASCADE,
    field_code     VARCHAR(40) NOT NULL,
    display_order  INTEGER     NOT NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_kcl_field UNIQUE (hierarchy_id, field_code),
    CONSTRAINT uq_kcl_order UNIQUE (hierarchy_id, display_order),
    CONSTRAINT chk_kcl_order CHECK (display_order > 0)
);

-- Phase 3: portal engagement.
CREATE TABLE knowledge_document_views (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id  UUID        NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    user_id      UUID        NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    viewed_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_kdv_document ON knowledge_document_views (document_id, viewed_at);

CREATE TABLE knowledge_document_feedback (
    document_id  UUID        NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    user_id      UUID        NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    helpful      BOOLEAN     NOT NULL,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (document_id, user_id)
);

CREATE TABLE knowledge_featured_documents (
    document_id  UUID        PRIMARY KEY REFERENCES documents(id) ON DELETE CASCADE,
    featured_by  UUID        REFERENCES app_users(id) ON DELETE SET NULL,
    featured_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE knowledge_subscriptions (
    id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID         NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    field_code   VARCHAR(40)  NOT NULL,
    value_key    VARCHAR(255) NOT NULL,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT uq_ks UNIQUE (user_id, field_code, value_key)
);

-- Default hierarchy: every Business Unit is a Knowledge Base, then Department, then Document Type.
INSERT INTO knowledge_category_hierarchies (id, name, description, determinator_field, active, is_default)
VALUES ('00000000-0000-0000-0000-00000000c001', 'Business Unit Hierarchy',
        'Each Business Unit is a Knowledge Base. The levels below are the document fields that build its category tree.',
        'BUSINESS_UNIT', TRUE, TRUE);
INSERT INTO knowledge_category_levels (hierarchy_id, field_code, display_order) VALUES
    ('00000000-0000-0000-0000-00000000c001', 'DEPARTMENT', 10),
    ('00000000-0000-0000-0000-00000000c001', 'DOCUMENT_TYPE', 20);
