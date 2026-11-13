-- A declared disaster (SDS 15.2). Only the person named as the declaration authority may declare one, with an electronic signature; it is
-- closed, again with a signature, when service is restored, and the time between the two is the recovery time actually taken. A record
-- is never removed and, once closed, never changed. Only one declaration can be open at a time.
CREATE SEQUENCE dr_declaration_seq;
CREATE TABLE dr_declaration (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    declaration_code      VARCHAR(30)  NOT NULL UNIQUE,
    scenario_code         VARCHAR(40)  NOT NULL REFERENCES dr_scenario (code),
    status                VARCHAR(10)  NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED')),
    declared_by           VARCHAR(120) NOT NULL,
    declared_at           TIMESTAMPTZ  NOT NULL DEFAULT now(),
    declared_reason       TEXT         NOT NULL,
    declare_signature_ref VARCHAR(120) NOT NULL,
    rpo_target_hours      NUMERIC(6,1) NOT NULL,
    rto_target_hours      NUMERIC(6,1) NOT NULL,
    closed_by             VARCHAR(120),
    closed_at             TIMESTAMPTZ,
    closed_summary        TEXT,
    close_signature_ref   VARCHAR(120),
    CONSTRAINT dr_declaration_closed_shape CHECK (
        (status = 'OPEN' AND closed_by IS NULL AND closed_at IS NULL AND closed_summary IS NULL AND close_signature_ref IS NULL)
        OR (status = 'CLOSED' AND closed_by IS NOT NULL AND closed_at IS NOT NULL AND length(trim(closed_summary)) > 0 AND close_signature_ref IS NOT NULL))
);
CREATE UNIQUE INDEX dr_declaration_one_open ON dr_declaration ((status)) WHERE status = 'OPEN';
CREATE INDEX dr_declaration_declared_idx ON dr_declaration (declared_at DESC);

CREATE FUNCTION dr_declaration_guard() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'A disaster declaration cannot be removed';
    END IF;
    IF OLD.status <> 'OPEN' OR NEW.status <> 'CLOSED'
       OR NEW.id <> OLD.id OR NEW.declaration_code <> OLD.declaration_code OR NEW.scenario_code <> OLD.scenario_code
       OR NEW.declared_by <> OLD.declared_by OR NEW.declared_at <> OLD.declared_at OR NEW.declared_reason <> OLD.declared_reason
       OR NEW.declare_signature_ref <> OLD.declare_signature_ref OR NEW.rpo_target_hours <> OLD.rpo_target_hours OR NEW.rto_target_hours <> OLD.rto_target_hours THEN
        RAISE EXCEPTION 'A disaster declaration can only be closed, once';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER dr_declaration_guard BEFORE UPDATE OR DELETE ON dr_declaration
    FOR EACH ROW EXECUTE FUNCTION dr_declaration_guard();
