-- Publishing is a post-approval operation. Review snapshots are generated from the locked
-- source file, so the workspace must not be available during Draft.
UPDATE workflow_action_policies
SET from_status = 'READY_FOR_PUBLISHING',
    required_permission_code = 'documents.revision.open_publishing_workspace',
    description = 'DCO/Document Admin opens the publishing workspace after the revision is ready for publishing.',
    updated_at = now()
WHERE module_key = 'DOCUMENT_CONTROL'
  AND workflow_key = 'DOCUMENT_REVISION'
  AND object_type = 'REVISION'
  AND action_code = 'OPEN_PUBLISHING_WORKSPACE'
  AND from_status = 'DRAFT';
