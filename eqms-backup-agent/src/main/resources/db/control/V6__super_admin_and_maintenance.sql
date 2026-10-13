-- Super Administrator (SDS-BR-001 section 11.6, decision BR-17): one account kept OUTSIDE the eQMS user table, so it survives a
-- restore of that table. Its password is stored only as a bcrypt hash. Login attempts are recorded in an append-only table.
CREATE TABLE super_admin (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username        VARCHAR(80)  NOT NULL UNIQUE,
    password_hash   VARCHAR(100) NOT NULL,
    active          BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    created_by      VARCHAR(120) NOT NULL
);

CREATE TABLE super_admin_event (
    id          BIGSERIAL PRIMARY KEY,
    username    VARCHAR(80)  NOT NULL,
    event       VARCHAR(30)  NOT NULL CHECK (event IN ('LOGIN_OK', 'LOGIN_FAILED', 'ACCOUNT_CREATED')),
    at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
    detail      TEXT
);
CREATE TRIGGER super_admin_event_append_only BEFORE UPDATE OR DELETE ON super_admin_event
    FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

-- Maintenance state (SDS 11.5.1): NORMAL -> NOTICE -> DRAINED -> LOCKED -> NORMAL. One row; every change is in maintenance_event.
CREATE TABLE maintenance_state (
    id            INTEGER      PRIMARY KEY CHECK (id = 1),
    state         VARCHAR(20)  NOT NULL CHECK (state IN ('NORMAL', 'NOTICE', 'DRAINED', 'LOCKED')),
    request_id    VARCHAR(60),
    ends_at       TIMESTAMPTZ,
    changed_by    VARCHAR(120) NOT NULL,
    changed_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);
INSERT INTO maintenance_state (id, state, changed_by) VALUES (1, 'NORMAL', 'system');

CREATE TABLE maintenance_event (
    id          BIGSERIAL PRIMARY KEY,
    event       VARCHAR(30)  NOT NULL,
    from_state  VARCHAR(20),
    to_state    VARCHAR(20)  NOT NULL,
    request_id  VARCHAR(60),
    by_user     VARCHAR(120) NOT NULL,
    at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
    detail_json JSONB
);
CREATE TRIGGER maintenance_event_append_only BEFORE UPDATE OR DELETE ON maintenance_event
    FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
