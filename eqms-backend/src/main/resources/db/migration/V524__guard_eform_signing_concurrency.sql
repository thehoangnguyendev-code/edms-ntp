-- One data-entry/signature chain per issued electronic copy, including forms without signer roles.
-- Do not discard or rewrite historical runs. Existing duplicates must be reconciled explicitly
-- if this migration fails; it intentionally does not guess which execution to keep.
CREATE UNIQUE INDEX uq_eform_fill_runs_active_copy
    ON eform_fill_runs(controlled_copy_id)
    WHERE status = 'IN_PROGRESS' AND controlled_copy_id IS NOT NULL;

CREATE UNIQUE INDEX uq_eform_signer_assignments_sequence
    ON eform_signer_assignments(controlled_copy_id, sequence);

ALTER TABLE eform_signer_assignments ADD CONSTRAINT chk_eform_signer_sequence_positive CHECK (sequence > 0);
