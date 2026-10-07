-- Owner-approved TEST templates, not fabricated business documents or report executions.
-- No grants are added to any non-Administrator role and no global permissions change.
INSERT INTO report_definitions(code,display_name,description,category,classification,active,source_code,allowed_formats,layout)
SELECT sample.code,sample.name,'TEST template using live Document Register metadata. Not an approved operational report.',
 'METADATA','REGULATED',true,'DOCUMENT_STATUS','["PDF","XLSX","CSV"]'::jsonb,
 '{"cover":true,"coverTitle":"{{report.title}}","subtitle":"TEST report · live metadata · not for operational use","showExecutor":true,"showGeneratedAt":true,"header":"{{report.title}}","footer":"{{report.code}} · v{{template.version}}","pageNumbers":true,"watermarkEnabled":true,"watermark":"TEST ONLY","stampEnabled":true,"stamp":"TEST · NOT FOR OPERATIONAL USE"}'::jsonb
FROM (VALUES ('TEST_DOCUMENT_REGISTER','TEST · Document Register'),('TEST_DOCUMENT_LIFECYCLE','TEST · Document Lifecycle'),('TEST_DEPARTMENT_REGISTER','TEST · Department Register')) sample(code,name)
ON CONFLICT(code) DO NOTHING;

INSERT INTO report_definition_fields(definition_code,field_code,display_name,field_type,allowed,default_selected,required,display_order)
SELECT sample.code,f.field_code,f.display_name,f.field_type,f.allowed,f.default_selected,f.required,f.display_order
FROM (VALUES ('TEST_DOCUMENT_REGISTER'),('TEST_DOCUMENT_LIFECYCLE'),('TEST_DEPARTMENT_REGISTER')) sample(code)
CROSS JOIN report_definition_fields f WHERE f.definition_code='DOCUMENT_STATUS'
ON CONFLICT(definition_code,field_code) DO NOTHING;

UPDATE report_definition_fields SET default_selected=required OR field_code IN ('status','effectiveDate','createdAt')
WHERE definition_code='TEST_DOCUMENT_LIFECYCLE';
UPDATE report_definition_fields SET default_selected=required OR field_code IN ('department','businessUnit','documentType')
WHERE definition_code='TEST_DEPARTMENT_REGISTER';

INSERT INTO report_template_role_scopes(definition_code,role_id,scope_code)
SELECT sample.code,r.id,'SYSTEM' FROM roles r CROSS JOIN
 (VALUES ('TEST_DOCUMENT_REGISTER'),('TEST_DOCUMENT_LIFECYCLE'),('TEST_DEPARTMENT_REGISTER')) sample(code)
WHERE r.code='ADMINISTRATOR' AND r.is_active=true
ON CONFLICT(definition_code,role_id) DO NOTHING;

INSERT INTO report_definition_versions(definition_code,version,snapshot,reason)
SELECT d.code,d.definition_version,jsonb_build_object('definition',to_jsonb(d),'fields',
 (SELECT jsonb_agg(to_jsonb(f)) FROM report_definition_fields f WHERE f.definition_code=d.code),
 'roleScopes',(SELECT jsonb_agg(to_jsonb(g)) FROM report_template_role_scopes g WHERE g.definition_code=d.code)),
 'Owner-approved TEST setup via V533 migration; system migration, no user impersonation.'
FROM report_definitions d WHERE d.code IN ('TEST_DOCUMENT_REGISTER','TEST_DOCUMENT_LIFECYCLE','TEST_DEPARTMENT_REGISTER')
ON CONFLICT(definition_code,version) DO NOTHING;
