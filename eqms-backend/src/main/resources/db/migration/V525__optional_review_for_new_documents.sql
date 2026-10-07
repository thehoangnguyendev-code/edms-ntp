-- OPTIONAL is set only by new-document creation after deployment.
-- Do not backfill documents/revisions: legacy snapshots keep their workflow.
ALTER TABLE documents DROP CONSTRAINT ck_documents_review_requirement;
ALTER TABLE documents ADD CONSTRAINT ck_documents_review_requirement
    CHECK (review_requirement IS NULL OR review_requirement IN ('NONE', 'REQUIRED', 'OPTIONAL'));
ALTER TABLE document_revisions DROP CONSTRAINT ck_document_revisions_review_requirement;
ALTER TABLE document_revisions ADD CONSTRAINT ck_document_revisions_review_requirement
    CHECK (review_requirement IN ('NONE', 'REQUIRED', 'OPTIONAL'));
