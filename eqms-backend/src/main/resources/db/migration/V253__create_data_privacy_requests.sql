CREATE TABLE data_privacy_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_number VARCHAR(40) NOT NULL UNIQUE,
    requester_user_id UUID NOT NULL REFERENCES app_users(id),
    request_type VARCHAR(40) NOT NULL,
    details TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'SUBMITTED',
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_data_privacy_requests_requester_submitted
    ON data_privacy_requests(requester_user_id, submitted_at DESC);
