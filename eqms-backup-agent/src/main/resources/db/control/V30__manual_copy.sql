-- The copy a person makes by hand (the third copy of the 3-2-1 rule). The Backup Agent cannot see it, so it only keeps what a person
-- records: the day the copy was made, where it is kept, who made it and the newest backup it holds. Records are never edited or removed.
CREATE TABLE manual_copy_record (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    copied_on     DATE         NOT NULL,
    backup_number VARCHAR(40),
    place         VARCHAR(200) NOT NULL,
    made_by       VARCHAR(120) NOT NULL,
    note          TEXT,
    recorded_by   VARCHAR(120) NOT NULL,
    recorded_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX manual_copy_record_idx ON manual_copy_record (copied_on DESC, recorded_at DESC);
CREATE TRIGGER manual_copy_record_append_only BEFORE UPDATE OR DELETE ON manual_copy_record
    FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
