-- Collapses ReviewRequirement from 4 states (NONE/SINGLE/MULTIPLE/FLEXIBLE) down to 2
-- (NONE/REQUIRED). The business only ever needed "is a review required at all" -- not a pinned
-- exact-one vs at-least-two headcount split. A document with no Sub-Type selected ("None") also
-- resolves to REQUIRED (unchanged: it previously resolved to FLEXIBLE, which becomes REQUIRED
-- too), never NONE -- "unclassified" must not be read as "review waived".
--
-- Verified against live data before writing this migration: zero document_sub_types rows used
-- MULTIPLE, zero document_revisions rows had review_requirement='MULTIPLE'. Every existing SINGLE
-- row (both tables) becomes REQUIRED, which is a widening (was "exactly 1", now "1 or more") --
-- no existing document/revision becomes invalid under the new rule.
--
-- Constraints must be dropped BEFORE the data update below: the old CHECK only allowed
-- NONE/SINGLE/MULTIPLE(/FLEXIBLE), so writing 'REQUIRED' while it's still in force would itself
-- violate the constraint.

ALTER TABLE document_sub_types DROP CONSTRAINT ck_document_sub_types_review_requirement;
ALTER TABLE document_revisions DROP CONSTRAINT ck_document_revisions_review_requirement;

UPDATE document_sub_types
SET review_requirement = 'REQUIRED', updated_at = now()
WHERE review_requirement IN ('SINGLE', 'MULTIPLE');

UPDATE document_revisions
SET review_requirement = 'REQUIRED'
WHERE review_requirement IN ('SINGLE', 'MULTIPLE', 'FLEXIBLE');

ALTER TABLE document_sub_types ADD CONSTRAINT ck_document_sub_types_review_requirement
    CHECK (review_requirement IN ('NONE', 'REQUIRED'));
ALTER TABLE document_sub_types ALTER COLUMN review_requirement SET DEFAULT 'REQUIRED';

ALTER TABLE document_revisions ADD CONSTRAINT ck_document_revisions_review_requirement
    CHECK (review_requirement IN ('NONE', 'REQUIRED'));
ALTER TABLE document_revisions ALTER COLUMN review_requirement SET DEFAULT 'REQUIRED';
