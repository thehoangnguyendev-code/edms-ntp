# REVIEW-2026-10-02 — Optional review for new documents

Owner decision: current conversation, new documents only. Implementation cutoff
is deployment of the new backend plus V525, not the user's browser clock.

## Invariants

Classification-only follow-up: Sub-Type changes/clearing preserve the document
snapshot for OPTIONAL, REQUIRED and NONE. No Sub-Type dictionary policy is read
when saving classification. FE uses the document response (including create response
before a potentially failed detail refresh), never dictionary policy. Sub-Type table
Review column and desktop/mobile Review filters are removed; payload type has no
Review write field. Backend rejects nonblank legacy Review write parameters.
No DB backfill/drop is needed: unused historical dictionary data is retained.
Permission, mandatory Approver, reviewer SoD, signing/audit, artefacts and workers unchanged.

- New createDocumentDraft sets OPTIONAL server-side; API input cannot change it.
- Existing documents/revisions are not backfilled. Their future upgrades retain
  the legacy document policy. Upgrades of OPTIONAL documents inherit OPTIONAL.
- Only authorized workflow configuration actors may assign participants. Existing
  scope, pool eligibility, role independence and mandatory Approver checks remain.
- Submit requires Draft, completed authoring and a consumed e-signature token;
  no Reviewer means Pending Approval, otherwise Pending Review. History/audit and
  signature evidence remain on the existing transaction path.
- No changes to controlled-copy recall, parent status propagation, file checksums,
  immutable published artefacts, or async snapshot request/generation guards.
- Reviewer inputs retain existing '-' fallbacks. Stepper uses persisted transition
  history to stripe skipped stages. OPTIONAL with no reviewers renders blank
  reviewer-signature placeholders. Legacy signature rendering remains unchanged.

## Source and verification

Follow-up requested by owner: remove Review Requirement from Add/Edit Sub-Type.
SubTypeModal no longer renders or submits this field. Existing server PATCH
semantics preserve legacy Sub-Type policy on omission; no schema/data deletion.
At that earlier checkpoint, legacy review columns/filters remained read-only historical information; the classification-only follow-up removes them from the UI. Upstream
impact SubTypeModal: LOW, 1 direct caller, 2 impacted symbols, no indexed processes.
Regression: editingSubtypeWithoutRemovedReviewFieldPreservesLegacyPolicy covers
both NONE and REQUIRED when the field is omitted.
Follow-up checks passed: OptionalReviewWorkflowTest 9/9, TypeScript, targeted
diff whitespace check. UI probe could not launch because Playwright is absent;
no live modal/mobile visual verification claimed. UI/UX skill used a minimal
field removal, preserving all remaining project controls and styles.

DocumentService createDocumentDraft/applyDraftFields; RevisionService upload gate,
review validators and submitForReview; ElectronicSignatureService placeholder
rendering; NewDocumentView optional roster and saved-workflow gate; V525 constraints.
DocumentTypeAdminService rejects OPTIONAL as a Sub-Type setting; it is not a new
dictionary policy. API exposes OPTIONAL through existing reviewRequirement fields.

GitNexus full rebuild repaired a broken FTS index. Exact affected symbol impacts
LOW; submit and upload gate include RevisionWorkspaceBatchService.processItem.
Tests: OptionalReviewWorkflowTest (upload guard, legacy cardinality, role separation,
mandatory approver, blank new/retained legacy signature cells, actual submit routes
with history/token consumption/checksum assertions, upgrade snapshot inheritance,
Sub-Type API rejection, Knowledge label). KnowledgeField now labels OPTIONAL accurately.

Verified on 2026-10-02:

- Backend compile passed.
- Backend focused regression run: 54 tests passed, zero failures/errors across
  OptionalReviewWorkflowTest (8), RevisionBusinessRulesTest (30),
  RevisionWorkflowStatePreconditionTest (8), RevisionWorkspaceBatchServiceTest (1),
  DocumentTypeAdminServiceTest (4), ElectronicSignatureRendererServiceTest (3).
- Frontend optionalReviewWorkflow.test.ts: 3 tests passed (history-based skipped
  Review, visited Review retained, missing reviewer fields displayed as '-').
- Frontend TypeScript `npx tsc --noEmit` passed; `git diff --check` passed.
- GitNexus detect-changes across the whole dirty checkout reported CRITICAL,
  33 tracked files / 105 symbols / 27 flows, including pre-existing Forms changes.
  This is not an isolated change-set report; all modified production symbols in
  this review change were individually impact-analyzed LOW before edits. No commit
  or deployment was made. New untracked tests/migration are recorded above.

Runtime database
migration, live browser, real Office publishing and end-to-end signature flow are
not yet verified. Referenced system evidence files and one-change-record template
in AGENTS.md were absent from this checkout; this record states source/test scope
without asserting regulatory compliance.

## Classification-only follow-up verification — 2026-10-02

- DocumentService.updateDocumentDraft no longer triggers reviewer validation on
  classification changes. Participant writes still use saveDraftAssignments validation.
- Reviewer messages now refer to saved document/revision policy, not Sub-Type.
- OptionalReviewWorkflowTest covers selecting/clearing classification for every
  persisted ReviewRequirement and rejects all nonblank Sub-Type Review API writes.
- Focused backend regression: 56 tests passed, zero failures/errors (10 optional
  review, 30 business rules, 8 state preconditions, 1 batch, 4 dictionary admin,
  3 signature renderer). Frontend workflow tests: 3 passed. TypeScript and
  git diff --check passed.
- Existing database-backed lifecycle baseline assertions were updated for
  classification-only changes and concurrency; historical testcase names retained.
  They compiled with the focused run but were NOT executed against a database.
- Individual added impacts: updateDocumentDraft LOW (1 caller, no indexed flows);
  three baseline test methods LOW (no callers/flows). Other production symbols
  were individually analyzed LOW before editing. No commit/deploy/database migration.
- UI/UX skill informed minimal removal of obsolete controls/column/filter and
  retention of project UI styles. Live browser verification remains outstanding.
