# Record visibility for Document Control

## Request and scope

Owner request, 2026-10-06 (decisions in `../governance/DECISION_LOG.md`, DOC-VISIBILITY-2026-10-06): a user sees a Document or
Revision only when they are in its flow (Author, Co-Author, Reviewer, Approver), unless an administrator switches the visibility
off, in which case everyone holding the base View permission sees everything. Controlled and Uncontrolled Copies are visible
only to the user named as recipient. The holders of dedicated "view all" permissions always see everything, whatever the
setting and whatever their Access Profile is called. Replaces the environment flag
`APP_SECURITY_PARTICIPANT_VISIBILITY_STRICT` and the pending "D2" question.

## Invariants

- **Setting:** Document Properties > Protection & Distribution > Record visibility, stored as the machine value
  `PARTICIPANTS_ONLY` (default) or `ALL_WITH_VIEW_PERMISSION`. A missing, blank or unknown stored value resolves to
  `PARTICIPANTS_ONLY`: a corrupt value can never widen access. The API rejects any other value. Saving is audited with the
  existing configuration audit (old/new document configuration).
- **Blanket permissions (never affected by the setting):** `documents.document.view_all` (only grant of blanket document
  visibility; administration permissions no longer imply it), `documents.controlled_copy.view_all`,
  `documents.uncontrolled_copy.view_all`. Checked by permission code only, never by profile name.
- **Documents/Revisions:** list (SQL predicate), detail and file/snapshot access agree: participants (document or revision
  level, any role, optionally retained after removal), or open mode plus `documents.document.view`. Review snapshots stay
  participants-only unless the setting is open (the data-driven lifecycle policy, when enabled, still applies).
- **Copies:** visible to blanket viewers, or (open mode) holders of the base copy view permission, or the named recipient
  (account id, never display text). Distribution batches list every recipient, so only blanket viewers open them. Every
  action on an existing copy goes through the same check. Uncontrolled copy recipients are read from the new
  `recipient_user_id` column.
- **Not changed:** Preview and Audit Trail still need their own permission for people outside the flow (HDR-AUTH-001);
  Knowledge Base keeps its own department scoping; Training and object/BU/Department rules are untouched.

## Source and impact evidence

GitNexus upstream impact before editing (index refreshed first): `canViewAllDocuments` CRITICAL (78 impacted, 11 direct;
recallBatch, distributeBatch, cancelBatch, replaceLostDamaged), `canViewDocument` HIGH (27/7), `canViewRevision` HIGH (21/3;
completeTraining, previewComponent), `evaluateReviewSnapshotRules` LOW (7). The owner was warned and approved proceeding
("đồng ý cả 2"). Edited symbols: `DocumentAuthorizationService` (canViewAllDocuments, canViewDocument, canViewRevision,
list predicates, new copy visibility methods; `canAccessControlledCopy*` and `isStrictViewEligible` removed),
`SecureFileAccessService.evaluateReviewSnapshotRules`, `DocumentService`/`RevisionService` list gating,
`ControlledCopyService` (copy and batch lists/detail), `ControlledCopyAuthorizationService.requireBaseAccess`,
`AuditTrailService` (copy audit access), `UncontrolledCopyService`, `SystemConfigurationService`. `detect_changes` was not run:
nothing is committed and the working tree also holds unrelated earlier changes; run it before committing.

## Migration V540

