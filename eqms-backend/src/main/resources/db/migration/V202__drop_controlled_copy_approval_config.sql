-- The Approval config (Require Approval / Approver Role / Default Approver User) on the
-- Controlled Copies Policy screen was dead configuration: it was never consulted by any
-- enforcement logic. The actual approval gate is, and remains, permission-based via
-- ControlledCopyAuthorizationService.requireApproveControlledCopy() (permission code
-- documents.controlled_copy.approve_request / distribute), granted through Permission Sets
-- assigned to Roles. Drop the redundant columns.
ALTER TABLE controlled_copy_policy_settings
    DROP COLUMN require_approval,
    DROP COLUMN approver_role,
    DROP COLUMN approver_user;
