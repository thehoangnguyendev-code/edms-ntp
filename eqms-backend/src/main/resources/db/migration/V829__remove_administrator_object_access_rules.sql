-- V829: the administrator-created Object Access Rules are removed for every module (Decision VISIBILITY-TIERS-AND-OBJECT-RULE-REMOVAL-2026-11-20).
--
-- Who sees a record is chosen on the Access Profile (only the records where the person is named / the records of the person's department / all records);
-- who may act is decided by permission, relation to the record, state and separation of duties. The free-form rules (by document type, category, status,
-- department, or by record for the other modules, V822) are not read by any decision any more.
--
-- NOT removed: the table object_access_rules itself. Its rows owned by a Department or a Business Unit are the Knowledge Base shares and exclusions (their
-- own model, owned by the Heads), and the permission security.object_rules.manage / .share_knowledge_any_department keep their codes because the Knowledge
-- Base authority levels read them.
--
-- Guard: the migration refuses to run while an administrator-created rule (no owning Department or Business Unit) still exists, so that nothing is lost in
-- silence. An installation that has such rules must export and retire them first. DEV holds none (checked 2026-11-20).
DO $$
DECLARE
    remaining integer;
BEGIN
    SELECT count(*) INTO remaining FROM object_access_rules WHERE owner_department_id IS NULL AND owner_business_unit_id IS NULL;
    IF remaining > 0 THEN
        RAISE EXCEPTION 'V829 refused: % administrator-created Object Access Rule(s) still exist; export and retire them before this migration (VISIBILITY-TIERS-2026-11-20).', remaining;
    END IF;
    IF to_regclass('public.access_profile_object_rules') IS NOT NULL THEN
        SELECT count(*) INTO remaining FROM access_profile_object_rules;
        IF remaining > 0 THEN
            RAISE EXCEPTION 'V829 refused: access_profile_object_rules holds % row(s); retire the rules first.', remaining;
        END IF;
    END IF;
END $$;

DROP TABLE IF EXISTS access_profile_object_rules;

DROP INDEX IF EXISTS idx_oar_module;
ALTER TABLE object_access_rules DROP CONSTRAINT IF EXISTS chk_oar_module_object_type;
ALTER TABLE object_access_rules DROP COLUMN IF EXISTS object_type;
ALTER TABLE object_access_rules DROP COLUMN IF EXISTS module_key;

-- back to the resource types that existed before V822 (every remaining row is a Knowledge share)
ALTER TABLE object_access_rules DROP CONSTRAINT IF EXISTS chk_oar_resource_type;
ALTER TABLE object_access_rules ADD CONSTRAINT chk_oar_resource_type CHECK (resource_type IN
    ('DOCUMENT_CATEGORY', 'DOCUMENT_TYPE', 'DOCUMENT_STATUS', 'DEPARTMENT', 'BUSINESS_UNIT', 'DOCUMENT'));

-- the permission of the removed screen (no decision and no screen read it any more)
DELETE FROM permission_set_items
WHERE permission_id IN (SELECT id FROM permissions WHERE code = 'security.object_rules.view');
DELETE FROM permissions WHERE code = 'security.object_rules.view';
