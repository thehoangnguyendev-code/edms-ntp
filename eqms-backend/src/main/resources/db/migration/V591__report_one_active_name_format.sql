-- REPORT-NAME-FORMAT-ACTIVE-2026-10-15 (owner): only one Report Name Format is active at a time, and a new report template is named by that active format;
-- nobody chooses a rule for a new template. Forward-only, idempotent.
--
-- 1. The default name format of Report Properties (V590) is not needed any more: the active format is the one.
ALTER TABLE report_properties DROP COLUMN IF EXISTS default_name_format_id;

-- 2. If more than one format is active now, the most recently changed stays active.
UPDATE report_name_formats f
   SET active = FALSE, version = version + 1, updated_at = now()
 WHERE f.active = TRUE
   AND f.id <> (SELECT id FROM report_name_formats WHERE active = TRUE ORDER BY updated_at DESC, code LIMIT 1);

-- 3. The database itself refuses a second active format.
CREATE UNIQUE INDEX IF NOT EXISTS ux_report_name_formats_one_active ON report_name_formats ((active)) WHERE active;
