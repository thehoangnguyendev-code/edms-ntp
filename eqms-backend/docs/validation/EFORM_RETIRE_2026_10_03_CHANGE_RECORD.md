# EFORM-RETIRE-2026-10-03

Owner decision: remove electronic Forms, DOCXF design/fill/sign and FormSettings; invalidate existing sessions; retain all data/files/audit. Preserve ordinary DOCX online editing, paper Controlled Copies, scanned Executed Records and other electronic signatures.

Supersedes the active functionality of EFORM/FORMS/FORM-EDITOR decisions; those decisions and their evidence remain historical.

## Invariants

- Actors retain existing document/copy permissions and object ownership checks. New requests and distribution accept paper only, including direct API requests and stale clients.
- Paper scan capture retains its Effective-source check, usable-copy status, duplicate check, RECORD_LOGGED signature and audit. Legacy pending records retain existing approval/rejection; no terminal record is changed.
- No changes to ordinary document/revision workflow or parent/child recall rules. No automatic conversion of historical electronic copies to paper.
- File objects, checksums, version IDs, signatures and existing audit remain unchanged. Migration snapshots prior nonterminal session/run state before invalidation.
- Retired sessions/settings are DB read-only, and their source/callback endpoints are removed. Async paper generation remains available; no eForm generation remains.

## Evidence status

Not a regulatory-compliance claim. Implementation uses the validation-engineering skill to preserve stable history, permission checks, signatures and audit instead of deleting regulated evidence.

Referenced As-Is evidence directory and change-record template are absent in this checkout; this record explicitly captures the decision/invariants without claiming equivalence to missing evidence.

Pre-change runtime: 5 ACTIVE + 2 SAVED sessions, 3 ABANDONED sessions; 0 fill runs; 3 settings rows; no ELECTRONIC Controlled Copies; one PAPER_SCAN PENDING_APPROVAL record. All preserved except explicit nonterminal session invalidation.

## Source and test evidence (2026-10-03)

- Removed eForm/FormSettings controllers, services, repositories, mapped workflow entities, DTOs, frontend routes/menu/API modules and design/fill/sign UI. Ordinary OnlyOffice document editing/conversion stays.
- `ControlledCopyService.requestControlledCopy`: authenticated actor, reject non-PAPER before document/file/signature processing. Single/batch distribution and async finalization reject historical electronic copies; paper expiry/authorization/lifecycle remain.
- `ExecutedRecordService`: paper capture decoupled from settings; stable FORM short code, ownership, Effective revision, copy status, duplicate, file/signature/audit checks. Legacy approval/rejection meaning codes and SoD code remain historical, not an eForm entry point.
- V529 snapshots 7 prior session rows, abandons active/saved sessions and in-progress runs, makes archive tables read-only and prevents new electronic copy/record capture. Existing migration files unchanged. No file deletion or storage cleanup.
- TypeScript check and frontend production build: PASS. Targeted FE tests: 6 PASS (DOCX/no-format links, blocked DOCXF/unsupported links, date/file/signature preservation and upload/removal).
- Focused BE regression: 74 PASS across EformRetirementContractTest (4), ExecutedRecordServiceTest (7), OnlyOfficeDocumentEditServiceTest (6), DocumentLifecycleBaselineTest (23), OptionalReviewWorkflowTest (10), ControlledCopyBatchDistributionAsyncServiceTest (1), ControlledCopyObsoleteRaceTest (23).
- Full BE run at that revision: 1,012 tests, 2 failures, 0 errors. Failures: PermissionDependencySeedDataIntegrationTest.seedData_containsExpectedRowCount (42 expected, 40 actual), Sprint10AuthorizationHardcodeRegressionTest.navigation_withoutPermissionsGetsEmptyMenu (Calendar present). Outside eForm removal paths; not repaired or claimed pre-existing without separate baseline run.
- PostgreSQL `src/test/resources/eform-retirement-assertions.sql`: PASS, all probes rolled back. Confirms prior row preservation including timestamps as instants (JSON time-zone rendering differs), no usable sessions/runs, stale write/deletion rejected, electronic copy/record mutations rejected.
- Runtime after migration: 10 ABANDONED sessions, 7 immutable snapshots, 3 retained settings rows, same one PAPER_SCAN PENDING_APPROVAL record. Ordinary document/copy data and artefacts were not purged.
- Docker backend/frontend rebuilt and recreated without changing DB/MinIO/OnlyOffice volumes. Backend starts successfully and migration validation succeeds.
- GitNexus detect_changes(compare main): HIGH, 90 symbols/45 files/12 flows in the mixed dirty checkout. Includes owner's prior optional-review/sidebar/filter/signature changes; those were preserved. No commit/push performed. Index does not cover all formerly untracked eForm engine symbols; source scan, compilation and negative contract tests supplement it.

## Remaining assurance limits

No browser-based end-to-end paper request/print/scan was performed as a real user. Automated server lifecycle, ordinary editor configuration, paper capture signature/audit and stale-route/write tests passed, but the two full-suite failures above prevent claiming a fully green project regression. Historical tables, permission/meaning codes, template references and audit records intentionally remain; they are not active eForm functionality.
