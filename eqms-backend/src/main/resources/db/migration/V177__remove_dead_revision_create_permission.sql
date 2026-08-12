-- documents.revision.create was never enforced anywhere: revision creation is
-- gated by Author assignment (upload path, requireCurrentUserCanUploadRevision)
-- or DCO workspace access (shell path, requireCanManageRevisionWorkspace), and
-- CREATE_REVISION was never passed to the workflow authorization gate. Remove
-- the dead permission so admins cannot tick a checkbox that does nothing.
-- Verified before deletion: no workflow_action_policies, lifecycle_state_policies
-- or sod_constraints rows reference this code.
DELETE FROM permission_set_items WHERE permission_id IN (SELECT id FROM permissions WHERE code = 'documents.revision.create');
DELETE FROM role_permissions WHERE permission_id IN (SELECT id FROM permissions WHERE code = 'documents.revision.create');
DELETE FROM permissions WHERE code = 'documents.revision.create';
