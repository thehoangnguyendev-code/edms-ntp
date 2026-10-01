-- Personal calendar only. EQMS milestones and notifications remain in their source tables.
CREATE TABLE calendar_events (
    id UUID PRIMARY KEY,
    owner_user_id UUID NOT NULL REFERENCES app_users(id),
    title VARCHAR(200) NOT NULL,
    description VARCHAR(4000),
    starts_at TIMESTAMP NOT NULL,
    ends_at TIMESTAMP NOT NULL,
    all_day BOOLEAN NOT NULL DEFAULT TRUE,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    deleted_at TIMESTAMPTZ,
    CONSTRAINT calendar_event_time_order CHECK (ends_at > starts_at)
);
CREATE INDEX idx_calendar_events_owner_start ON calendar_events(owner_user_id, starts_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_calendar_events_owner_end ON calendar_events(owner_user_id, ends_at) WHERE deleted_at IS NULL;
