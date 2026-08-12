-- Microsoft Entra lifecycle actions must be safe by default. Existing rows cannot prove
-- whether EQMS created the remote account, so they are intentionally backfilled as UNKNOWN.
ALTER TABLE external_identity_provisioning
    ADD COLUMN IF NOT EXISTS lifecycle_ownership VARCHAR(40) NOT NULL DEFAULT 'UNKNOWN',
    ADD COLUMN IF NOT EXISTS directory_user_type VARCHAR(20),
    ADD COLUMN IF NOT EXISTS pending_operation VARCHAR(40),
    ADD COLUMN IF NOT EXISTS pending_reason VARCHAR(1000),
    ADD COLUMN IF NOT EXISTS operation_requested_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMPTZ;

ALTER TABLE external_identity_provisioning
    DROP CONSTRAINT IF EXISTS ck_external_identity_provisioning_status;
ALTER TABLE external_identity_provisioning
    ADD CONSTRAINT ck_external_identity_provisioning_status CHECK (status IN (
        'NOT_INVITED', 'NOT_LINKED', 'INVITE_PENDING', 'INVITED', 'REDEEMED',
        'LINKED', 'FAILED', 'DISABLE_PENDING', 'DISABLED', 'REMOVE_PENDING', 'REMOVED'
    ));

CREATE UNIQUE INDEX IF NOT EXISTS uk_external_identity_provider_object
    ON external_identity_provisioning(provider, object_id)
    WHERE object_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_external_identity_pending_operation
    ON external_identity_provisioning(pending_operation, next_attempt_at)
    WHERE pending_operation IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_external_identity_status_graph_check
    ON external_identity_provisioning(status, last_graph_checked_at);
