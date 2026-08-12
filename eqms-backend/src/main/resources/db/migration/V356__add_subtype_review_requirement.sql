ALTER TABLE document_sub_types
    ADD COLUMN IF NOT EXISTS review_requirement VARCHAR(16) NOT NULL DEFAULT 'SINGLE';

ALTER TABLE document_revisions
    ADD COLUMN IF NOT EXISTS review_requirement VARCHAR(16) NOT NULL DEFAULT 'SINGLE';

ALTER TABLE document_sub_types
    ADD CONSTRAINT ck_document_sub_types_review_requirement
    CHECK (review_requirement IN ('NONE', 'SINGLE', 'MULTIPLE'));

ALTER TABLE document_revisions
    ADD CONSTRAINT ck_document_revisions_review_requirement
    CHECK (review_requirement IN ('NONE', 'SINGLE', 'MULTIPLE'));
