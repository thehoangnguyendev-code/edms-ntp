-- Administrator switch (General > Knowledge Base) that opens the Knowledge Base menu in the new
-- explorer experience. Stored inside the existing general_config JSON; absent means disabled, so
-- this only makes the key explicit for installations created before it existed.
UPDATE system_configurations
SET general_config = jsonb_set(
        general_config,
        '{appearance,knowledgeExplorerEnabled}',
        'false'::jsonb,
        true)
WHERE general_config ? 'appearance'
  AND NOT (general_config->'appearance' ? 'knowledgeExplorerEnabled');
