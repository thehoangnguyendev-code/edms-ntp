-- Enable the Document Workflow Rules requested by the business owner:
--   - same_user_cannot_hold_multiple_workflow_roles: a user assigned as Reviewer
--     on a document cannot also be its Approver (and vice versa), checked at
--     Save time (DocumentService.validateReviewerRules/validateApproverRules).
--   - author_cannot_be_reviewer_or_approver / co_author_cannot_be_reviewer_or_approver:
--     the Author/Co-Author of a document cannot also be assigned as its
--     Reviewer or Approver.
-- These rules already existed as configurable toggles (see
-- Security & Authorization -> Segregation of Duties -> Document Workflow Rules)
-- but shipped OFF by default; this migration turns them on. Admins can still
-- flip them back off from that screen at any time.
UPDATE document_workflow_settings
SET same_user_cannot_hold_multiple_workflow_roles = true,
    author_cannot_be_reviewer_or_approver = true,
    co_author_cannot_be_reviewer_or_approver = true,
    updated_at = now();
