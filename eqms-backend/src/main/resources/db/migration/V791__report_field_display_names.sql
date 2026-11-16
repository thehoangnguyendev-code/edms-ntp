-- REPORT-FIELD-NAMES-2026-11-15: five display names of report fields are made to say what they hold. Only the shown name changes; every field_code stays.
--   Created                -> Created At            (the same date had two names in the report fields, "Created" and "Created At")
--   Training Required      -> Required Training     (Training Compliance and Training Matrix: it holds the name of the requirement, not Yes/No)
--   Record                 -> Record Status         (Training Records: it holds Valid or Voided)
--   Organisation (External)-> Organization (External)
--   Updated At             -> Last Updated          (Revision Lifecycle: the other report fields use "Last Updated")
-- Reports already generated keep the column names they were made with (they are records). The revisions that are still open (Draft, Pending Approval) carry a copy of
-- the field names; they are changed too, so that a revision released later does not bring the old names back. The snapshots of Effective, Obsolete and Discarded
-- revisions and of the definition versions are history and are not touched.

update report_definition_fields
   set display_name = 'Created At'
 where field_code = 'createdAt' and display_name = 'Created';

update report_definition_fields f
   set display_name = 'Required Training'
  from report_definitions d
 where d.code = f.definition_code
   and d.source_code in ('TRAINING_COMPLIANCE', 'TRAINING_MATRIX')
   and f.field_code = 'requirement'
   and f.display_name = 'Training Required';

update report_definition_fields
   set display_name = 'Record Status'
 where field_code = 'recordStatus' and display_name = 'Record';

update report_definition_fields
   set display_name = 'Organization (External)'
 where field_code = 'organisation' and display_name = 'Organisation (External)';

update report_definition_fields
   set display_name = 'Last Updated'
 where definition_code = 'REVISION_LIFECYCLE' and field_code = 'updatedAt' and display_name = 'Updated At';

-- The copy of the names inside the open revisions.
update report_template_revisions r
   set snapshot = jsonb_set(r.snapshot, '{fields}', (
         select coalesce(jsonb_agg(
                  case
                    when e->>'code' = 'createdAt' and e->>'name' = 'Created'
                      then jsonb_set(e, '{name}', '"Created At"')
                    when e->>'code' = 'requirement' and e->>'name' = 'Training Required' and d.source_code in ('TRAINING_COMPLIANCE', 'TRAINING_MATRIX')
                      then jsonb_set(e, '{name}', '"Required Training"')
                    when e->>'code' = 'recordStatus' and e->>'name' = 'Record'
                      then jsonb_set(e, '{name}', '"Record Status"')
                    when e->>'code' = 'organisation' and e->>'name' = 'Organisation (External)'
                      then jsonb_set(e, '{name}', '"Organization (External)"')
                    when r.definition_code = 'REVISION_LIFECYCLE' and e->>'code' = 'updatedAt' and e->>'name' = 'Updated At'
                      then jsonb_set(e, '{name}', '"Last Updated"')
                    else e
                  end order by t.ord), '[]'::jsonb)
           from jsonb_array_elements(r.snapshot->'fields') with ordinality as t(e, ord)))
  from report_definitions d
 where d.code = r.definition_code
   and r.status in ('DRAFT', 'PENDING_APPROVAL')
   and jsonb_typeof(r.snapshot->'fields') = 'array';
