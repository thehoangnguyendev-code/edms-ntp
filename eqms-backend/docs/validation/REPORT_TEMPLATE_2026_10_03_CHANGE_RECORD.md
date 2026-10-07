# REPORT-TEMPLATE-2026-10-03

Status: implemented and deployed to local Docker for owner UAT; not production-released or GMP-validated.
Owner decision: ../governance/DECISION_LOG.md#report-template-2026-10-03--role-scoped-metadata-reports

## Intended change and invariants

- UI variant B; existing UI primitives, responsive catalog and guided execution.
- Active users + report permissions + explicit active Access Profile grants; deny by default.
- Metadata visibility does not change Document/Revision/Controlled Copy content authorization.
- Server-owned allowlisted filters/sort, bounded pagination and output; no arbitrary query input.
- Template version and execution criteria pinned; current scope rechecked at generation/download.
- Mandatory transactional configuration history/audit; preserve previous runs and artifacts.
- Existing retention and source lifecycle remain unchanged; no signatures fabricated by reports.
- Initial provider: DOCUMENT_STATUS; extensible provider contract for future modules.

## Evidence limitations

The referenced `docs/system/00_EVIDENCE_CONVENTIONS.md`, As-Is assurance documents,
and `docs/validation/08_ONE_CHANGE_RECORD_TEMPLATE.md` are absent in this checkout.
This record uses explicit intended change, invariants, risk, tests and residual-risk sections
instead; absence is not treated as evidence of compliance.

## Risk and impact

GitNexus: ReportPlatformService MEDIUM (two controllers and ReportJobWorker imports/construction).
renderRows LOW (preview and queued worker); queueRun LOW (run controller);
processOneQueuedRun LOW (ReportJobWorker); reauthorizeArtifactScope LOW (download path).
Existing unrelated uncommitted eForm retirement and optional-review work must be preserved.

## Test evidence

Executed 2026-10-03 on the development workstation:

- Backend: `mvnw.cmd -q -Dtest=ReportTemplatePermissionBoundaryTest,ReportTemplateApiTest,ReportTemplateDatabaseTest,ReportMetadataProviderTest,ReportPdfRendererTest,ReportScheduleOwnershipScopeTest test`.
  **34 passed, 0 failures, 0 errors, 0 skipped**. PostgreSQL integration explicitly opted in via
  EQMS_REPORT_TEST_DB/USER/PASSWORD (credentials not recorded); private random schemas only,
  removed in cleanup. Test fixture includes actual V359/V361/V392/V530/V531 migrations.
- Frontend: `npx vitest run src/features/report/templates/__tests__/ReportTemplates.test.tsx`:
  **4 passed**. Tests cover server search, criteria/preview/queue contract, duplicate-request
  protection on network retry and atomic configuration/version/role payloads.
- `npx tsc --noEmit`: passed. `npx vite build`: passed; existing large-chunk warnings remain.
- `docker compose build backend frontend`: passed; Java 21 clean package in backend image.
  Only FE/BE services recreated with `up -d --no-deps`; database/storage services untouched.
  Flyway applied V530/V531 successfully (schema 531); subsequent startup validates existing
  migrations and reports no migration necessary. Backend health/startup checked.
- Unauthenticated GET `/api/reports/templates`: runtime 403; no catalog disclosure.
- PDF regression: 120 long Vietnamese rows, final END-119 present, 14 landscape pages.
  First/middle/last-page rendering inspected using Poppler; ordinary rows kept together, wrapped
  text and repeated column headings visible. This fixture is synthetic and never app data.
- `git diff --check`: passed (line-ending warnings only). GitNexus `detect-changes --scope compare
  --base-ref main --repo edms-ntp`: 50 tracked changed files / 111 indexed symbols / 19 flows,
  CRITICAL across the **combined existing workspace**, including preexisting Document Control,
  eForm retirement and optional-review changes. Not an isolated report-only result; new untracked
  report symbols are not in the old index. No commit or push performed.

Coverage includes all four metadata scopes, active-role revocation, missing permission/account,
hidden lookup/filter/sort rejection, SQL parameter binding, invalid date ranges, page size/count,
required columns, optimistic version conflicts, transaction rollback on mandatory-audit failure,
idempotent requests and conflicting key reuse, CSV formula neutralization, Unicode PDF, XLSX,
checksum mismatch, output-format revocation, worker publication/event rollback, stale attempt
fencing, storage retry journalling, scope revocation before generation/download, HTTP 400/403/409,
and denial despite a stale cached action-permission grant. Storage in automated end-to-end worker
tests is an in-memory mock; **not evidence of actual MinIO fault recovery or WORM validation**.

Source trace: `ReportTemplateController`, `ReportAccessExceptionHandler`, `ReportTemplateService`,
`ReportMetadataProvider` / `DocumentReportMetadataProvider`, `ReportPlatformService`,
`ReportArtifactPublisher`, `ReportPdfRenderer`; V530/V531; FE `reportTemplates.ts` and template
catalog/editor/run/lookup components. Existing Document/Revision authorization, content routes,
signature and lifecycle services are not modified by this report change.

Owner procedure and API details: [REPORT_TEMPLATE_API_AND_UAT.md](REPORT_TEMPLATE_API_AND_UAT.md).

## Residual risk / release gate

No regulatory-compliance assertion. Production release requires approved URS/risk assessment,
validated environment, access configuration, representative data/UAT and retention verification.

- Browser remains at login; no owner credentials supplied. Authenticated UI, actual-account role
  assignment, 375px visual UAT and actual MinIO download/generation remain pending. The ui-ux
  visual-check gate therefore cannot be claimed complete from component tests/builds alone.
- No role receives an implicit scope. Configure approved role grants before the first real run.
- Only Document Register is implemented; other providers must be registered/tested deliberately.
  Existing Scheduled Reports UI is retained; its full business/UAT rollout is not this change.
- Generation creates a new dataset snapshot; preview does not freeze live source data. Date-only
  Created criteria use the database session timezone; validate the deployment timezone in UAT.
- Existing retention policies are preserved; no new purge period. PENDING object-publication
  journal entries require operator review. No automatic orphan-file deletion is introduced.
- The API and new schema are locally tested; load testing, retention/WORM, disaster recovery and
  independent validation sign-off have not been completed.

Regulatory reference reviewed: European Commission, published [EU GMP Annex 11](https://health.ec.europa.eu/system/files/2016-11/annex11_01-2011_en_0.pdf).
Its risk/validation, access, audit, change-control and retention expectations inform engineering
checks; this record does not certify compliance or treat consultation drafts as approved rules.
