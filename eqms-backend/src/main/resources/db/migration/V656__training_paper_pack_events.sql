-- V655 put the state of a copy in the row of the pack, but a printed pack is a record that cannot be changed (trigger of V616). The state is an event of its own: one closing event for each copy
-- (Returned, Lost or Voided), which cannot be changed or deleted either. A copy without an event is Issued.
ALTER TABLE training_paper_packs
    DROP CONSTRAINT IF EXISTS ck_training_paper_pack_status,
    DROP CONSTRAINT IF EXISTS ck_training_paper_pack_status_who,
    DROP CONSTRAINT IF EXISTS ck_training_paper_pack_status_reason,
    DROP COLUMN IF EXISTS status,
    DROP COLUMN IF EXISTS status_by,
    DROP COLUMN IF EXISTS status_at,
    DROP COLUMN IF EXISTS status_reason;

CREATE TABLE IF NOT EXISTS training_paper_pack_events (
    id         UUID PRIMARY KEY,
    pack_id    UUID NOT NULL UNIQUE REFERENCES training_paper_packs(id) ON DELETE RESTRICT,
    status     VARCHAR(10) NOT NULL CHECK (status IN ('RETURNED', 'LOST', 'VOIDED')),
    reason     TEXT,
    by_user    UUID NOT NULL REFERENCES app_users(id),
    at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_training_paper_pack_event_reason CHECK (status = 'RETURNED' OR (reason IS NOT NULL AND length(btrim(reason)) > 0))
);

CREATE OR REPLACE FUNCTION training_paper_pack_event_guard() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'The state of a paper copy is a record and cannot be changed or deleted' USING ERRCODE = '0LPTR';
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_training_paper_pack_event_guard ON training_paper_pack_events;
CREATE TRIGGER trg_training_paper_pack_event_guard BEFORE UPDATE OR DELETE ON training_paper_pack_events FOR EACH ROW EXECUTE FUNCTION training_paper_pack_event_guard();
