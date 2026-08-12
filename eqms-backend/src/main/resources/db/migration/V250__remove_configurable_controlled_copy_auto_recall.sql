-- Auto-recall is a GMP invariant implemented by the document/revision lifecycle,
-- not a tenant-configurable policy.
ALTER TABLE controlled_copy_policy_settings
    DROP COLUMN IF EXISTS auto_recall_when_new_revision_effective,
    DROP COLUMN IF EXISTS auto_recall_when_revision_obsoleted;
