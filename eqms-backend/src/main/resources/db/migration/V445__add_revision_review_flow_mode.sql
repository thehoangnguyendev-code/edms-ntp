-- Freezes the Sequential/Parallel Review choice on the revision when it is submitted, so changing
-- the Document Properties switch mid-review cannot change who may act on revisions already in
-- review. NULL = submitted before this column existed; those keep following the live setting.
ALTER TABLE document_revisions
    ADD COLUMN IF NOT EXISTS review_flow_mode VARCHAR(12);
