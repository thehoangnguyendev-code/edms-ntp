-- Remove system permission sets that represented modules deferred from the current product scope.
-- Child mappings are removed by the database's ON DELETE CASCADE foreign keys.
DELETE FROM permission_sets
WHERE code IN (
    'PS_MODULE_CAPA_MANAGER',
    'PS_MODULE_CHANGE_CONTROL_MANAGER',
    'PS_MODULE_COMPLAINTS_MANAGER',
    'PS_MODULE_DEVIATIONS_MANAGER',
    'PS_MODULE_EQUIPMENT_MANAGER',
    'PS_MODULE_PRODUCT_MANAGER',
    'PS_MODULE_REGULATORY_MANAGER',
    'PS_MODULE_RISK_MANAGEMENT_MANAGER',
    'PS_MODULE_SUPPLIER_MANAGER'
);
