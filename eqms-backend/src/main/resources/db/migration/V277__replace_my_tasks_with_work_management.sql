-- Retire the legacy My Tasks module. Work Management is a separate domain and
-- has its own route and project-level authorization model.

-- Migrate personal workspace preferences before removing the old TASKS value.
ALTER TABLE user_workspace_navigation_preferences
    DROP CONSTRAINT IF EXISTS user_workspace_navigation_preferences_workspace_code_check;

UPDATE user_workspace_navigation_preferences
SET workspace_code = 'WORK',
    last_route = REPLACE(last_route, '/my-tasks', '/work-management'),
    updated_at = NOW()
WHERE workspace_code = 'TASKS';

ALTER TABLE user_workspace_navigation_preferences
    ADD CONSTRAINT user_workspace_navigation_preferences_workspace_code_check
    CHECK (workspace_code IN ('QUALITY', 'WORK'));

-- Preserve each feature's existing enabled state while replacing the retired
-- feature definition with the active Work Management feature.
UPDATE system_configurations
SET features_config = COALESCE(
    (
        SELECT jsonb_agg(
            CASE WHEN feature ->> 'id' = 'feat-my-tasks' THEN
                jsonb_set(
                    jsonb_set(
                        jsonb_set(feature, '{id}', '"feat-work-management"'::jsonb),
                        '{name}', '"Work Management"'::jsonb
                    ),
                    '{description}', '"Project, issue, assignment, and work-planning management."'::jsonb
                )
            ELSE feature
            END
        )
        FROM jsonb_array_elements(features_config) AS feature
    ),
    '[]'::jsonb
)
WHERE jsonb_typeof(features_config) = 'array'
  AND features_config @> '[{"id":"feat-my-tasks"}]'::jsonb;

-- Delete the retired module's permission and assignable permission set.
-- Mapping rows are removed through their foreign-key cascade rules.
DELETE FROM permissions
WHERE code = 'my_tasks.module.view'
   OR module_key = 'my-tasks';

DELETE FROM permission_sets
WHERE code = 'PS_MODULE_MY_TASKS_MANAGER';
