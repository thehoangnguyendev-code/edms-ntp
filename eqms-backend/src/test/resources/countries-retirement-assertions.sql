DO $$
BEGIN
 IF EXISTS (SELECT 1 FROM permissions WHERE code LIKE 'settings.country.%')
    OR EXISTS (SELECT 1 FROM permission_dependencies)
    OR (SELECT count(*) FROM permission_set_items) <> 1
    OR NOT EXISTS (SELECT 1 FROM permissions WHERE code = 'settings.education.school.view')
    OR NOT EXISTS (SELECT 1 FROM schools WHERE country_of_origin_name = 'Vietnam' AND country_of_origin_iso2 = 'VN')
    OR (SELECT count(*) FROM audit_trails) <> 1
    OR to_regclass('pg_temp.countries') IS NOT NULL THEN
   RAISE EXCEPTION 'Countries retirement failed isolation/retirement checks';
 END IF;
END $$;
ROLLBACK;
