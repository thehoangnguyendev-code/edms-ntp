ALTER TABLE external_identity_provisioning
    ADD COLUMN IF NOT EXISTS last_graph_checked_at TIMESTAMPTZ;
