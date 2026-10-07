-- Renames the two revision file permissions that still carry the retired "Office Online" name.
-- The behaviour is now provided by OnlyOffice; the permission grants and their meaning are unchanged.
--   documents.revision.edit_online           -> documents.revision.edit_onlyoffice
--   documents.revision.upload_office_online  -> documents.revision.sync_onlyoffice
-- Audit trail rows are NOT modified: they are historical evidence and keep the action codes that were
-- recorded at the time (for example SYNC_TO_OFFICE, EDIT_ONLINE).

-- permission_dependencies carries foreign keys to permissions(code) without ON UPDATE, so the
-- constraints are dropped for the rename and recreated afterwards with the same definitions.
ALTER TABLE permission_dependencies DROP CONSTRAINT IF EXISTS permission_dependencies_permission_code_fkey;
ALTER TABLE permission_dependencies DROP CONSTRAINT IF EXISTS permission_dependencies_depends_on_code_fkey;

UPDATE permissions SET code = 'documents.revision.edit_onlyoffice'
WHERE code = 'documents.revision.edit_online';
UPDATE permissions SET code = 'documents.revision.sync_onlyoffice'
WHERE code = 'documents.revision.upload_office_online';

-- Machine references that store the permission code as text.
UPDATE permission_dependencies SET permission_code = 'documents.revision.edit_onlyoffice'
WHERE permission_code = 'documents.revision.edit_online';
UPDATE permission_dependencies SET permission_code = 'documents.revision.sync_onlyoffice'
WHERE permission_code = 'documents.revision.upload_office_online';
UPDATE permission_dependencies SET depends_on_code = 'documents.revision.edit_onlyoffice'
WHERE depends_on_code = 'documents.revision.edit_online';
UPDATE permission_dependencies SET depends_on_code = 'documents.revision.sync_onlyoffice'
WHERE depends_on_code = 'documents.revision.upload_office_online';

ALTER TABLE permission_dependencies
    ADD CONSTRAINT permission_dependencies_permission_code_fkey
    FOREIGN KEY (permission_code) REFERENCES permissions(code) ON DELETE CASCADE;
ALTER TABLE permission_dependencies
    ADD CONSTRAINT permission_dependencies_depends_on_code_fkey
    FOREIGN KEY (depends_on_code) REFERENCES permissions(code) ON DELETE RESTRICT;

UPDATE workflow_action_policies SET required_permission_code = 'documents.revision.edit_onlyoffice'
WHERE required_permission_code = 'documents.revision.edit_online';
UPDATE workflow_action_policies SET required_permission_code = 'documents.revision.sync_onlyoffice'
WHERE required_permission_code = 'documents.revision.upload_office_online';

UPDATE lifecycle_state_policies SET required_permission_code = 'documents.revision.edit_onlyoffice'
WHERE required_permission_code = 'documents.revision.edit_online';
UPDATE lifecycle_state_policies SET required_permission_code = 'documents.revision.sync_onlyoffice'
WHERE required_permission_code = 'documents.revision.upload_office_online';

UPDATE sod_constraints SET permission_code_a = 'documents.revision.edit_onlyoffice'
WHERE permission_code_a = 'documents.revision.edit_online';
UPDATE sod_constraints SET permission_code_a = 'documents.revision.sync_onlyoffice'
WHERE permission_code_a = 'documents.revision.upload_office_online';
UPDATE sod_constraints SET permission_code_b = 'documents.revision.edit_onlyoffice'
WHERE permission_code_b = 'documents.revision.edit_online';
UPDATE sod_constraints SET permission_code_b = 'documents.revision.sync_onlyoffice'
WHERE permission_code_b = 'documents.revision.upload_office_online';
