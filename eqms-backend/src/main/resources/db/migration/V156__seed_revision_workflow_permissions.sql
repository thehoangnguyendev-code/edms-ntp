-- V156: Seed revision workflow transition permission codes used by RevisionWorkflowAuthorizationService (Sprint 3)
-- These permissions gate lifecycle transitions on DocumentRevisionRecord.

INSERT INTO permissions (id, code, name, category, module_key, group_key, description, display_order, requires_audit)
SELECT id, code, name, category, module_key, group_key, description, display_order, requires_audit
FROM (VALUES
    ('73111111-1111-1111-1111-111111111601'::uuid, 'documents.revision.create',                    'Create Revision',                     'Revision Workflow', 'documents', 'revision_workflow', 'Create a new draft revision for a document.',                                             630, FALSE),
    ('73111111-1111-1111-1111-111111111602'::uuid, 'documents.revision.edit_metadata',             'Edit Revision Metadata',              'Revision Workflow', 'documents', 'revision_workflow', 'Update draft revision metadata (title, description, dates, etc.).',                      640, FALSE),
    ('73111111-1111-1111-1111-111111111603'::uuid, 'documents.revision.complete_authoring',        'Complete Revision Authoring',         'Revision Workflow', 'documents', 'revision_workflow', 'Complete editing and lock the revision source for publishing preparation.',               650, TRUE),
    ('73111111-1111-1111-1111-111111111604'::uuid, 'documents.revision.open_publishing_workspace', 'Open Publishing Workspace',           'Revision Workflow', 'documents', 'revision_workflow', 'Open the publishing workspace for a completed draft revision.',                          660, FALSE),
    ('73111111-1111-1111-1111-111111111605'::uuid, 'documents.revision.submit_review',             'Submit Revision for Review',          'Revision Workflow', 'documents', 'revision_workflow', 'Submit a completed draft revision into the review/approval workflow.',                   670, TRUE),
    ('73111111-1111-1111-1111-111111111606'::uuid, 'documents.revision.review',                   'Review Revision',                     'Revision Workflow', 'documents', 'revision_workflow', 'Complete review of a revision pending review.',                                          680, TRUE),
    ('73111111-1111-1111-1111-111111111607'::uuid, 'documents.revision.reject_review',             'Reject Revision Review',              'Revision Workflow', 'documents', 'revision_workflow', 'Reject a revision at the review stage and return it to draft.',                          690, TRUE),
    ('73111111-1111-1111-1111-111111111608'::uuid, 'documents.revision.approve',                  'Approve Revision',                    'Revision Workflow', 'documents', 'revision_workflow', 'Complete approval of a revision pending approval.',                                      700, TRUE),
    ('73111111-1111-1111-1111-111111111609'::uuid, 'documents.revision.reject_approval',           'Reject Revision Approval',            'Revision Workflow', 'documents', 'revision_workflow', 'Reject a revision at the approval stage and return it to draft.',                        710, TRUE),
    ('73111111-1111-1111-1111-111111111610'::uuid, 'documents.revision.complete_training',         'Complete Revision Training',          'Revision Workflow', 'documents', 'revision_workflow', 'Mark training complete and move the revision to Ready for Publishing.',                  720, TRUE),
    ('73111111-1111-1111-1111-111111111611'::uuid, 'documents.revision.cancel',                   'Cancel Revision',                     'Revision Workflow', 'documents', 'revision_workflow', 'Cancel an in-progress revision.',                                                        730, TRUE),
    ('73111111-1111-1111-1111-111111111612'::uuid, 'documents.revision.obsolete',                 'Obsolete Revision',                   'Revision Workflow', 'documents', 'revision_workflow', 'Mark an effective revision as obsoleted.',                                               740, TRUE),
    ('73111111-1111-1111-1111-111111111613'::uuid, 'documents.revision.upgrade',                  'Upgrade Revision',                    'Revision Workflow', 'documents', 'revision_workflow', 'Create a new draft revision from an effective revision.',                                750, TRUE)
) AS v(id, code, name, category, module_key, group_key, description, display_order, requires_audit)
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE code = v.code);

-- Assign all workflow permissions to Document Admin / DCO roles.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE UPPER(r.code) IN (
    'DOCUMENT_ADMIN', 'DCO', 'DOCUMENT_CONTROL_OFFICER',
    'DOCUMENT_CONTROL_ADMIN', 'QA_ADMIN', 'QA_MANAGER'
)
  AND p.code IN (
      'documents.revision.create',
      'documents.revision.edit_metadata',
      'documents.revision.complete_authoring',
      'documents.revision.open_publishing_workspace',
      'documents.revision.submit_review',
      'documents.revision.review',
      'documents.revision.reject_review',
      'documents.revision.approve',
      'documents.revision.reject_approval',
      'documents.revision.complete_training',
      'documents.revision.cancel',
      'documents.revision.obsolete',
      'documents.revision.upgrade'
  )
  AND NOT EXISTS (
      SELECT 1 FROM role_permissions rp WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

-- Assign review permissions to Reviewer roles.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE UPPER(r.code) IN ('REVIEWER', 'DOCUMENT_REVIEWER')
  AND p.code IN ('documents.revision.review', 'documents.revision.reject_review')
  AND NOT EXISTS (
      SELECT 1 FROM role_permissions rp WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

-- Assign approval permissions to Approver roles.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE UPPER(r.code) IN ('APPROVER', 'DOCUMENT_APPROVER')
  AND p.code IN ('documents.revision.approve', 'documents.revision.reject_approval')
  AND NOT EXISTS (
      SELECT 1 FROM role_permissions rp WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );
