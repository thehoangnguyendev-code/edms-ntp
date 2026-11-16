# Report & Analytics: completion of 2026-11-15 (DEV, not committed)

Evidence screenshots: `evidence/report_2026_11_15/` (34 images, desktop 1500 px and phone 390 px). The detailed record of the field catalogue and of the Backup and Restore Runs work is
`REPORT_FIELD_CATALOG_2026_11_15_CHANGE_RECORD.md`; decisions are in the Decision Log (`REPORT-FIELD-CATALOG-2026-11-15`); the Backup side is in SDS-BR-001 section 23.9.

## Done in this step
- Stale-copy alert: when the copy of the backup run summary is not refreshed for 30 minutes the backend tells the agent (`POST /internal/alerts/external`, only `REPORT_COPY_STALE` accepted) and the agent raises the alert with its normal rules (migration V37 of the agent). The Create Report screen of a Backup and Restore Runs template shows the state (`GET /reports/backup-copy-status`).
- Excel export for Backup History, Production Restores and the Restore Tests tab (also on phone).
- Guard test of the filter layout (`src/__tests__/filterLayoutStandard.test.ts`, 48 screens).
- Removed the unused `/reports/templates/layout/preview-page` endpoint and its test; repaired the schema set-up of `ReportTemplateDatabaseTest`.

## Faults found and fixed
- `sensitiveNote` had been placed between `@Transactional` and `queueRun` (queueRun lost its transaction); fixed, guarded by `ReportFieldCatalogTest.queueingARunIsStillTransactional`.
- Alert severity MEDIUM is not accepted by `backup_alert`; now WARNING (found only when the failure was simulated on DEV).
- Search and group filters disabled on a read-only template; narrow-card filter layout; missing Export on phone.

## Follow-up of the same day (open items finished)
- `ReportTemplateDatabaseTest`: all 24 pass (0 before). Schema set-up repaired (later migrations V578-V590, V580, V757, signature and run-lease services, stub tables, triggers that mark a saved template approved and effective); run criteria given the mandatory filter; the layout test rewritten for charts-only templates; the pinned-run test no longer changes the template after queueing (a changed template now makes the run obsolete, REPORT-OBSOLETE-REVISION-2026-11-12, covered in `ReportRunRevisionAndSignatureTest`).
- Frontend: 10 tests outside Report repaired; whole suite passes (278 files, 1588 tests).
- Alert recipient: `admin` added again through `POST /backup-restore/alert-recipients` (audited); a stale-copy alert was raised again on purpose and a real in-app notification "Backup alert: REPORT_COPY_STALE" reached admin; the test alert was acknowledged and the copy restored.
- GitNexus (root index `edms-ntp`): impact of ReportMetadataProvider HIGH (23 implementing classes; additive default methods), ReportTemplateService MEDIUM (7), ReportPlatformService MEDIUM (9), BackupRunSummarySyncService LOW, TableExcelExportController LOW. `detect_changes` against main does not list the Java symbols of this change; compare the file list by hand before the commit.

## Open
- Wording of the GMP notice on report files (QA to confirm; see Decision Log REPORT-GMP-NOTICE-2026-11-12). The Document Control visibility question is not open: it was decided and built (REPORT-DC-VISIBILITY-2026-11-12).
- Nothing is committed.
