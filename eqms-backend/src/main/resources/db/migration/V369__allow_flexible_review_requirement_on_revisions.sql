-- ReviewRequirement gained a 4th value, FLEXIBLE (documents with no Sub-Type selected: at least
-- one Reviewer, not pinned to an exact count). document_revisions.review_requirement is where that
-- value actually gets persisted (snapshotted once per revision at creation time) -- this table's
-- CHECK constraint was never updated to allow it, so creating (or, as found via a direct UPDATE
-- while fixing existing test data, updating) a revision with review_requirement = 'FLEXIBLE' failed
-- with a constraint violation. document_sub_types.review_requirement is deliberately NOT touched
-- here: FLEXIBLE is only ever a fallback for "no Sub-Type chosen", not a value an admin should be
-- able to assign to an actual Sub-Type.
ALTER TABLE document_revisions DROP CONSTRAINT ck_document_revisions_review_requirement;
ALTER TABLE document_revisions ADD CONSTRAINT ck_document_revisions_review_requirement
    CHECK (review_requirement IN ('NONE', 'SINGLE', 'MULTIPLE', 'FLEXIBLE'));
