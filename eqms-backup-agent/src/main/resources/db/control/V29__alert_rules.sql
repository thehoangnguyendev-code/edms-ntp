-- Alert rules (SDS 15.1). Every alert is always recorded and shown; a rule only chooses who is told (in the application, by e-mail) and,
-- for the alerts that have one, the limit at which the alert is raised. The names and notes are data, so a screen never has to invent them.
CREATE TABLE backup_alert_rule (
    code            VARCHAR(80)  PRIMARY KEY,
    label           VARCHAR(160) NOT NULL,
    hint            TEXT         NOT NULL,
    notify_in_app   BOOLEAN      NOT NULL DEFAULT TRUE,
    notify_email    BOOLEAN      NOT NULL DEFAULT FALSE,
    threshold_value INTEGER,
    threshold_unit  VARCHAR(30),
    threshold_min   INTEGER,
    threshold_max   INTEGER,
    sort_order      INTEGER      NOT NULL,
    updated_by      VARCHAR(120),
    updated_at      TIMESTAMPTZ,
    CONSTRAINT backup_alert_rule_threshold_shape CHECK (
        (threshold_value IS NULL AND threshold_unit IS NULL AND threshold_min IS NULL AND threshold_max IS NULL)
        OR (threshold_value BETWEEN threshold_min AND threshold_max AND threshold_unit IS NOT NULL))
);

CREATE TABLE backup_alert_rule_history (
    id               BIGSERIAL PRIMARY KEY,
    code             VARCHAR(80)  NOT NULL REFERENCES backup_alert_rule (code),
    old_in_app       BOOLEAN      NOT NULL,
    new_in_app       BOOLEAN      NOT NULL,
    old_email        BOOLEAN      NOT NULL,
    new_email        BOOLEAN      NOT NULL,
    old_threshold    INTEGER,
    new_threshold    INTEGER,
    changed_by       VARCHAR(120) NOT NULL,
    changed_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    reason           TEXT         NOT NULL
);
CREATE TRIGGER backup_alert_rule_history_append_only BEFORE UPDATE OR DELETE ON backup_alert_rule_history
    FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

INSERT INTO backup_alert_rule (code, label, hint, notify_in_app, notify_email, threshold_value, threshold_unit, threshold_min, threshold_max, sort_order) VALUES
    ('BACKUP_FAILED',            'A backup fails',                                         'A backup could not be written. The failed folder is kept as evidence.',                                      TRUE, TRUE,  NULL, NULL,         NULL, NULL, 10),
    ('BACKUP_MISSED',            'A scheduled backup did not run',                         'No backup has completed since the last time one was due.',                                                  TRUE, TRUE,  2,    'hours late', 1,    72,   20),
    ('BACKUP_VERIFY_FAILED',     'An integrity check fails',                               'A checksum, the signature or the chain of a backup does not match.',                                        TRUE, TRUE,  NULL, NULL,         NULL, NULL, 30),
    ('BACKUP_COPY_FAILED',       'A copy to another target fails',                         'A completed backup could not be copied to T2 (the NAS).',                                                   TRUE, TRUE,  NULL, NULL,         NULL, NULL, 40),
    ('TARGET_UNREACHABLE',       'A backup target does not answer',                        'A target did not pass its test. Missed copies are made up when it answers again.',                          TRUE, TRUE,  NULL, NULL,         NULL, NULL, 50),
    ('CAPACITY_HIGH',            'A backup target is nearly full',                         'The share of the disk of a target that is used.',                                                           TRUE, TRUE,  80,   '% used',     50,   99,   60),
    ('MANUAL_COPY_OVERDUE',      'The manual copy is overdue',                             'The policy says a person makes a copy by hand; no copy has been recorded within its period.',               TRUE, TRUE,  1,    'days late',  0,    30,   70),
    ('STORE_SCRUB_MISMATCH',     'The weekly file store check found a difference',         'A stored file differs from the backup index, or from the checksum recorded when the document was signed.', TRUE, TRUE,  NULL, NULL,         NULL, NULL, 80),
    ('BACKUP_V2_OVERDUE',        'The weekly restore proof is overdue',                    'No test restore of a backup has passed within its period.',                                                 TRUE, FALSE, NULL, NULL,         NULL, NULL, 90),
    ('OBJECT_MISSING_IN_SOURCE', 'A stored file is gone from the document store',          'A file version that an earlier backup holds is no longer in the live store.',                               TRUE, TRUE,  NULL, NULL,         NULL, NULL, 100),
    ('LEDGER_CHAIN_BROKEN',      'The ledger chain is broken',                             'The hash chain of the backup ledger does not verify. Treat as tampering until shown otherwise.',            TRUE, TRUE,  NULL, NULL,         NULL, NULL, 110),
    ('RESTORE_PROBLEM',          'A restore or a test restore has a problem',              'A restore failed, could not be rolled back, or left a database or test bucket behind.',                     TRUE, TRUE,  NULL, NULL,         NULL, NULL, 120),
    ('DR_KIT_OVERDUE',           'A rebuild kit item has not been checked in too long',    'Days since a person last checked an item of the rebuild kit.',                                              TRUE, FALSE, 365,  'days',       30,   1095, 130),
    ('AGENT_RESTARTED',          'The Backup Agent stopped during a backup',               'The agent was restarted while a backup was running.',                                                       TRUE, FALSE, NULL, NULL,         NULL, NULL, 140);

-- What has been told to whom. An alert raised before this table existed was not delivered by any rule, so it is marked done.
ALTER TABLE backup_alert ADD COLUMN delivered_at TIMESTAMPTZ;
UPDATE backup_alert SET delivered_at = now();
CREATE INDEX backup_alert_undelivered_idx ON backup_alert (at) WHERE delivered_at IS NULL;
