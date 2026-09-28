-- Where the issue-time stamp/watermark were drawn on each page of a controlled copy (points, page coordinates). A later status
-- stamp (Obsoleted / Closed - Cancelled) is placed clear of these marks so the two never overlap. Copies issued before this
-- column existed have no record; their layout is derived again from the current policy when they are viewed.
ALTER TABLE controlled_copies ADD COLUMN IF NOT EXISTS marking_layout jsonb;
