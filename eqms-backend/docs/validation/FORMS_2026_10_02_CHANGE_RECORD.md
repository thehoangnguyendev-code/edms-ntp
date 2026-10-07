# FORMS-2026-10-02 change record

Date: 2026-10-02. Status: implemented source changes; local regression tests passed; deployment/runtime validation pending.

## Approval and baseline

Approved decision: [FORMS-2026-10-02](../governance/DECISION_LOG.md). Changes were requested and approved in the project-owner conversation. Existing unrelated working-tree changes were preserved.

The repository's referenced `08_ONE_CHANGE_RECORD_TEMPLATE.md` and evidence conventions file were not available. This record explicitly captures decision, invariants, source/test evidence and outstanding validation instead of asserting conformity to an unavailable template.

## Invariants

- Actor/object scope: design/commit rechecks document revision edit scope. Fill is bound to the distributed electronic copy's recipient. Signing requires that copy's assigned current role (existing admin override retained). Owner checks remain on authenticated session operations.
- Lifecycle: working sessions must be ACTIVE/SAVED, their run IN_PROGRESS, the copy DISTRIBUTED and not expired, its pinned revision EFFECTIVE and parent document ACTIVE. Checks occur on configuration, source-file retrieval, save callback, force-save and completion. Submitted/abandoned sessions cannot be reused.
- Parent-child effect: no new recall job; existing copy recall is reused, and subsequent eForm requests fail once source/copy becomes invalid. These request guards do not erase a PDF already delivered to a browser or physical paper.
- Artefact: seed and scan the copy's pinned revision, not an arbitrary newest revision. Accumulate saved artefact metadata/checksum per signed step. Convert the completed DOCXF to PDF, check PDF magic and store converter bytes before making the execution record. Never rename DOCXF as PDF.
- Audit/e-signature: retain signature service and single-use signing flow. Intermediate-step audit attaches its actual signature ID. New execution records are EXECUTED; legacy Pending Approval records and approval/rejection endpoints remain. Historic settings columns remain intact.
- Concurrency: existing fill-run optimistic version is retained; V524 enforces one active run per copy and positive, unique signing sequence per copy. No historical duplicate is silently deleted to make migration pass.
- Cancellation: abandoning recipient data entry at sequence zero releases the unsubmitted run; closing a signer session does not cancel the accumulated chain. Submitted sessions cannot be abandoned.
- Async/editor: callbacks recheck session/run/source eligibility before storing. No scheduled generation/recall workflow was replaced.

## Source changes

- `service/EformEditSessionService.java`: design scope, pinned template, recipient gate, sequence-zero gate, working-session lifecycle checks, intermediate audit ID, safe data-entry cancellation.
- `service/EformSignerAssignmentService.java`: role scan uses the copy's Effective revision.
- `service/ExecutedRecordService.java`: actual PDF conversion/storage and retirement of additional approval for new submissions.
- `service/FormSettingsService.java`: reject re-enabling retired approval, hide it in response while retaining compatibility fields and historic DB columns.
- `service/OnlyOfficeDocumentEditService.java`: add authorized role to editor configuration before signing its JWT.
- `db/migration/V524__guard_eform_signing_concurrency.sql`: active-run and sequence constraints.
- FE `FormSettingsCard.tsx`, `FillEformFrame.tsx`, `AssignEformSignersModal.tsx`: remove retired controls, clarify submit action, allow a scanned zero-role template to continue. Existing component styling was preserved using the ui-ux small-component approach.

## Local evidence

Commands run from backend:

`./mvnw.cmd -q -DskipTests compile`

`./mvnw.cmd -q -Dtest=EformEditSessionServiceTest,ExecutedRecordServiceTest,OnlyOfficeDocumentEditServiceTest,ControlledCopyAuthorizationServiceTest,ControlledCopyAuthorizationServiceCutoverTest test`

Results: 43 tests passed initially; after two cancellation regressions were added, the first three suites were rerun successfully (17 + 8 + 7). Together with the unchanged authorization suites (6 + 7), 45 distinct focused tests passed. No failures/errors/skips in these reports.

Relevant new tests cover: no signer before recipient submit; recalled copy rejects already-open editor config; callback cannot overwrite submitted session; revoked document edit authorization; cancelled data-entry run released; submitted chain cannot be cancelled; converter bytes stored as actual PDF; invalid converter output rejected without storing/signing; role included in signed JWT.

Frontend: TypeScript `npx tsc --noEmit` passed; focused FormSettingsCard/FormSettingsAdministrationView suites passed (7 tests). `git diff --check` passed. GitNexus detect-changes reviewed the dirty tree, including prior unrelated navigation/settings edits; output is not a complete Java call-graph proof (method resolution limitations). Class-level impact was CRITICAL and owner approved the scope before implementation.

## Pending evidence / limitations

- V524 has not been applied to the running database. Preflight duplicate active runs/sequence assignments before deployment; migration intentionally fails instead of destroying historical rows if conflicts exist.
- Docker/OnlyOffice was not rebuilt/restarted; no browser visual or end-to-end signing test was performed.
- OnlyOffice `editorConfig.user.roles` is documented for PDF form filling. Current workflow uses DOCXF. Unit tests prove config/JWT content only, not installed-editor enforcement of field-role restrictions. Verify role-restricted editing with the installed OnlyOffice version/edition before accepting this workflow for use. Plain typed role titles do not auto-create structured signature fields.
- Lifecycle guards recheck requests, but database integration testing for simultaneous recall versus save/submit remains outstanding; this record does not claim that all races are eliminated.
- Legacy unbound fill sessions fail closed and require reopening a distributed copy; their stored files/history are not deleted.
- Single-use signature service remains unchanged; live username/password, signature manifestation and PDF signature-position mapping need end-to-end evidence.

No claim of EU-GMP compliance or production validation is made by this record. No commit/push was performed.
