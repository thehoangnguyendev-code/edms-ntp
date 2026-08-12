-- Remove the retired independent Work Management module.
--
-- This migration intentionally does NOT touch "Work Instruction" document types,
-- document workflow workspaces, async workers, or employee work-profile data.
-- Before production execution, retain an approved export/backup of work_* records.

-- Keep the existing Quality preference when a user has both workspaces; otherwise move
-- the Work preference to Quality without violating its (user_id, workspace_code) key.
DELETE FROM user_workspace_navigation_preferences work_preference
USING user_workspace_navigation_preferences quality_preference
WHERE work_preference.workspace_code = 'WORK'
  AND quality_preference.workspace_code = 'QUALITY'
  AND quality_preference.user_id = work_preference.user_id;

-- Remaining Work workspace preferences must not leave users on a route that no longer exists.
UPDATE user_workspace_navigation_preferences
SET workspace_code = 'QUALITY',
    last_route = '/dashboard',
    updated_at = NOW()
WHERE workspace_code = 'WORK';

ALTER TABLE user_workspace_navigation_preferences
    DROP CONSTRAINT IF EXISTS user_workspace_navigation_preferences_workspace_code_check;

ALTER TABLE user_workspace_navigation_preferences
    ADD CONSTRAINT user_workspace_navigation_preferences_workspace_code_check
    CHECK (workspace_code = 'QUALITY');

-- Remove only the Work Management feature object while preserving every other feature.
UPDATE system_configurations
SET features_config = COALESCE(
    (
        SELECT jsonb_agg(feature)
        FROM jsonb_array_elements(features_config) AS feature
        WHERE feature ->> 'id' <> 'feat-work-management'
    ),
    '[]'::jsonb
)
WHERE jsonb_typeof(features_config) = 'array'
  AND features_config @> '[{"id":"feat-work-management"}]';

-- Detach permission assignments before deleting the catalog rows.
DELETE FROM permission_set_items
WHERE permission_id IN (
    SELECT id FROM permissions
    WHERE code LIKE 'work_management.%' OR module_key = 'WORK_MANAGEMENT'
);

DELETE FROM permissions
WHERE code LIKE 'work_management.%' OR module_key = 'WORK_MANAGEMENT';

-- Preserve work_* data as an inaccessible archive in this release. Dropping those tables is
-- deliberately deferred until a retention decision, an immutable export and a restore test
-- have been approved; see docs/WORK_MANAGEMENT_REMOVAL_PLAN.md (Phase 4).
