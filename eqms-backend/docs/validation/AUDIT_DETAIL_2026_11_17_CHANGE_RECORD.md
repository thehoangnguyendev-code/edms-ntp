# Change record: Audit Trail Detail describes the changes (2026-11-17)

Decision Log: `AUDIT-DETAIL`. Status: **built on DEV, not committed.** Verified by unit tests and builds; **no screen was checked with a signed-in user** and no real operation was run to see the new change rows.

## What changed
- **Frontend** (`features/audit-trail`): Record block; `utils/changeRows.ts` (technical fields, JSON and list split, Set/Changed/Cleared, no row for an unchanged value); `utils/objectHistory.ts` and an `entityId` filter chip on the list; one label for the two legacy-import codes (`utils/actionBadge.ts`).
- **Backend:** `com.eqms.util.AuditChanges` and `TrainingStore.change`; about 150 audit calls in Training, Reports, Backup, Controlled Copy Recall, Access Review, Audit Trail Review, Announcement, Email Template, User force-logout and Object Numbering now pass their data (and a typed reason or note) as changes. The existing description and comment are unchanged.

- **Legacy import writes one audit entry per event** (`RevisionService`: the three separate `DOCUMENT_LEGACY_*` writes removed; the typed reason added to the comment of the history entry). `LegacyBatchImportFullFlowTest` (Spring) was not run here.

## Invariants
- The audit entry is written in the same place and transaction as before; only a change list is added. No new audit entry, no entry removed.
- A blank reason makes no change row. A value that did not change makes no row on the screen.
- Old entries are never rewritten; they keep their description.

## Evidence
- Frontend: `tsc` clean; vitest of `features/audit-trail` and the shared document audit tab pass (`changeRows`, labels, link).
- Backend: clean compile (hidden compile errors checked); tests of Training, Report, Backup, Audit, Controlled Copy, Revision, Document, User, Email Template, Object Numbering, Announcement: the unit tests pass; tests that verified the old call shape were updated (and two "never audited" checks moved to the new call so they still mean something). `AuditChangesTest` added.
- Not run: Spring integration tests (about 90) need an application context that cannot start on this PC (notification outbox key not configured), a cause outside this change; **not re-checked on a clean tree**.

## Not done / open
- Calls left without a change list on purpose: views, previews, downloads, prints, exports, denied access; status-only transitions; generic helpers that take an action and comment from their caller (`TrainingStore.auditActivity` 6-argument form, `ControlledCopyService` generic action, `WorkflowDeniedAuditService`).
- Sensitive-column notes of report runs stay in the description only.
- Editing a Vendor shows the new reference only (the old one is not read before saving).
- No signed-in screen check; `detect_changes` not run (GitNexus not available); nothing committed.

## DEV run of a legacy import (2026-11-17, as `dco.test1`, by API)
- Document `INS.9701` "Audit Single Entry Legacy Import Test" (id `1313f98b-c10e-4afe-ae74-ffe8a93b0428`), revisions 1.0.0 (Obsoleted) and 2.0.0 (Effective), department Quality Assurance, signed. **Kept on DEV as the owner asked.**
- Audit rows written: CREATE and ACTIVATE of the Document, then per revision exactly one `LEGACY_IMPORT`, plus one `LEGACY_BATCH_SUPERSEDED` (1.0.0) and one `LEGACY_IMPORT_EFFECTIVE` (2.0.0): 6 rows, all the revision rows signed and carrying "Reason: Imported from the paper archive, box 12 (single audit entry test)". The history table of the revisions has the same four entries.
- Read by API: main Audit Trail (documentNumber filter) 6 rows; Revision tab 2 rows per revision; Document tab 2 rows before and 6 after the `includeChildren` change; the detail of an entry gives Module "Document Control", Object Type "Document Revisions", Object Code "INS.9701 Rev.2.0.0", Action "Upload", signed, with the reason.
- Found on the way: the import was refused for `dco.test1` (department "Quality", which is not in the departments table). Owner decision: a Document Control Officer imports into any department: `LEGACY-IMPORT-DEPARTMENT-SCOPE` in the Decision Log. No permission or profile of any account was changed.
- Not checked: the screens in a browser; the e-signature of the import was given by API.
