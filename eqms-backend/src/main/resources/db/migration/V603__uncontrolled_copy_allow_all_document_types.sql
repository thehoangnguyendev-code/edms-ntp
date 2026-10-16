-- V603: Uncontrolled copies are requestable for every document type, the same as Controlled Copies.
-- Owner decision (2026-10-16, option 2): keep the eligibility rule matrix as the single default
-- switch, but the default allows every document type and no per-document-type rule is kept.
--
-- 1. Exactly one system (default) rule with no document type, allowed = TRUE, active = TRUE.
-- 2. Every non-system (per-document-type) rule is removed, so no document type is blocked.
-- Idempotent: safe to run on a database that already has this state.

UPDATE uncontrolled_copy_eligibility_rules
SET allowed = TRUE, active = TRUE
WHERE system = TRUE AND document_type_id IS NULL;

INSERT INTO uncontrolled_copy_eligibility_rules (document_type_id, allowed, active, system)
SELECT NULL, TRUE, TRUE, TRUE
WHERE NOT EXISTS (
    SELECT 1 FROM uncontrolled_copy_eligibility_rules
    WHERE system = TRUE AND document_type_id IS NULL
);

DELETE FROM uncontrolled_copy_eligibility_rules
WHERE system = FALSE OR document_type_id IS NOT NULL;
