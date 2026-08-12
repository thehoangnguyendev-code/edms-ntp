-- Links a reissued Controlled Copy back to the Lost/Damaged copy it replaces, for traceability.
ALTER TABLE controlled_copies
    ADD COLUMN replaces_controlled_copy_id UUID NULL REFERENCES controlled_copies(id);
