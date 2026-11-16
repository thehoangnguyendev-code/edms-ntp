# Change record: Report field catalogue (REPORT-FIELD-CATALOG-2026-11-15)

Status: built and checked on DEV; **not committed**. Owner decision: Decision Log `REPORT-FIELD-CATALOG-2026-11-15` (options A + C + D, personal data allowed to whoever may author a template, limit 30 columns).

## What changed
- Report Types offer more metadata fields (Document Register, Revisions, Controlled and Uncontrolled Copies, Users and Access Profiles, Training Activities, Electronic Signatures, Access Review), each with a group; fields that describe a person are labelled Sensitive.
- A report carries at most 30 columns: refused at save (`REPORT_COLUMN_LIMIT_EXCEEDED`) for the required and default columns of a template, and at the run for the chosen columns.
- A new template allows the Core group (the columns a type had before); an existing template keeps what it allowed, a field added later is not allowed until its author allows it through a new revision.
- Screens: Fields & Defaults (search, group, Allow/Remove Shown, Sensitive label, count of default columns) and Create Report › Included columns (same filters, count, limit).

## Source
Backend: `ReportMetadataProvider` (`fieldGroups`, `sensitiveFields`, `MAX_REPORT_COLUMNS`), the seven providers above, `ReportQueryKit.person/yesNo`, `ReportTemplateService` (`sources`, `groupsOf`, `withFieldCatalog`, the limit at `save` and at `fields`), `ReportTypeService.detail`.
Frontend: `features/report/shared/reportFieldCatalog.ts`, `ReportFieldFilters.tsx`, `ReportTemplateEditor.tsx`, `ReportTemplateRun.tsx`, `services/api/reportTemplates.ts`, `reports.ts`.

## Impact analysis
GitNexus index is stale: it does not know the Report classes (`impact` returned "not found" for `ReportMetadataProvider`, `ReportTypeService`, `ReportTemplateService`), and `detect_changes` was not run. Callers were found by search instead: `sources()` (one controller call), `labels()`/`requiredFields()` (template service, type service, tests), frontend `reportTemplatesApi.sources()` (editor only). The change is additive (new keys in the JSON, new default methods); no existing key changed. **Re-index and run `detect_changes` before the commit.**

## Evidence
- Real database (DEV Postgres, read-only select): `ReportDocumentSourcesDatabaseTest` runs the SQL of every column of every Report Type with every scope and filter: pass.
- Provider unit tests 244 pass (document, security, training sources, metadata, field catalogue, analytics, overview, audit source). New `ReportFieldCatalogTest`: every group and sensitive field is a real column.
- Guard tests changed on purpose: e-mail, phone, date of birth, address, identity number, gender, nationality and IP address may be columns only as Sensitive fields; reasons of lifecycle steps and the remarks/exemptions of a training activity are allowed. Still refused: password, history, tokens, avatar, preferences, file paths, storage keys, checksums, descriptions, distribution lists, signed content.
- API on DEV: 31 and 34 default columns refused with `REPORT_COLUMN_LIMIT_EXCEEDED`, 30 passes to the signature step (nothing saved). A Users template with Email, Phone, Date of Birth, Identity Number was created, submitted, then removed (test record RPT.0026, soft-deleted; its audit records remain).
- Frontend: `tsc` clean; report tests 144/144 (new `reportFieldCatalog.test.ts`, 6 tests).
- Screens checked on DEV with screenshots: new template (desktop, phone), search with Sensitive labels, an effective (read-only) template with the new fields offered and not allowed, Create Report Included columns (desktop, search, phone).

## Defect found and fixed during the check
The search and group filters sat inside the disabled fieldset, so a person viewing an effective (read-only) template could not use them; they now work in read-only and only the tick boxes and bulk buttons are disabled.

