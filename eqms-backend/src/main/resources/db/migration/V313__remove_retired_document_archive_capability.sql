-- Document Archive is no longer a sidebar module; keep Module Capabilities
-- aligned with the active Document Control navigation.
UPDATE system_configurations
SET features_config = COALESCE(
    (
        SELECT jsonb_agg(feature ORDER BY ordinality)
        FROM jsonb_array_elements(features_config) WITH ORDINALITY AS entries(feature, ordinality)
        WHERE feature ->> 'id' <> 'feat-edms-archive'
    ),
    '[]'::jsonb
)
WHERE jsonb_typeof(features_config) = 'array';
