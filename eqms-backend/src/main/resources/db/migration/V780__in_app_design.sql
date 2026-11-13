-- IN-APP-DESIGN-2026-11-13 (owner request): the look of the toast (colour, shadow, place, display time) is one system-wide design of its own, edited in the
-- Notifications Administration like the Email Design, with a version, the user who changed it and an Audit Trail entry. It was four loose fields of the general
-- configuration. Forward-only and idempotent: the current values are copied once, then removed from the general configuration.

CREATE TABLE IF NOT EXISTS in_app_design (
    id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    toast_position         varchar(20) NOT NULL DEFAULT 'top-right',
    toast_duration_seconds integer     NOT NULL DEFAULT 5,
    toast_color            varchar(7)  NOT NULL DEFAULT '#3B82F6',
    toast_shadow           integer     NOT NULL DEFAULT 40,
    version                integer     NOT NULL DEFAULT 1,
    updated_by             varchar(100),
    updated_at             timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS in_app_design_single_row ON in_app_design ((true));

INSERT INTO in_app_design (toast_position, toast_duration_seconds, toast_color, toast_shadow, updated_by)
SELECT
    CASE WHEN a->>'toastPosition' IN ('center', 'top-center', 'bottom-center', 'top-right', 'top-left', 'bottom-right', 'bottom-left') THEN a->>'toastPosition' ELSE 'top-right' END,
    CASE WHEN a->>'toastDurationSeconds' ~ '^[0-9]{1,2}$' AND (a->>'toastDurationSeconds')::int BETWEEN 2 AND 60 THEN (a->>'toastDurationSeconds')::int ELSE 5 END,
    CASE
        WHEN a->>'toastColor' ~ '^#[0-9a-fA-F]{6}$' THEN upper(a->>'toastColor')
        WHEN a->>'toastColor' = 'emerald' THEN '#10B981' WHEN a->>'toastColor' = 'cyan' THEN '#06B6D4' WHEN a->>'toastColor' = 'indigo' THEN '#6366F1'
        WHEN a->>'toastColor' = 'purple' THEN '#A855F7' WHEN a->>'toastColor' = 'amber' THEN '#F59E0B' WHEN a->>'toastColor' = 'red' THEN '#EF4444'
        WHEN a->>'toastColor' = 'slate' THEN '#64748B'
        ELSE '#3B82F6'
    END,
    CASE WHEN a->>'toastShadow' ~ '^[0-9]{1,3}$' AND (a->>'toastShadow')::int BETWEEN 0 AND 100 THEN (a->>'toastShadow')::int ELSE 40 END,
    'System'
FROM (SELECT general_config->'appearance' AS a FROM system_configurations ORDER BY created_at LIMIT 1) s
WHERE NOT EXISTS (SELECT 1 FROM in_app_design);
INSERT INTO in_app_design (updated_by) SELECT 'System' WHERE NOT EXISTS (SELECT 1 FROM in_app_design);

UPDATE system_configurations
SET general_config = jsonb_set(general_config, '{appearance}', (general_config->'appearance') - 'toastPosition' - 'toastDurationSeconds' - 'toastColor' - 'toastShadow')
WHERE jsonb_typeof(general_config->'appearance') = 'object';
