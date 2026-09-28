-- The Legacy Import "Original Effective Date" now captures the time of day the paper original
-- took effect, not just the calendar date -- widen the column from DATE to TIMESTAMPTZ. Safe
-- as a plain type change: this column was added in V453 and no Legacy Import has run yet in any
-- environment that runs this migration (every existing row is NULL).
ALTER TABLE documents
    ALTER COLUMN original_effective_date TYPE TIMESTAMPTZ USING original_effective_date::TIMESTAMPTZ;
