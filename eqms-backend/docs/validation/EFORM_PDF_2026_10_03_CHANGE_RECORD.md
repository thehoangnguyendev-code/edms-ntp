# EFORM-PDF-2026-10-03 change record

Status: partial implementation; not release-ready. Owner decision: EFORM-PDF-2026-10-03.

## Baseline and invariants

Existing dirty-tree changes belong to the owner and are preserved. The referenced
system evidence conventions, As-Is documents and one-change-record template are absent
from this checkout. Findings below are source-backed, not a compliance claim.

Only the distributed electronic copy's recipient may lock its content. The first Active
assigned user must be that recipient. Signing is Active-user, object-scoped and sequential.
Parent document/revision and copy validity must be rechecked for every operation. PDF
conversion/storage failure cannot lock content; stamp/storage failure cannot advance a
signature step. Existing token consumption and signed Distribute are retained. Artifact
versions/checksums and signature references must remain linked across the chain. A
completed execution recalls its copy without deleting the copy or historic evidence.

## Impact

GitNexus: EformEditSessionService LOW (4 direct dependants), ExecutedRecordService LOW
(3), EformSignerAssignmentService LOW (2), EformSessionFrame LOW (2 direct / 4 total,
ControlledCopyDetailView process), ControlledCopyService MEDIUM (7), EformFillRun MEDIUM
(9). ElectronicSignatureService HIGH (18); its shared authentication/signing code is not
to be changed. Call-graph evidence is not proof of Java runtime behavior.

## Evidence and outstanding decisions

Owner approved retaining the DOCXF workflow for runs already in progress. Protocol is
read from the run, not from mutable copy configuration. Owner also explicitly approved
the HIGH-impact requireWorkingSession change (10 dependants, 5 direct callers,
sourceFile flow). startFillSession, completeFillStep and applyCallback each have one
direct caller and LOW impact.

Implemented foundation: explicit-placeholder scanner, protocol/locked-PDF metadata,
signature-step linkage and external-write journal schema. PDF_V1 is not activated on
new runs yet. Conversion/stamping/signing API, frontend integration, final record
creation and full end-to-end flow remain incomplete.

Implemented DOCXF guard: a locked PDF rejects editor config, token-authenticated source,
force-save, callback and legacy submit; a PDF_V1 signer phase cannot reopen DOCXF or
use legacy submit. Existing LEGACY/null-protocol runs retain the old behavior. PDF_V1
callback takes and refreshes run -> session write locks before checking/writing. The
future PDF-lock writer must use the same lock order; it is not implemented yet.

Test-confirmed on 2026-10-03:

Command: `.\mvnw.cmd -q "-Dtest=EformEditSessionServiceTest,EformExecutionProtocolTest,EformDocxfWriteLockServiceTest,EformSignaturePlaceholderServiceTest,ExecutedRecordServiceTest,OnlyOfficeDocumentEditServiceTest" test`

- EformEditSessionServiceTest: 34 passed.
- EformExecutionProtocolTest: 3 passed.
- EformDocxfWriteLockServiceTest: 2 passed.
- EformSignaturePlaceholderServiceTest: 4 passed (includes rejected XML DOCTYPE).
- ExecutedRecordServiceTest: 8 passed.
- OnlyOfficeDocumentEditServiceTest: 7 passed.
- Total: 58, zero failures/errors/skips, Maven exit 0. Reports in target/surefire-reports.

Concurrency guard coverage is a mocked refresh/race test, not a live PostgreSQL race
test. Migration V526, storage failure/reconciliation, PDF geometry/rendering and
complete runtime workflow are NOT validated or deployed.

GitNexus detect-changes compare/main: 45 tracked files, 145 symbols, 27 flows,
CRITICAL aggregate risk. This includes extensive pre-existing owner changes, not only
this increment, and excludes untracked foundation files. No commit/push performed.

PENDING_DECISION: already distributed copies that have no active run and no explicit
signature placeholders. These cannot silently use PDF_V1 without usable slot mapping.
Owner must decide whether to require corrected template/new distribution or explicitly
extend legacy compatibility to those previously distributed copies. No automatic recall,
migration or policy extension has been performed.
