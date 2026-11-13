-- The outcome of a restore that reached the swap (SDS-BR-003 steps 6-8). A restore stays PENDING_FINALIZATION, and can be rolled back,
-- until a person with the finalize permission closes it. Each state change keeps the electronic-signature reference of the person.
-- A state can only move forward: PENDING_FINALIZATION -> FINALIZED or ROLLED_BACK. Nothing is deleted.
CREATE TABLE restore_outcome (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_code           VARCHAR(40)  NOT NULL UNIQUE,
    backup_number      VARCHAR(40)  NOT NULL,
    live_db            VARCHAR(60)  NOT NULL,
    tag                VARCHAR(24)  NOT NULL,
    kept_old_db        VARCHAR(80)  NOT NULL,
    status             VARCHAR(24)  NOT NULL CHECK (status IN ('PENDING_FINALIZATION', 'FINALIZED', 'ROLLED_BACK')),
    restored_by        VARCHAR(120) NOT NULL,
    restore_signature  VARCHAR(120) NOT NULL,
    restored_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
    closed_by          VARCHAR(120),
    close_signature    VARCHAR(120),
    closed_at          TIMESTAMPTZ,
    post_db            VARCHAR(80)
);
-- only one restore may wait for finalization at a time, so the kept database and the rollback target are never ambiguous
CREATE UNIQUE INDEX restore_outcome_one_pending ON restore_outcome ((true)) WHERE status = 'PENDING_FINALIZATION';

CREATE FUNCTION restore_outcome_guard() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'restore_outcome rows cannot be deleted';
    END IF;
    IF OLD.status <> 'PENDING_FINALIZATION' THEN
        RAISE EXCEPTION 'restore_outcome % is already %', OLD.run_code, OLD.status;
    END IF;
    IF NEW.run_code <> OLD.run_code OR NEW.live_db <> OLD.live_db OR NEW.tag <> OLD.tag OR NEW.kept_old_db <> OLD.kept_old_db
       OR NEW.restored_by <> OLD.restored_by OR NEW.restore_signature <> OLD.restore_signature THEN
        RAISE EXCEPTION 'restore_outcome facts cannot be changed';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER restore_outcome_guard BEFORE UPDATE OR DELETE ON restore_outcome
    FOR EACH ROW EXECUTE FUNCTION restore_outcome_guard();
