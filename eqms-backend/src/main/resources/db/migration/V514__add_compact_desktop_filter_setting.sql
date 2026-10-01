-- Existing installations keep expanded desktop filters until an administrator opts in.
UPDATE system_configurations
SET general_config = jsonb_set(general_config, '{appearance}',
    COALESCE(general_config -> 'appearance', '{}'::jsonb)
        || jsonb_build_object('compactDesktopFilters', false), true)
WHERE jsonb_typeof(general_config) = 'object'
  AND (general_config -> 'appearance' IS NULL OR jsonb_typeof(general_config -> 'appearance') = 'object')
  AND NOT COALESCE(general_config -> 'appearance', '{}'::jsonb) ? 'compactDesktopFilters';
