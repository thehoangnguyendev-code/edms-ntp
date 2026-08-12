CREATE TABLE authorization_shadow_evaluation_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resource_type VARCHAR(80) NOT NULL,
    resource_id UUID NOT NULL,
    action_code VARCHAR(100) NOT NULL,
    subject_user_id UUID NOT NULL REFERENCES app_users(id),
    policy_allowed BOOLEAN NOT NULL,
    policy_reason_code VARCHAR(100),
    legacy_allowed BOOLEAN NOT NULL,
    legacy_reason_code VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_auth_shadow_events_created ON authorization_shadow_evaluation_events (created_at DESC);
CREATE INDEX idx_auth_shadow_events_action ON authorization_shadow_evaluation_events (resource_type, action_code, created_at DESC);

