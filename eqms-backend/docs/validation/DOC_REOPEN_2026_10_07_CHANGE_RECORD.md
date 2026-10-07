# Reopen a closed Document (Administrator)

## Request and scope
Owner request, 2026-10-07 (decision `DOC-REOPEN-2026-10-07` in `../governance/DECISION_LOG.md`). An Administrator reopens a
Document that is Closed - Cancelled or Obsoleted, with an e-signature and an audit entry; it returns to the state before it was
closed. Only the Document moves; its Revisions and Controlled Copies stay closed. Button **Reopen** in the footer of the Document
detail screen. A dedicated permission, assigned to the Administrator sets.

## Invariants
- **Actor and permission:** `documents.document.reopen` (the authorization engine, `lifecycle_state_policies` REOPEN rows for
  OBSOLETED and CLOSED_CANCELLED, V547), plus the object scope the engine applies to every Document action. Held by
  `ROLE_ADMINISTRATOR` and `SYSTEM_ADMINISTRATION`; removed from `ROLE_DCO` and `ROLE_DOCUMENT_CONTROLLER` (backup:
  `backups/reopen-permission-grants-before-2026-10-07.csv`). Never decided by a profile name.
- **Lifecycle:** only from OBSOLETED or CLOSED_CANCELLED, else `DOCUMENT_REOPEN_NOT_CLOSED` (and the engine has no policy for any
  other state). Target: `documents.status_before_closure`, recorded by Cancel and Obsolete from V547 on; for a Document closed
  earlier, derived: Obsoleted → Active, Closed - Cancelled → Draft (the only states those closures are possible from).
- **Signature and audit:** one e-signature token consumed (meaning `DOCUMENT_REOPENED`, seeded V547) and an
  `electronic_signatures` row; audit entry action REOPEN (from/to status, reason) linked to the signature session, in the same
  transaction as the status change. A mandatory reason; the signature is consumed only after every check that can fail without it.
- **Concurrency:** the Document row is locked for update (as Obsolete does) before the state is re-read.
- **Dependants:** no Revision or Controlled Copy is touched (asserted by the test: their statuses before and after are equal).
  After reopening an Obsoleted Document it is Active with no Effective revision: "Edit Revision for Upgrade" and "Upload
  Revision" now accept an Active Document that has a revision to build on (previously they required an Effective one);
  `requestControlledCopy` still needs an Effective revision. Nothing else about the revision workflow changed.
- **Not changed:** the Revision workflow rules, Controlled Copy rules, e-signature settings, notifications (none is sent).

## Changes
DB (V547): `documents.status_before_closure`, permission renamed "Reopen Document" and its grants, two `lifecycle_state_policies`
rows, one more `workflow_action_policies` row (OBSOLETED), the signature meaning. Backend: `DocumentService.reopenDocument`,
`POST /documents/{id}/reopen`, `DocumentReopenRequest`, `DocumentResourceAdapter` (REOPEN resolved), capability `reopen` and a
relaxed "ready for next revision" predicate in `DocumentMasterActionCapabilityService`, `DocumentService.updateActiveWorkflowConfiguration`
guard, audit label/filter (also fixes the "Obsoleted" action filter, which sent a value the server did not match).
Frontend: `DetailDocumentView` (button, signature modal), `documents.reopenDocument`, permission catalog.

## Source and impact evidence
GitNexus upstream impact before editing: `DocumentRecord` CRITICAL (277 impacted, 1 direct), `DocumentMasterActionCapabilityService`
CRITICAL (276/1), `DocumentResourceAdapter` CRITICAL (276/1), `DocumentAuthorizationService` CRITICAL (276/1, not edited),
`AuditTrailService` CRITICAL (277/1), `DocumentService` LOW. Every edit adds a path or a condition; none removes one. The owner asked
for this feature; the CRITICAL rating was not separately approved. `detect_changes` not run (nothing is committed).

## Test evidence
2026-10-07, Java 23 and vitest. `DocumentReopenIntegrationTest` 8 on the real schema (one rolled-back transaction; signature
replaced): Obsoleted → Active with the signature, audit entry, and revisions and copies unchanged; Closed - Cancelled → Draft
for a Document closed before the state was recorded; a recorded state is honoured; a user without the permission is refused and
no signature is spent; a Document that is not closed is refused; missing reason or signature refused without spending the
signature; capability true for a closed Document and false after; a reopened Document with no Effective revision is not blocked
from configuring its next revision and cannot request a controlled copy. Frontend: the Reopen button follows the capability,
asks for the signature before sending, and refreshes on a refusal (4 tests). Full backend suite: 1197 tests, 25 skipped, 1 failure,
the unrelated `Sprint10AuthorizationHardcodeRegressionTest.navigation_withoutPermissionsGetsEmptyMenu` (Calendar item, present
before this work). Frontend: 359 of 361; the two failures (`TableArchitecture`: native tables in
`dashboardUi.tsx`; `ReportLists`) are unrelated.

## Limitations and open risks
- **Not run through the browser or the HTTP API** (no test account); the real e-signature and the real engine configuration of
  an Administrator with a narrowed object scope were not exercised.
- The Signatures tab still shows the earlier "Obsoleted By" entry of a reopened Document (it reads the signature history); there is
  no "Reopened By" row. The e-signature and the audit trail carry the reopen.
- Reopening does not reverse what Obsolete did to the Document's dependants (revisions and copies stay closed, by decision) and
  sends no notification; the recorded `obsoleted_by/at` and `cancelled_by/at` remain as history.
- An Active Document without an Effective revision now exists as a state (after reopening an Obsoleted one). Other places that
  assume "Active means Effective" were not audited beyond the guards named above.
- The assistant's choices listed in the Decision Log (recorded state, derivation, mandatory reason, relaxed next-revision guard)
  are not yet confirmed by QA.