Adds the two copy permissions and expands, never revokes: every Permission Set holding `documents.admin.view`,
`documents.admin.manage_workflow_roles`, `security.sod.manage` or `documents.document.view_all` receives all three dedicated
permissions (so no account's effective access changes on upgrade); sets holding uncontrolled approve/reject/distribute receive
`uncontrolled_copy.view_all`; adds `recipient_user_id` to uncontrolled copies with a backfill. Applied to the shared dev
database when the Spring tests started (verified: 16 sets hold the blanket permissions; backfill 1 of 1).

## Test evidence

2026-10-06, Java 23, `./mvnw -o`:
- `RecordVisibilityModeTest` 21 (both modes, fail-closed unknown value, blanket permission in both modes, administration
  permissions no longer imply view-all, copy recipient by account id not by name, document participants are not recipients,
  batches hidden from recipients, review snapshot allow/deny).
- `DocumentAuthorizationServiceTest` 34, `WorkflowRolesCatalogParityTest` 6, `SecureFileAccessServiceTest` 33,
  `UncontrolledCopyServiceTest` 14 (recipient or blanket only; operational permissions no longer imply view-all),
  `AuditTrailServiceTest` 5, `ControlledCopyAuthorizationServiceTest` 6, `ControlledCopyServiceAuthorizationIntegrationTest` 15.
- `ControlledCopyListAuthorizationIntegrationTest` on the real schema: the recipient-only list rule passed against seeded
  data; the "requester who is not the recipient" case was **skipped** because the seed data has no such copy.
- Full backend suite (excluding the hanging test below): 1169 tests, 25 skipped, 2 failed. One failure,
  `PermissionDependencySeedDataIntegrationTest` (row count), was updated: the table held 40 rows before V540 (the test expected
  42, already stale), V540 adds 4, so 44. The other, `Sprint10AuthorizationHardcodeRegressionTest.navigation_withoutPermissionsGetsEmptyMenu`,
  fails because `NavigationService` always adds the Calendar item (committed in 99fb120); `NavigationService` is unchanged here,
  so it is **not caused by this change** and was left alone.
- Frontend: `tsc --noEmit` shows only the two pre-existing `ReportLists.test.tsx` errors.

## Limitations and open risks

- **`DocumentListVisibilityParityIntegrationTest` was not verified.** It ran for about 4 hours without finishing (it walks every
  user against every document on the dev database) and was stopped. The list-versus-detail parity for participants-only mode
  therefore rests on the unit tests and on code reading, not on that test.
- Participants-only mode now hides Effective documents from non-participants: before, with the strict flag on, anyone holding
  `documents.document.view` could open an Effective document by link. Requesting a controlled copy of such a document needs
  to see it, so ordinary staff can no longer request one in that mode; the Knowledge Base (department scoped) remains the
  reading channel. Owner accepted the "Bật" default.
- `canCompleteRevisionTraining` calls `canViewRevision` (impact HIGH). Training runs in PENDING_TRAINING, which the old strict
  rule never covered, so behaviour is expected to be unchanged, but how trainees are modelled was not verified. Out of scope by
  owner decision.
- The Report Platform (`renderRows`, `reauthorizeArtifactScope`) calls `canViewDocument` and therefore follows the new rule
  (owner approved). An earlier Decision Log entry says report metadata is independent of document-content access: QA should
  reconcile the two.
- 16 Permission Sets held the blanket permissions after V540 because they held an administration permission that used to
  imply them. **Follow-up 2026-10-07 (owner decision): migration V542** removed the three view-all grants from the 8 that are
  neither DCO nor Administrator (`PS_DOCUMENT_SECURITY_ADMIN`, `PS_UAT_DOCUMENT_SECURITY_ADMIN`, the five `PS_MODULE_*_MANAGER`
  sets, `PS_PUBLISHING_TEMPLATE_MANAGER`) and kept the other 8 (`PS_DCO_TEST`, `PS_DOCUMENT_DCO`, `PS_UAT_DOCUMENT_DCO`,
  `PS_DOCUMENT_VIEW_ALL`, `ROLE_DCO`, `ROLE_ADMINISTRATOR`, `ROLE_DOCUMENT_CONTROLLER`, `SYSTEM_ADMINISTRATION`). Before
  running, a query showed no user would lose all blanket document visibility (the sets are either unassigned or the user
  keeps it through a DCO set). The removed rows are in `backups/removed-view-all-grants-2026-10-06.csv`. Reading "DCO/Admin"
  was the assistant's: `ROLE_DOCUMENT_CONTROLLER` (profile "Document Controller") was kept as DCO-equivalent.
- **Still open:** 8 other sets (Approver, Quality, Contributor and DCO-named sets) hold `documents.uncontrolled_copy.view_all`
  alone, kept by V540 so that people who approve/reject/distribute uncontrolled copy requests can still see the requests they
  decide. They were outside the owner's list and were not changed. If the owner wants them removed too, those approvers see
  only the copies they are the recipient of.
- Switching the setting takes effect on the next request (no cache); nothing re-evaluates sessions already open.
