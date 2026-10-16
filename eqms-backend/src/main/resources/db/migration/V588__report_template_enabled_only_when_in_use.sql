-- REPORT-TEMPLATE-REVISION-2026-10-14 (owner remark): Enabled / Disabled is a state of a template that has an effective revision, the only kind that is offered for use.
-- A template still being written has no such state, so its flag is on (it cannot run either way). Forward-only, idempotent.

UPDATE report_definitions d
   SET active = TRUE
 WHERE d.source_code IS NOT NULL
   AND d.active = FALSE
   AND NOT EXISTS (SELECT 1 FROM report_template_revisions r WHERE r.definition_code = d.code AND r.status = 'EFFECTIVE');
