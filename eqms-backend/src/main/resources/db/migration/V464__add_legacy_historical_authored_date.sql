-- Legacy Batch Import: reference-only date for when the paper original was historically
-- authored/drafted, alongside the existing legacy_historical_review_date/approval_date columns
-- (V457). Never a signature timestamp, never populated by an electronic signature event.
ALTER TABLE document_revisions ADD COLUMN IF NOT EXISTS legacy_historical_authored_date DATE NULL;
