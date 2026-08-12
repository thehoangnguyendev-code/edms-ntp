ALTER TABLE roles
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE roles
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW();

ALTER TABLE roles
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW();

UPDATE roles
SET is_active = TRUE
WHERE is_active IS NULL;

CREATE TABLE IF NOT EXISTS document_workflow_settings (
    id UUID PRIMARY KEY,
    reviewer_no_approve BOOLEAN NOT NULL DEFAULT FALSE,
    require_two_reviewers BOOLEAN NOT NULL DEFAULT FALSE,
    require_one_approver BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS document_workflow_pool_members (
    id UUID PRIMARY KEY,
    pool_type VARCHAR(20) NOT NULL,
    user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_document_workflow_pool_member UNIQUE (pool_type, user_id)
);

CREATE INDEX IF NOT EXISTS idx_document_workflow_pool_members_type
    ON document_workflow_pool_members(pool_type);

CREATE INDEX IF NOT EXISTS idx_document_workflow_pool_members_user
    ON document_workflow_pool_members(user_id);
