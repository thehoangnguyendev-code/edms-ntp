-- "System Administration" (role System Super Admin) and "Document Security Administrator" (role
-- UAT Document Security Admin) permission sets were bundled with the FULL set of document business
-- workflow permissions (create/edit/cancel/obsolete a document; approve/review/reject/submit/upload/
-- publish a revision; configure the next revision's Author/Co-Author/Reviewer/Approver/Related/
-- Correlated; request/distribute/recall a controlled copy) alongside the genuinely
-- administrative/security permissions they're meant for (admin.view, admin.manage_workflow_roles,
-- document.view*). That let a System/Security Administrator act as an Author/Reviewer/Approver/DCO
-- on real documents -- a direct Segregation-of-Duties violation for a GMP system: an IT/security
-- administrator must never be a document workflow participant. Verified only the "admin" test
-- account holds either of these two roles, so this has zero impact on other users.
--
-- Read-only/oversight permissions are kept (admin still needs visibility for audits/support):
-- admin.manage_workflow_roles, admin.view, controlled_copy.download_evidence/view/view_evidence/
-- view_file, document.download_published/preview_published/view/view_all/view_audit, module.view,
-- revision.generate_preview/preview.
DELETE FROM permission_set_items psi
USING permission_sets ps, permissions p
WHERE psi.permission_set_id = ps.id
  AND psi.permission_id = p.id
  AND ps.name IN ('System Administration', 'Document Security Administrator')
  AND p.code IN (
    'documents.controlled_copy.cancel_request',
    'documents.controlled_copy.distribute',
    'documents.controlled_copy.expire',
    'documents.controlled_copy.recall',
    'documents.controlled_copy.replace_lost_damaged',
    'documents.controlled_copy.report_lost_damaged',
    'documents.controlled_copy.request',
    'documents.controlled_copy.upload_evidence',
    'documents.document.cancel',
    'documents.document.configure_initial_workflow',
    'documents.document.configure_next_metadata',
    'documents.document.create',
    'documents.document.edit_metadata',
    'documents.document.obsolete',
    'documents.document.reopen',
    'documents.document.update_metadata',
    'documents.revision.approve',
    'documents.revision.cancel',
    'documents.revision.complete_authoring',
    'documents.revision.configure_next_approvers',
    'documents.revision.configure_next_correlated_documents',
    'documents.revision.configure_next_related_documents',
    'documents.revision.configure_next_reviewers',
    'documents.revision.download_source',
    'documents.revision.edit_online',
    'documents.revision.obsolete',
    'documents.revision.open_publishing_workspace',
    'documents.revision.publish',
    'documents.revision.reject_approval',
    'documents.revision.reject_review',
    'documents.revision.review',
    'documents.revision.submit_review',
    'documents.revision.update_draft_metadata',
    'documents.revision.upgrade',
    'documents.revision.upload_office_online',
    'documents.revision.upload_source',
    'documents.template.use',
    'documents.training.complete',
    'documents.training.manage',
    'documents.workspace.manage'
  );
