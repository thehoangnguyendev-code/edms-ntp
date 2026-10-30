CREATE TABLE administrative_network_policy (
    id boolean PRIMARY KEY DEFAULT true CHECK (id),
    enabled boolean NOT NULL DEFAULT false,
    allowed_networks jsonb NOT NULL DEFAULT '[]'::jsonb,
    trusted_proxies jsonb NOT NULL DEFAULT '[]'::jsonb,
    emergency_user_id uuid REFERENCES app_users(id),
    updated_by uuid REFERENCES app_users(id),
    updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO administrative_network_policy(id) VALUES (true);
