# Change record: Controlled Copy usage purpose (CC-PURPOSE-2026-10-07)

Decision: `CC-PURPOSE-2026-10-07` in `docs/governance/DECISION_LOG.md`. Design: `CC_USAGE_PURPOSE_2026_10_07_DESIGN.md`.

## What changed
- DB: `V555__controlled_copy_usage_purpose.sql` (nullable `usage_purpose`, CHECK on two machine values) on copies and batches. Legacy rows stay NULL.
- Backend: the request refuses a missing/unknown purpose; purpose is stored on batch and copies, written in the REQUEST audit entries, inherited by replacement copies; list/batch/export filter + sort + CSV column; recall by scan: READ_AND_COMPLY copy is recalled, no Record, notice at review, audit comment; Records list/detail/preview/download hide records of READ copies.
- Frontend: required card RadioGroup (no preselection) in Request Controlled Copy and in the e-signature summary; Purpose column, filter (standard/compact/mobile drawer) and detail field; Purpose column in the document Controlled Copies sub-tab.

## Evidence
- `./mvnw -o test -Dtest='ControlledCopy*Test,ExecutedRecord*Test,UncontrolledCopy*Test,DocumentFiltersIntegrationTest'`: 311 run, 0 failures, 0 errors, 1 skipped (includes 14 ControlledCopyEndToEnd tests with the new negative cases: missing/unknown purpose, legacy copies, READ recall without Record, stray record hidden).
- Frontend: `tsc --noEmit` clean apart from the known `ReportLists.test.tsx` issue; vitest on `src/features/documents` and `src/components/ui/filter` pass, plus new `usagePurpose.test.ts`.
- Docker rebuilt; backend healthy; Flyway V555 applied successfully.

## Not verified / limits
- No browser check of the screens (layout/responsive verified by structure only).
- Replacement-inherits-purpose verified by code reading only.
- CSV export column not exercised by a test.
- GitNexus impact/`detect_changes` not available in this environment.
- Nothing committed. Concurrency: no new concurrent path; purpose is set once at request time.

## Amendment 2026-10-07 (owner instruction): Recall by Scan and read-only copies
Supersedes the earlier behaviour "a READ copy in a scan is recalled normally without a Record".
- Any scan can still be uploaded. A scan whose copy (identified by copy number or QR) is READ_AND_COMPLY is marked BLOCKED with `readAndComply=true`, shown apart on the screen (blue "Read only" panel), and holds the batch until the DCO removes it (one click = exclude; "Remove all" when several).
- The remaining record-keeping scans are recalled and filed as Records as before. A READ copy is never recalled by scan and never gets a Record; it is recalled by hand from Controlled Copies.
- Evidence: ControlledCopyEndToEndIntegrationTest 14/14, ControlledCopyRecallBatchServiceTest 34/34, ControlledCopyRecallByScanIntegrationTest 3/3; vitest recall-scan 20/20 (new case for the read-only panel and Remove); tsc clean except known ReportLists.
- Not verified in a browser.
