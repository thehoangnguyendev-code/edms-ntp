-- Snapshot selection is revision- and review-round-specific. The composite index keeps
-- comparison preview and audit retrieval deterministic as a controlled document accumulates
-- many rework cycles.
CREATE INDEX IF NOT EXISTS idx_revision_snapshot_history_revision_round_generated
    ON revision_snapshot_history(revision_id, review_round, generated_at DESC);
