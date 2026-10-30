-- Object-version measurements, not physical disk consumption.
CREATE TABLE storage_usage_snapshot (
    id bigserial PRIMARY KEY,
    measured_at timestamptz NOT NULL DEFAULT now(),
    total_bytes bigint NOT NULL CHECK (total_bytes >= 0),
    object_versions bigint NOT NULL CHECK (object_versions >= 0),
    by_domain jsonb NOT NULL,
    by_file_type jsonb NOT NULL
);
CREATE INDEX storage_usage_snapshot_time_idx ON storage_usage_snapshot (measured_at DESC);

-- This is an administrator-supplied budget, not a claim about physical disk capacity.
CREATE TABLE storage_usage_policy (
    id boolean PRIMARY KEY DEFAULT true CHECK (id),
    budget_bytes bigint CHECK (budget_bytes > 0),
    warning_percent integer NOT NULL DEFAULT 80 CHECK (warning_percent BETWEEN 1 AND 100)
);
INSERT INTO storage_usage_policy(id) VALUES (true);

CREATE TABLE storage_usage_scan_state (
    id boolean PRIMARY KEY DEFAULT true CHECK (id),
    last_attempt_at timestamptz,
    last_success_at timestamptz,
    last_result varchar(16) CHECK (last_result IN ('SUCCESS', 'FAILED'))
);
INSERT INTO storage_usage_scan_state(id) VALUES (true);

