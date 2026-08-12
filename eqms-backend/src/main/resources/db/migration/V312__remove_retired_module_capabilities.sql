-- Keep System Configuration > Features > Module Capabilities aligned with the
-- active sidebar scope. These modules were retired from the application menu.
UPDATE system_configurations
SET features_config = COALESCE(
    (
        SELECT jsonb_agg(feature ORDER BY ordinality)
        FROM jsonb_array_elements(features_config) WITH ORDINALITY AS entries(feature, ordinality)
        WHERE feature ->> 'id' NOT IN (
            'feat-my-tasks',
            'feat-edms-archive',
            'feat-quality', 'feat-quality-deviations', 'feat-quality-capa',
            'feat-quality-change', 'feat-quality-complaints', 'feat-quality-risk',
            'feat-operations', 'feat-operations-equipment',
            'feat-operations-supplier', 'feat-operations-product',
            'feat-regulatory', 'feat-regulatory-management'
        )
    ),
    '[]'::jsonb
)
WHERE jsonb_typeof(features_config) = 'array';
