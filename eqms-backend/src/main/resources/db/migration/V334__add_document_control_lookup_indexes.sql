-- Query-path indexes for controlled-copy jobs and publishing metadata.
CREATE INDEX IF NOT EXISTS idx_cc_distribution_jobs_batch_id
    ON controlled_copy_distribution_jobs(batch_id);

CREATE INDEX IF NOT EXISTS idx_cc_distribution_job_items_copy_id
    ON controlled_copy_distribution_job_items(controlled_copy_id);

CREATE INDEX IF NOT EXISTS idx_revision_publishing_metadata_template_id
    ON revision_publishing_metadata(publishing_template_id);
