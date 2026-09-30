-- Per explicit product decision: Uncontrolled Copy eligibility is simplified to Document Type
-- only. Confidentiality Level (added by V503) had no UI ever wired up to set it on a document
-- (documents.confidentiality_level_id was always null in practice) and was used nowhere except
-- this eligibility matrix, so the whole feature (dictionary, document column, permissions) is
-- removed rather than left as dead code. The per-document Uncontrolled Copy override
-- (uncontrolled_copy_override / _reason / _by_user_id / _at) is unrelated and stays.

-- 1. Collapse the eligibility rule matrix down to Document Type only. A pre-existing active rule
--    that only differed by Confidentiality Level (same Document Type, both active) would now
--    collide on the new Document-Type-only uniqueness -- keep the most recently updated one and
--    deactivate the rest so no data is silently lost (an admin can review/reactivate as needed).
DROP INDEX IF EXISTS ux_uc_eligibility_rules_active_pair;
DROP INDEX IF EXISTS idx_uc_eligibility_rules_confidentiality;

WITH ranked AS (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY document_type_id ORDER BY updated_at DESC) AS rn
    FROM uncontrolled_copy_eligibility_rules
    WHERE active
)
UPDATE uncontrolled_copy_eligibility_rules r
SET active = FALSE
FROM ranked
WHERE r.id = ranked.id AND ranked.rn > 1;

ALTER TABLE uncontrolled_copy_eligibility_rules DROP COLUMN confidentiality_level_id;

CREATE UNIQUE INDEX ux_uc_eligibility_rules_active_type
    ON uncontrolled_copy_eligibility_rules (
        COALESCE(document_type_id, '00000000-0000-0000-0000-000000000000'::uuid)
    )
    WHERE active;

-- 2. Drop the per-document classification column (never set by any UI).
DROP INDEX IF EXISTS idx_documents_confidentiality_level;
ALTER TABLE documents DROP COLUMN confidentiality_level_id;

-- 3. Drop the dictionary table itself.
DROP TABLE IF EXISTS confidentiality_levels;

-- 4. Remove the 2 permissions this feature seeded (and anything referencing them).
DELETE FROM permission_dependencies
WHERE permission_code IN ('settings.confidentiality_level.view', 'settings.confidentiality_level.manage')
   OR depends_on_code IN ('settings.confidentiality_level.view', 'settings.confidentiality_level.manage');

DELETE FROM permission_set_items
WHERE permission_id IN (
    SELECT id FROM permissions
    WHERE code IN ('settings.confidentiality_level.view', 'settings.confidentiality_level.manage')
);

DELETE FROM permissions
WHERE code IN ('settings.confidentiality_level.view', 'settings.confidentiality_level.manage');
