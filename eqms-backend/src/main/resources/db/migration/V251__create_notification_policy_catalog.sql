-- Notification Policy redesign (event catalog -> policy -> content/template -> preview).
-- Replaces the ad-hoc "email template is the source of notification content" model with a
-- structured catalog: notification_event_definitions (what can happen), notification_policies
-- (who gets told, how, when), notification_template_versions (the actual wording per channel,
-- versioned). Field-level change history reuses the existing Audit Trail (entity type
-- "NOTIFICATION_POLICY") rather than a bespoke audit table.

CREATE TABLE notification_event_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(120) NOT NULL UNIQUE,
    name VARCHAR(200) NOT NULL,
    description VARCHAR(500),
    module VARCHAR(60) NOT NULL,
    priority VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
    compliance_group VARCHAR(30) NOT NULL DEFAULT 'OPTIONAL',
    related_action VARCHAR(120),
    data_object VARCHAR(120),
    supported_channels VARCHAR(120) NOT NULL DEFAULT 'IN_APP',
    available_variables VARCHAR(1000),
    is_mandatory BOOLEAN NOT NULL DEFAULT FALSE,
    mandatory_reason VARCHAR(500),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notification_event_definitions_module ON notification_event_definitions(module);

CREATE TABLE notification_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_code VARCHAR(120) NOT NULL UNIQUE REFERENCES notification_event_definitions(code) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    enabled_channels VARCHAR(120) NOT NULL DEFAULT 'IN_APP',
    recipient_rules JSONB NOT NULL DEFAULT '[]',
    digest_mode VARCHAR(20) NOT NULL DEFAULT 'IMMEDIATE',
    quiet_hours_start VARCHAR(5),
    quiet_hours_end VARCHAR(5),
    escalation_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    escalation_after_minutes INTEGER,
    escalation_recipient_rules JSONB NOT NULL DEFAULT '[]',
    updated_by UUID REFERENCES app_users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE notification_template_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_id UUID NOT NULL REFERENCES notification_policies(id) ON DELETE CASCADE,
    channel VARCHAR(20) NOT NULL,
    version_number INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    title VARCHAR(255),
    summary VARCHAR(500),
    subject VARCHAR(255),
    body TEXT,
    action_url_template VARCHAR(255),
    variables_used VARCHAR(1000),
    change_summary VARCHAR(500),
    created_by UUID REFERENCES app_users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (policy_id, channel, version_number)
);

CREATE INDEX idx_notification_template_versions_policy_channel_status
    ON notification_template_versions(policy_id, channel, status);
