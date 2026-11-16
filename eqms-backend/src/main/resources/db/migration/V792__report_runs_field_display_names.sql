-- REPORT-SCREEN-LABELS-2026-11-15: the fields of the Report Runs source say what they hold, with the same names as the screens (Report Run History, Scheduled Reports).
-- Only the shown name changes; every field_code stays. Reports already generated keep their column names; Effective, Obsolete and Discarded revisions and the
-- definition versions are history and are not touched; the revisions still open (Draft, Pending Approval) are changed too, so a later release does not bring the old names back.
--   Report -> Generated Report Name; Template Number -> Report Template Number; Template Name -> Report Template Name; Status -> Run Status; Format -> Output Format;
--   Reason Code -> Failure Reason Code; Template Version -> Report Template Revision

create temporary table report_runs_names(field_code text, old_name text, new_name text) on commit drop;
insert into report_runs_names values
  ('reportTitle', 'Report', 'Generated Report Name'),
  ('templateCode', 'Template Number', 'Report Template Number'),
  ('templateName', 'Template Name', 'Report Template Name'),
  ('status', 'Status', 'Run Status'),
  ('format', 'Format', 'Output Format'),
  ('reasonCode', 'Reason Code', 'Failure Reason Code'),
  ('templateVersion', 'Template Version', 'Report Template Revision');

update report_definition_fields f
   set display_name = n.new_name
  from report_runs_names n, report_definitions d
 where d.code = f.definition_code and d.source_code = 'REPORT_RUNS'
   and f.field_code = n.field_code and f.display_name = n.old_name;

update report_template_revisions r
   set snapshot = jsonb_set(r.snapshot, '{fields}', (
         select coalesce(jsonb_agg(
                  coalesce((select jsonb_set(e, '{name}', to_jsonb(n.new_name)) from report_runs_names n where n.field_code = e->>'code' and n.old_name = e->>'name'), e)
                  order by t.ord), '[]'::jsonb)
           from jsonb_array_elements(r.snapshot->'fields') with ordinality as t(e, ord)))
  from report_definitions d
 where d.code = r.definition_code and d.source_code = 'REPORT_RUNS'
   and r.status in ('DRAFT', 'PENDING_APPROVAL')
   and jsonb_typeof(r.snapshot->'fields') = 'array';
