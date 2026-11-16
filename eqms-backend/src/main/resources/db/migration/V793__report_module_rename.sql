-- REPORT-MODULE-RENAME-2026-11-16: the module "Reports & Analytics" is now "Reports", and Quality Analytics is gone.
--
-- 1. The permission group name shown on the permission screens. The permission codes (report.module.view, ...) are machine values and do not change.
-- 2. The module feature switch keeps its id (feat-system-reports) and gets the new name.
-- 3. feat-report-analytics ("Quality Analytics and Reports Overview", off, a design-preview switch that no longer gates anything) is removed with the screen it named.
UPDATE permissions
   SET category = 'Reports'
 WHERE category = 'Reports & Analytics';

UPDATE system_configurations
   SET features_config = (
       SELECT COALESCE(jsonb_agg(
                  CASE WHEN e.item ->> 'id' = 'feat-system-reports' THEN jsonb_set(e.item, '{name}', '"Reports"') ELSE e.item END
                  ORDER BY e.position), '[]'::jsonb)
         FROM jsonb_array_elements(features_config) WITH ORDINALITY AS e(item, position)
        WHERE e.item ->> 'id' <> 'feat-report-analytics'),
       updated_at = now()
 WHERE features_config @> '[{"id": "feat-system-reports"}]'
    OR features_config @> '[{"id": "feat-report-analytics"}]';
