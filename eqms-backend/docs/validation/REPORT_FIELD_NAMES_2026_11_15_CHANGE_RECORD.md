# Change record: five report field names (REPORT-FIELD-NAMES-2026-11-15)

Status: built on DEV; **not committed**. Decision: Decision Log `REPORT-FIELD-NAMES-2026-11-15` (owner decision; QA has not confirmed).

## What changed
`Created` -> `Created At` (Document, Revision, Controlled Copy, Uncontrolled Copy, User Access); `Training Required` -> `Required Training` (Training Compliance, Training Matrix: field `requirement`); `Record` -> `Record Status` (Training Records: column and filter); `Organisation (External)` -> `Organization (External)` and the Training assignee picker word `Organisation` -> `Organization`; Revision Lifecycle `Updated At` -> `Last Updated`. No `field_code` changed.

## Source
Backend: `ControlledCopy`, `Document`, `Revision`, `UncontrolledCopy`, `UserAccess`, `TrainingCompliance`, `TrainingMatrix`, `TrainingRecord`, `TrainingParticipant` `ReportMetadataProvider`; `V791__report_field_display_names.sql`. Frontend: `TrainingAssigneePicker.tsx`.

## Impact analysis
GitNexus `impact` on `edms-ntp`, upstream: `DocumentReportMetadataProvider`, `TrainingMatrixReportMetadataProvider`, `TrainingRecordReportMetadataProvider`, `TrainingParticipantReportMetadataProvider`: LOW, 0 callers (found by the registry at start-up). The edits are display strings; no function logic changed. `detect_changes` not run (nothing committed; the tree is large).

## Evidence
- `ReportFieldCatalogTest` (71, +7 new: no source keeps an old name, the named fields say what they hold, the documents' Yes/No `Training Required` is kept), `ReportMetadataProviderTest`, `ReportDocumentSourcesTest`, `ReportTrainingSourcesTest`, `ReportSecuritySourcesTest`: pass.
- Migration dry run on the DEV database in a rolled-back transaction: 12 `Created` -> `Created At`, 2 `Training Required` -> `Required Training`, 1 `Record` -> `Record Status`, 1 organisation, 1 Revision Lifecycle, 2 snapshots of open revisions; the Yes/No `Training Required` of the documents (5 rows) untouched.

## Not done / residual risk
- The Database tests (`ReportTemplateDatabaseTest`, `ReportDocumentSourcesDatabaseTest`) were **skipped** in this run, so the migration against the real revision tables was verified only by the dry run above and by the start-up of the backend on DEV.
- Reports already generated keep their old column names.
- Other `Record` columns (Audit Trail, Backup Activity) and the filters `Created from` / `Created to` were not part of this decision and keep their names.
