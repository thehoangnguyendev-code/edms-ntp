-- documents.template.manage (V363) never actually governed anything of its own: creating or
-- marking a document as a Template is not a distinct capability -- a Template is an ordinary
-- Document (same workflow, same file-upload step), just flagged for reuse. It rode as an *extra*
-- check on top of the ordinary document-create permission (DocumentService#createDocumentDraft/
-- updateDocumentDraft), which the code no longer enforces separately.
--
-- Confirmed dead in practice: no real (non-UAT) Access Profile was ever granted this permission --
-- Administrator, DCO, Document Controller, Quality and Supervisor all hold documents.document.create
-- but none held documents.template.manage. Only the UAT-only "UAT DCO - Quality" profile had it,
-- via permission set PS_UAT_DOCUMENT_DCO (and PS_DOCUMENT_DCO, unused by any real profile).
--
-- documents.template.use is untouched: it remains its own permission, intentionally granted more
-- broadly than document-creators (e.g. Co-Author, Contributor) for *selecting* an existing
-- template -- a genuinely different capability from creating one.
DELETE FROM permission_set_items psi
USING permissions p
WHERE psi.permission_id = p.id
  AND p.code = 'documents.template.manage';

DELETE FROM role_permissions rp
USING permissions p
WHERE rp.permission_id = p.id
  AND p.code = 'documents.template.manage';

DELETE FROM permissions WHERE code = 'documents.template.manage';
