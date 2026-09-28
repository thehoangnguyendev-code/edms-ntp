-- require_one_approver was a togglable "exactly one Approver" SoD rule, but the frontend never
-- offered a way to select more than one Approver in any editing screen (participant picker
-- hardcoded to single-select / replace-not-append semantics for Approver, unlike Reviewer which
-- genuinely supports multiple). Product decision, 2026-09-03: exactly one Approver is an
-- unconditional business rule for every document, not a configurable SoD toggle, matching how
-- "at least one Approver" was already an unconditional GMP floor independent of this setting
-- (see RevisionService.saveRevisionParticipantsFromRequest). The enforcement itself moves from a
-- togglable check to an always-on one in DocumentService/RevisionService (same commit) rather than
-- being removed -- exactly one Approver is still required, it's just no longer optional.
ALTER TABLE document_workflow_settings DROP COLUMN IF EXISTS require_one_approver;
