-- Controlled-copy evidence is GMP-relevant evidence and must not disappear
-- implicitly when a controlled-copy row is removed.  Force an explicit
-- referential-integrity failure instead of cascading the evidence rows.
DO $$
DECLARE
    existing_constraint TEXT;
BEGIN
    SELECT con.conname
      INTO existing_constraint
      FROM pg_constraint con
      JOIN pg_class child_table ON child_table.oid = con.conrelid
      JOIN pg_class parent_table ON parent_table.oid = con.confrelid
     WHERE child_table.relname = 'controlled_copy_evidence_files'
       AND parent_table.relname = 'controlled_copies'
       AND con.contype = 'f'
       AND pg_get_constraintdef(con.oid) LIKE '%ON DELETE CASCADE%';

    IF existing_constraint IS NOT NULL THEN
        EXECUTE format(
            'ALTER TABLE controlled_copy_evidence_files DROP CONSTRAINT %I',
            existing_constraint
        );
    END IF;
END $$;

ALTER TABLE controlled_copy_evidence_files
    ADD CONSTRAINT fk_controlled_copy_evidence_copy
    FOREIGN KEY (controlled_copy_id)
    REFERENCES controlled_copies(id)
    ON DELETE RESTRICT;
