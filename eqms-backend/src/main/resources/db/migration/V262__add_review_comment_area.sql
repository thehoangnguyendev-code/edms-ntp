-- Review comments moved from a point pin to a drag-drawn rectangle so reviewers can highlight
-- the exact paragraph/figure they mean. width/height are nullable to keep existing point-only
-- rows (created before this migration) rendering as a small dot fallback on the frontend.
ALTER TABLE revision_review_comments
    ADD COLUMN IF NOT EXISTS width DOUBLE PRECISION NULL,
    ADD COLUMN IF NOT EXISTS height DOUBLE PRECISION NULL;
