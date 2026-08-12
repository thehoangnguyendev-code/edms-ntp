-- Canonical terminology: this action uploads a Draft revision to the Office
-- Online workspace. Permission-set assignments are preserved because the
-- permission primary key remains unchanged.
UPDATE permissions
SET code = 'documents.revision.upload_office_online',
    name = 'Upload Revision to Office Online',
    description = 'Upload or synchronize an authorised Draft revision working copy with Office Online.'
WHERE code = 'documents.revision.sync_office';

-- Some installations may have policy rows that persisted the old code rather
-- than resolving the permission by id. Keep these rows aligned as well.
UPDATE workflow_action_policies
SET required_permission_code = 'documents.revision.upload_office_online'
WHERE required_permission_code = 'documents.revision.sync_office';
