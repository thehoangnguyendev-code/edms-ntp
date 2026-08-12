ALTER TABLE document_workflow_settings
    ADD COLUMN IF NOT EXISTS author_cannot_be_reviewer_or_approver BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE document_workflow_settings
    ADD COLUMN IF NOT EXISTS co_author_cannot_be_reviewer_or_approver BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE document_workflow_settings
    ADD COLUMN IF NOT EXISTS same_user_cannot_hold_multiple_workflow_roles BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE document_workflow_settings
    ADD COLUMN IF NOT EXISTS dco_cannot_be_reviewer_or_approver BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE document_workflow_settings
    ADD COLUMN IF NOT EXISTS reviewer_and_approver_different_departments BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE document_workflow_settings
SET
    reviewer_no_approve = COALESCE(reviewer_no_approve, FALSE),
    require_two_reviewers = COALESCE(require_two_reviewers, FALSE),
    require_one_approver = COALESCE(require_one_approver, TRUE),
    author_cannot_be_reviewer_or_approver = COALESCE(author_cannot_be_reviewer_or_approver, FALSE),
    co_author_cannot_be_reviewer_or_approver = COALESCE(co_author_cannot_be_reviewer_or_approver, FALSE),
    same_user_cannot_hold_multiple_workflow_roles = COALESCE(same_user_cannot_hold_multiple_workflow_roles, FALSE),
    dco_cannot_be_reviewer_or_approver = COALESCE(dco_cannot_be_reviewer_or_approver, FALSE),
    reviewer_and_approver_different_departments = COALESCE(reviewer_and_approver_different_departments, FALSE);
