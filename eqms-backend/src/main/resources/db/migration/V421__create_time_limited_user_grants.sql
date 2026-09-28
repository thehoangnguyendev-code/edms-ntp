-- "Time-Limited User" feature: restrict a user account's login-eligible period to a chosen
-- [start_date, end_date] window, optionally e-mailing the user when their window expires.
-- One row per user, even when created in bulk from a single "Create" submission (never merged).
CREATE TABLE time_limited_user_grants (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 UUID NOT NULL REFERENCES app_users(id),
    start_date              DATE NOT NULL,
    end_date                DATE NOT NULL,
    notify_email_on_expiry  BOOLEAN NOT NULL DEFAULT FALSE,
    notified_at             TIMESTAMPTZ NULL,
    reason                  VARCHAR(255) NULL,
    status                  VARCHAR(20) NOT NULL DEFAULT 'ACTIVE', -- ACTIVE | CANCELLED | EXPIRED
    signature_id            UUID NULL REFERENCES electronic_signatures(id),
    created_by              UUID NOT NULL REFERENCES app_users(id),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    cancelled_by            UUID NULL REFERENCES app_users(id),
    cancelled_at            TIMESTAMPTZ NULL,
    cancel_reason           VARCHAR(255) NULL,
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT time_limited_user_grants_date_range_chk CHECK (end_date >= start_date)
);

CREATE INDEX idx_time_limited_user_grants_user_id ON time_limited_user_grants(user_id);
CREATE INDEX idx_time_limited_user_grants_status ON time_limited_user_grants(status);

-- Marks which ACTIVE grant (if any) most recently put a user into Suspended via the nightly
-- scheduler, so the scheduler can safely reinstate that exact user again once the window opens
-- (or leave a manually-suspended user alone -- this column is only ever set by the scheduler).
ALTER TABLE app_users
    ADD COLUMN time_limited_grant_id UUID NULL REFERENCES time_limited_user_grants(id);
