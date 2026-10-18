-- Training Management, paper first (PLAN-TR-001 17.7, SDS-TR-001 18.7, proposals D-39 and D-40): a session may run on paper, and the paper pack that is printed for it is a controlled
-- print: it carries the Training Number on every page, a pack code, a copy number and the page numbers, and every print is kept. A print after the first needs a reason.
-- Forward-only and idempotent. Nothing is granted to any role here.

ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS delivery_mode VARCHAR(10) NOT NULL DEFAULT 'ELECTRONIC';
ALTER TABLE training_sessions DROP CONSTRAINT IF EXISTS ck_training_sessions_delivery;
ALTER TABLE training_sessions ADD CONSTRAINT ck_training_sessions_delivery CHECK (delivery_mode IN ('ELECTRONIC','PAPER','MIXED'));

CREATE TABLE IF NOT EXISTS training_paper_packs (
    id          UUID PRIMARY KEY,
    activity_id UUID NOT NULL REFERENCES training_activities(id) ON DELETE RESTRICT,
    session_id  UUID NOT NULL REFERENCES training_sessions(id) ON DELETE RESTRICT,
    pack_code   VARCHAR(80) NOT NULL UNIQUE,
    copy_no     INTEGER NOT NULL CHECK (copy_no >= 1),
    page_count  INTEGER NOT NULL CHECK (page_count >= 1),
    people_count INTEGER NOT NULL CHECK (people_count >= 0),
    sha256      VARCHAR(64) NOT NULL,
    reason      TEXT,
    printed_by  UUID NOT NULL REFERENCES app_users(id),
    printed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ux_training_paper_pack_copy UNIQUE (session_id, copy_no),
    CONSTRAINT ck_training_paper_pack_reason CHECK (copy_no = 1 OR (reason IS NOT NULL AND length(btrim(reason)) > 0))
);
CREATE INDEX IF NOT EXISTS ix_training_paper_packs_activity ON training_paper_packs (activity_id);

CREATE OR REPLACE FUNCTION training_paper_pack_guard() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'A printed paper pack is a record and cannot be changed or deleted' USING ERRCODE = '0LPTR';
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_training_paper_pack_guard ON training_paper_packs;
CREATE TRIGGER trg_training_paper_pack_guard BEFORE UPDATE OR DELETE ON training_paper_packs FOR EACH ROW EXECUTE FUNCTION training_paper_pack_guard();

INSERT INTO permissions (id, code, name, category, module_key, group_key, description, display_order, requires_audit)
SELECT gen_random_uuid(), 'training.paper.print', 'Print Training Paper Packs', 'Training Management', 'training', 'training_activity',
       'Print the attendance and assessment sheets of a session for a training held on paper.', 240, TRUE
WHERE NOT EXISTS (SELECT 1 FROM permissions p WHERE p.code = 'training.paper.print');
