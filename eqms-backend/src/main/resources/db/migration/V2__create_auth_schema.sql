CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE app_users (
    id UUID PRIMARY KEY,
    username VARCHAR(80) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    full_name VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role_name VARCHAR(40) NOT NULL,
    department VARCHAR(120),
    position VARCHAR(120),
    status VARCHAR(20) NOT NULL,
    phone VARCHAR(40),
    avatar VARCHAR(512),
    must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
    mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    failed_login_count INTEGER NOT NULL DEFAULT 0,
    locked_until TIMESTAMPTZ,
    password_changed_at TIMESTAMPTZ,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_app_users_username ON app_users (username);
CREATE INDEX idx_app_users_email ON app_users (email);

CREATE TABLE auth_sessions (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    refresh_token_hash VARCHAR(128) NOT NULL UNIQUE,
    device_name VARCHAR(255),
    ip_address VARCHAR(80),
    user_agent VARCHAR(512),
    current_session BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL,
    last_activity_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ
);

CREATE INDEX idx_auth_sessions_user_id ON auth_sessions (user_id);
CREATE INDEX idx_auth_sessions_expires_at ON auth_sessions (expires_at);

CREATE TABLE login_challenges (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    mfa_token_hash VARCHAR(128) NOT NULL UNIQUE,
    available_methods JSONB NOT NULL,
    masked_email VARCHAR(255),
    otp_hash VARCHAR(128),
    otp_expires_at TIMESTAMPTZ NOT NULL,
    attempt_count INTEGER NOT NULL DEFAULT 0,
    consumed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_login_challenges_user_id ON login_challenges (user_id);
CREATE INDEX idx_login_challenges_otp_expires_at ON login_challenges (otp_expires_at);

CREATE TABLE mfa_factors (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    method VARCHAR(20) NOT NULL,
    secret_encrypted VARCHAR(512),
    enabled BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT uq_mfa_factor_user_method UNIQUE (user_id, method)
);

CREATE INDEX idx_mfa_factors_user_id ON mfa_factors (user_id);

CREATE TABLE password_reset_tokens (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    token_hash VARCHAR(128) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_password_reset_tokens_user_id ON password_reset_tokens (user_id);
CREATE INDEX idx_password_reset_tokens_expires_at ON password_reset_tokens (expires_at);

CREATE TABLE auth_audit_logs (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES app_users(id) ON DELETE SET NULL,
    event_type VARCHAR(80) NOT NULL,
    entity_type VARCHAR(80),
    entity_id VARCHAR(120),
    details_json JSONB,
    ip_address VARCHAR(80),
    user_agent VARCHAR(512),
    created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_auth_audit_logs_user_id ON auth_audit_logs (user_id);
CREATE INDEX idx_auth_audit_logs_event_type ON auth_audit_logs (event_type);
