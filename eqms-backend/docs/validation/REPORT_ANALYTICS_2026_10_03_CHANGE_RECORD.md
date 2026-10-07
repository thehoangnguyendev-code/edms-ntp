# Report analytics and presentation — 2026-10-03

Decision: REPORT-ANALYTICS-2026-10-03.
Invariants: active actor, current role/field scope, server-only aggregate calculation,
immutable run/layout snapshot, checked image bytes, mandatory audit transactions,
unchanged artifact checksum/journal/retention. No document workflow or signature changes.

Verification updated: 2026-10-04 (Asia/Saigon). No GMP compliance claim. Source-backed
system evidence documents and the standard change-record template are absent here.

## Source scope

- V534 adds report title and schedule optimistic-lock version; applied in local Docker DB.
- ReportLayout, ReportImage, ReportCharts, ReportPresentationRenderer: checked images,
  bounded styles/chart configuration, full-row server aggregates, PDF/XLSX rendering.
- ReportTemplateService and preview-pdf endpoint: current metadata/field authorization,
  read-only full-scope preview, no run/artifact persistence from preview.
- ReportPlatformService: immutable title/layout/chart snapshot for runs and worker output.
- ReportScheduleAdministrationService: server search/sort/page size 10, authorized recipients,
  compare-and-set update and mandatory audit in the transaction.
- ReportLayoutDesigner, ReportTemplateRun, RealtimeReportPreview, history and schedule views:
  shared UI, abort/debounce previews, server-backed operations.
- Select.tsx: dropdown portal raised only above its owning data-drawer-overlay;
  ordinary selects retain z-index 50. No permission/API/data change in this follow-up.

## Automated evidence

2026-10-04 commands completed successfully:

- Maven focused suite: ReportAnalyticsTest, ReportTemplateDatabaseTest, ReportLayoutTest,
  ReportLayoutApiTest, ReportTemplateApiTest, ReportTemplatePermissionBoundaryTest,
  ReportMetadataProviderTest, ReportPdfRendererTest, ReportPlatformOwnershipTest.
  Surefire evidence: 47 tests, zero failures/errors/skips in the eight report service classes.
  Database tests use isolated schemas in local PostgreSQL; no production-document mutations.
- Vitest: three report template/preview test files and Select.test.tsx: 11 tests passed.
- TypeScript --noEmit and Vite production build passed. Existing large-chunk warning remains.

Coverage includes full-scope versus personal-scope aggregates, permission revocation,
immutable snapshot after template edits, rejected chart fields/images/out-of-bounds styles,
schedule sorting allowlist, optimistic concurrency rejection, audit-failure rollback,
no-cache/forbidden preview, stale preview cancellation, disabled selects and ordinary/drawer layers.
This is focused regression evidence, not an assertion that all system workflows were tested.

## Runtime evidence

- Admin browser: TEST_DOCUMENT_REGISTER saved as version 2 with status BAR chart.
  Realtime EmbedPDF preview displays the chart; FORM.9904 criteria returns one Active document.
- Generated run 009f268a-0783-45a1-a826-35c3e33fa344: COMPLETED, title
  TEST Analytics · FORM.9904, PDF 62099 bytes, three pages. History preview/download successful.
  Downloaded file SHA256 matches server:
  f1c852cbbdcf0dcdd1de6d312a2aa07aa94cb572179c205b9696ac0d5ba393a3.
- Created TEST · Analytics schedule with FORM.9904 filter, zero email recipients,
  cron 0 0 8 29 2 * (next 2028-02-29); paused it, edited report title with change reason,
  reopened and confirmed persisted values and PAUSED state. No scheduled email sent.
- Drawer dropdown selection works on desktop. At 375x812, mobile drawer and frequency
  dropdown are visible; document width equals viewport width (375), no page horizontal overflow.
  Screenshot: target/report-drawer-mobile-2026-10-04.png. Temporary viewport reset afterwards.
- Frontend Docker rebuilt/deployed with the Select fix; backend remains on verified report build.

## Impact and residual limits

GitNexus: queueRun/worker LOW (one direct caller); new report classes UNKNOWN in index.
Select CRITICAL: 119 direct callers, 37 processes; owner approved this narrowly scoped
layer fix on 2026-10-04. updatePosition LOW: two direct callers, zero affected processes.
detect-changes against main: CRITICAL, 55 files/167 symbols/19 processes, includes pre-existing
Document/Form changes outside this change record. Those changes were preserved; no commit/push.

Bounds: maximum six charts, 20 categories per chart and 10000 rows for generation/preview;
excess rejected, not silently truncated. CSV remains data-only. Mark positions are numeric/reset
controls, not a drag-and-drop canvas. Scheduler email delivery was not exercised in this runtime
check. Broader regulated release validation remains required before a compliance claim.
