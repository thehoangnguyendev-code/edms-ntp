-- Legacy Import: optional reference-only dates for when the paper original was historically
-- reviewed/approved (traceability only, never an EQMS-executed electronic review/approval --
-- same status as legacy_historical_reviewers/legacy_historical_approver, see V454).
ALTER TABLE document_revisions
    ADD COLUMN legacy_historical_review_date DATE,
    ADD COLUMN legacy_historical_approval_date DATE;
