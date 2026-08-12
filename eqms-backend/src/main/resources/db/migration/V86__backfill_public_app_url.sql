UPDATE system_configurations
SET notifications_config = jsonb_set(
    COALESCE(notifications_config, '{}'::jsonb),
    '{publicAppUrl}',
    to_jsonb('http://localhost:3000'::text),
    true
)
WHERE config_key = 'default'
  AND (
      notifications_config->>'publicAppUrl' IS NULL
      OR notifications_config->>'publicAppUrl' = ''
  );
