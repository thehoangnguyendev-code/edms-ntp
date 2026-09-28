-- documents.template.use is retired. Choosing an approved template to start a revision from is just another way of
-- supplying the revision's source file, so it now rides on the permission that already governs uploading it
-- (documents.revision.upload_source) -- one permission fewer to grant and audit. documents.template.manage was retired the
-- same way in V411 (creating/marking a template rides on the document-create permission).
--
-- Effect: a Permission Set that held documents.template.use but not documents.revision.upload_source loses template
-- selection/preview. At the time of this change that was only PS_DCO_TEST, PS_DOCUMENT_DCO and PS_UAT_DOCUMENT_DCO. Sets that
-- hold both (Author, Co-Author, Contributor, Manager, Administrator, DCO and Document Controller roles) are unaffected.
DELETE FROM permission_dependencies
WHERE permission_code = 'documents.template.use' OR depends_on_code = 'documents.template.use';

DELETE FROM permission_set_items psi
USING permissions p
WHERE psi.permission_id = p.id
  AND p.code = 'documents.template.use';

DELETE FROM permissions WHERE code = 'documents.template.use';
