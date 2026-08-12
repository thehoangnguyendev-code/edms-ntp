ALTER TABLE controlled_copies
    ADD COLUMN replaced_controlled_copy_id UUID REFERENCES controlled_copies(id);

CREATE INDEX IF NOT EXISTS idx_controlled_copies_replaced_controlled_copy_id
    ON controlled_copies (replaced_controlled_copy_id);
