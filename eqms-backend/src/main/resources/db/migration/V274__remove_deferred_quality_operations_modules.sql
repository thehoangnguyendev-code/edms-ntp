-- The deployment scope is intentionally limited to Document Control, Training,
-- Reporting and Audit Trail.  The removed modules had no independent domain
-- tables in this codebase; this migration removes their configuration/catalog
-- records so they cannot remain assignable or appear in admin configuration.

DELETE FROM notification_event_definitions
WHERE module IN ('CAPA', 'DEVIATION');

DELETE FROM email_templates
WHERE type IN (
    'complaint-notification',
    'deviation-notification',
    'change-control-notification',
    'supplier-notification',
    'equipment-maintenance'
);

DELETE FROM access_profile_workflow_roles
WHERE workflow_role = 'QUALITY_ADMIN';

DELETE FROM workflow_roles
WHERE module_key IN (
    'quality',
    'deviations',
    'capa',
    'change-control',
    'complaints',
    'risk-management',
    'equipment',
    'supplier',
    'product',
    'regulatory'
);

DELETE FROM workflow_action_policies
WHERE module_key IN (
    'deviations',
    'capa',
    'change-control',
    'complaints',
    'risk-management',
    'equipment',
    'supplier',
    'product',
    'regulatory'
);

DELETE FROM lifecycle_state_policies
WHERE module_key IN (
    'deviations',
    'capa',
    'change-control',
    'complaints',
    'risk-management',
    'equipment',
    'supplier',
    'product',
    'regulatory'
);

UPDATE system_configurations
SET features_config = COALESCE(
    (
        SELECT jsonb_agg(feature)
        FROM jsonb_array_elements(features_config) AS feature
        WHERE feature ->> 'id' NOT IN (
            'feat-deviations', 'feat-capa', 'feat-change-control',
            'feat-complaints', 'feat-risk-management', 'feat-equipment',
            'feat-supplier-management', 'feat-product-management',
            'feat-regulatory-management'
        )
    ),
    '[]'::jsonb
)
WHERE jsonb_typeof(features_config) = 'array';

UPDATE system_configurations
SET notifications_config = jsonb_set(
    notifications_config,
    '{inAppConfig,triggers}',
    (notifications_config #> '{inAppConfig,triggers}') - 'capaDue',
    false
)
WHERE jsonb_typeof(notifications_config #> '{inAppConfig,triggers}') = 'object'
  AND (notifications_config #> '{inAppConfig,triggers}') ? 'capaDue';

DELETE FROM permissions
WHERE code IN (
    'deviations.module.view',
    'capa.module.view',
    'change_control.module.view',
    'complaints.module.view',
    'risk_management.module.view',
    'equipment.module.view',
    'supplier.module.view',
    'product.module.view',
    'regulatory.module.view'
);