## Second step (owner: extend the remaining sources; audit the sensitive columns of a run)
- Extended: Training Participants, Audit Trail, Authentication Events, Knowledge Share. Training Records, Training Compliance, Backup Activity, Storage Usage had nothing more to add from their tables. Left out on purpose: Audit Trail old/new values and raw user agent, training record content hash, authentication JSON details.
- A run that exports Sensitive columns is written to the Audit Trail with their names (`ReportPlatformService.queueRun`, and the scheduled run in the schedule worker, which had no Audit Trail line before and now has one when a Sensitive column is exported).
- Evidence on DEV: a Users template (Email, Phone) was created, submitted, approved by `approver.test1`, run by `admin`: the run finished, the CSV holds the Email and Phone columns, the Audit Trail line reads "...; 4 rows; exports sensitive columns: Email, Phone". The template (RPT.0027) was disabled and deleted afterwards; its records remain. Unit test `ReportFieldCatalogTest` covers the text. Provider tests: 485 run, only the 24 `ReportTemplateDatabaseTest` setup errors that failed before.
- A **scheduled** run with Sensitive columns was not executed on DEV; the code path is read, not run.

## Third step (owner: do what was not done)
- Scheduled run: verified on DEV (schedule due, worker ran it, Audit Trail line "Scheduled report run; exports sensitive columns: Email, Phone"); test schedule and template removed.
- **Defect I introduced and fixed**: the helper `sensitiveNote` was first placed between `@Transactional` and `queueRun`, taking the transaction from `queueRun`; found when reading the file, moved above the annotation, and `ReportFieldCatalogTest.queueingARunIsStillTransactional` now guards it. The first deployed build (a few runs on DEV) had the defect.
- New sources: Report Runs, Training Job Assignments, Training Job Roles, Notification Delivery, System Announcements. Each was authored, approved (`approver.test1`) and run on DEV with the file read: all five completed with their columns; Notification Delivery was a signed run and its Audit Trail line named "Recipient Email". The five test templates (RPT.0029 to RPT.0033) were disabled and deleted. Source SQL runs against the real schema for every scope and filter (DB test, 20 types now).
- Training Matrix Requirements source added after the owner asked for the rest: authored, approved, run on DEV (file read), template RPT.0034 removed; 222 provider tests pass.
- **Backup and Restore Runs (REPORT-BACKUP-RUNS-2026-11-15)**, owner chose both the copy and the read-only login: agent view `reporting.run_summary` (V36), operator script `report-reader-role.sh`, backend `BackupRunSummarySyncService` + `backup_run_summary` (V786) + report type `BACKUP_RUNS`, and Excel export for Backup History, Restore Tests and Production Restores (`BackupTableExportSource`). Evidence on DEV: the login reads the view (201 lines), is refused on `backup_run` and cannot write; the first pass copied 201 lines (69 backups, 106 verifications, 6 restores, 18 rehearsals, 2 scrubs); a template on `BACKUP_RUNS` was authored, approved, run and the CSV read (template RPT.0035 removed); the three exports return xlsx with the same rows as the lists (65 completed backups, 18 rehearsals, 2 restores), each audited with its SHA-256, and `user.a.test` gets 403. Tests: `BackupRunSummarySyncServiceTest`, `BackupTableExportSourceTest`, `TableExcelExportControllerTest`, provider tests (226). Screens checked: Backup History (desktop, phone). Not photographed: Production Restores and the Restore Tests tab. Open: see SDS-BR-001 section 23.9 (delay of up to 5 minutes, deleted lines stay, no alert when the copy fails, DEV only).
- The agent was restarted on DEV to apply V36 (no job was running).
- GitNexus: the index was corrupt (full-text index); rebuilt with `analyze --force`. `detect-changes` against main shows 274 files, 754 symbols, 57 flows, risk critical: that is the whole uncommitted tree (other work included), and the index does not resolve the Java Report symbols, so my change cannot be isolated by it. The impact was read by search instead (see above).

## Not verified / open
- `ReportTemplateDatabaseTest` (24 tests) fails in setup (`REPORT_SIGNATURE_UNAVAILABLE`): the test builds the service without the signature service; failing before this change, not fixed here.
- Not built: backup and restore runs as a source (control database).
- Sensitive fields are labelled, not separately permitted (owner decision); the Audit Trail of a run names the sensitive columns exported.
- Mobile layout checked for the two screens above only. The field list is filtered in the browser (a fixed catalogue of at most about 50 rows per type), not on the server.
