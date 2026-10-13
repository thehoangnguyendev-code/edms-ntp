-- Restore rules that an owner may change (SDS 14.1 and 11.3). Only values with a defined range are here. The control rules of the
-- restore (the requester may not approve, the executor may not be the approver, the window needs an administrator) are code, not
-- settings: they are not in this table. Every change is kept in restore_rule_history (append-only) with who, when and why.
CREATE TABLE restore_rule (
    code          VARCHAR(60)  PRIMARY KEY,
    int_value     INTEGER      NOT NULL,
    min_value     INTEGER      NOT NULL,
    max_value     INTEGER      NOT NULL,
    description   TEXT         NOT NULL,
    updated_by    VARCHAR(120) NOT NULL DEFAULT 'system',
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT restore_rule_in_range CHECK (int_value BETWEEN min_value AND max_value)
);

CREATE TABLE restore_rule_history (
    id            BIGSERIAL PRIMARY KEY,
    code          VARCHAR(60)  NOT NULL REFERENCES restore_rule (code),
    old_value     INTEGER,
    new_value     INTEGER      NOT NULL,
    changed_by    VARCHAR(120) NOT NULL,
    changed_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    reason        TEXT         NOT NULL,
    signature_ref VARCHAR(120)
);
CREATE TRIGGER restore_rule_history_append_only BEFORE UPDATE OR DELETE ON restore_rule_history
    FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

INSERT INTO restore_rule (code, int_value, min_value, max_value, description) VALUES
    ('REHEARSAL_MAX_AGE_DAYS', 30, 1, 90,
     'How many days a passed test restore of a backup remains valid for a production restore request (SDS 14.1).');
