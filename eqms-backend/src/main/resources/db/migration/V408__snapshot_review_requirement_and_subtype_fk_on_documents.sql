-- Review-requirement snapshot + Sub-Type FK on the document (Draft) record.
--
-- Problem (see docs/decisions/review-requirement-snapshot-and-subtype-fk-change-record.md,
-- failure modes E1-E11): a document's Sub-Type was stored only as a plain name string
-- (documents.sub_type). Renaming/deactivating a Sub-Type orphaned in-flight Drafts, which then
-- silently fell back to REQUIRED; and the review policy was re-resolved live from the Sub-Type on
-- every validator/DTO call, so an admin editing a Sub-Type's policy retroactively changed the
-- rules for Drafts already in progress. Three code paths resolved the requirement from three
-- different sources.
--
-- Fix:
--   1. documents.sub_type_id  -> FK to document_sub_types.id (ON DELETE RESTRICT). Authoritative
--      reference; sub_type (name) is kept only as denormalised display. Resolving by id makes
--      Sub-Type rename safe. (Decision D2)
--   2. documents.review_requirement -> snapshot of the Sub-Type's review policy frozen when the
--      Sub-Type is set/changed on the Draft. Single source read by all validators + DTOs + FE.
--      Admin changes to a Sub-Type's policy do NOT retroactively affect in-flight Drafts.
--      (Decision D1). Mirrors the existing per-revision snapshot on
--      document_revisions.review_requirement (BR-DOC docs/as-is-sds/09-business-rules.md:54).
--
-- Values match the ReviewRequirement enum names after V389: 'NONE' | 'REQUIRED'.
-- 'REQUIRED' is the safe default for no-Sub-Type / unresolved rows -- "unclassified" must never
-- be read as "review waived".

ALTER TABLE documents ADD COLUMN sub_type_id UUID;
ALTER TABLE documents ADD COLUMN review_requirement VARCHAR(16);

ALTER TABLE documents ADD CONSTRAINT fk_documents_sub_type
    FOREIGN KEY (sub_type_id) REFERENCES document_sub_types(id) ON DELETE RESTRICT;

ALTER TABLE documents ADD CONSTRAINT ck_documents_review_requirement
    CHECK (review_requirement IS NULL OR review_requirement IN ('NONE', 'REQUIRED'));

CREATE INDEX idx_documents_sub_type_id ON documents(sub_type_id);

-- Backfill: match each document's stored Sub-Type name to a Sub-Type row of the SAME
-- Document Type (Sub-Type names are only unique per document_type_id). Case-insensitive to
-- tolerate historical casing drift.
UPDATE documents d
SET sub_type_id        = st.id,
    review_requirement = st.review_requirement
FROM document_sub_types st
WHERE st.document_type_id = d.document_type_id
  AND d.sub_type IS NOT NULL
  AND lower(btrim(d.sub_type)) = lower(btrim(st.name));

-- Safe default for: no Sub-Type selected, or a name that no longer resolves to a live Sub-Type.
UPDATE documents
SET review_requirement = 'REQUIRED'
WHERE review_requirement IS NULL;
