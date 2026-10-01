-- Retire Countries without rewriting applied migrations or erasing audit history.
-- Schools' country_of_origin_name/iso2 fields are independent and remain unchanged.
-- V439 already dropped countries; no CASCADE is used if an unexpected FK exists.
DROP TABLE IF EXISTS countries;

DELETE FROM permission_dependencies
WHERE permission_code IN ('settings.country.view', 'settings.country.manage')
   OR depends_on_code IN ('settings.country.view', 'settings.country.manage');

DELETE FROM permission_set_items
WHERE permission_id IN (
    SELECT id FROM permissions
    WHERE code IN ('settings.country.view', 'settings.country.manage')
);

DELETE FROM permissions
WHERE code IN ('settings.country.view', 'settings.country.manage');
