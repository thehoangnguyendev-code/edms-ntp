-- Backup alerts and their recipients (SDS 15.1). A recipient is an eQMS account (by username; the backend checks that it exists and is
-- active). Acknowledging an alert records who saw it and when; alerts are never deleted.
CREATE TABLE backup_alert_recipient (
    username      VARCHAR(120) PRIMARY KEY,
    active        BOOLEAN      NOT NULL DEFAULT TRUE,
    added_by      VARCHAR(120) NOT NULL,
    added_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    removed_by    VARCHAR(120),
    removed_at    TIMESTAMPTZ
);
CREATE INDEX backup_alert_ack_idx ON backup_alert (acknowledged_at);
