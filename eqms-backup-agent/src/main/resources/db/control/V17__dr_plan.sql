-- Disaster Recovery Plan (SDS 15.2): the recovery targets change only with an approval by electronic signature and every change is kept;
-- the rebuild kit lists what a rebuild needs and when each item was last verified by a person (never filled in by the system); the
-- person who may declare a disaster is a plan setting with its history.
CREATE TABLE dr_target_history (
    id            BIGSERIAL PRIMARY KEY,
    scenario_code VARCHAR(40)  NOT NULL REFERENCES dr_scenario (code),
    old_rpo_hours NUMERIC(6,1),
    new_rpo_hours NUMERIC(6,1) NOT NULL,
    old_rto_hours NUMERIC(6,1),
    new_rto_hours NUMERIC(6,1) NOT NULL,
    changed_by    VARCHAR(120) NOT NULL,
    changed_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    reason        TEXT         NOT NULL,
    signature_ref VARCHAR(120) NOT NULL
);
CREATE TRIGGER dr_target_history_append_only BEFORE UPDATE OR DELETE ON dr_target_history
    FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

CREATE TABLE rebuild_kit_item (
    code        VARCHAR(40)  PRIMARY KEY,
    label       VARCHAR(160) NOT NULL,
    detail      TEXT         NOT NULL,
    sort_order  INTEGER      NOT NULL
);

CREATE TABLE rebuild_kit_verification (
    id          BIGSERIAL PRIMARY KEY,
    item_code   VARCHAR(40)  NOT NULL REFERENCES rebuild_kit_item (code),
    verified_at TIMESTAMPTZ  NOT NULL,
    verified_by VARCHAR(120) NOT NULL,
    note        TEXT,
    recorded_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX rebuild_kit_verification_idx ON rebuild_kit_verification (item_code, verified_at DESC);
CREATE TRIGGER rebuild_kit_verification_append_only BEFORE UPDATE OR DELETE ON rebuild_kit_verification
    FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

INSERT INTO rebuild_kit_item (code, label, detail, sort_order) VALUES
    ('DEPLOY_FILES', 'Deployment files and pinned image versions', 'Compose files and every container image stored offline, no internet needed.', 1),
    ('RUNBOOK', 'Step-by-step rebuild procedure', 'The printed and electronic copy of the rebuild procedure, with its version.', 2),
    ('SECRETS', 'Operational secrets escrow', 'Database, storage and signing secrets, held by two named people.', 3),
    ('BACKUP_KEY', 'Backup encryption key custody', 'Kept apart from the backups; without it a backup cannot be read.', 4);

CREATE TABLE dr_plan_setting (
    key         VARCHAR(60)  PRIMARY KEY,
    value       VARCHAR(200) NOT NULL,
    updated_by  VARCHAR(120) NOT NULL,
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE TABLE dr_plan_setting_history (
    id          BIGSERIAL PRIMARY KEY,
    key         VARCHAR(60)  NOT NULL,
    old_value   VARCHAR(200),
    new_value   VARCHAR(200) NOT NULL,
    changed_by  VARCHAR(120) NOT NULL,
    changed_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    reason      TEXT         NOT NULL
);
CREATE TRIGGER dr_plan_setting_history_append_only BEFORE UPDATE OR DELETE ON dr_plan_setting_history
    FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

-- Owner's decision (2026-10-13): the person who may declare a disaster is the administrator account.
INSERT INTO dr_plan_setting (key, value, updated_by) VALUES ('DECLARATION_AUTHORITY', 'admin', 'owner decision 2026-10-13');
