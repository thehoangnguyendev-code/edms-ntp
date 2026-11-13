# REPORT-FULL-RUN-2026-11-12 — Report phase R1: a filter is required; Full is a choice

Status: built and checked on DEV; **not committed**. Plan: `docs/plans/KE_HOACH_HOAN_THIEN_MODULE_REPORT_2026_11_11.md` (R1). Owner decision D3 (2026-11-11): a filter is mandatory, and "Full" is a choice when running (background, Audit Trail, no extra permission). This is not a GMP approval.

## Change
- DB V757: `report_properties.max_rows_full` (default 100,000), `report_runs.full_run`.
- A run (and a schedule) needs at least one filter with a value, unless the run is Full (`REPORT_FILTER_REQUIRED`). A schedule is never Full.
- The size is checked when the run is requested (`REPORT_ROW_LIMIT_EXCEEDED`, `REPORT_FORMAT_ROW_LIMIT_EXCEEDED`), and again by the worker. Above the ordinary limit only CSV and XLSX can be made.
- Full is pinned in the run snapshot, stored in `report_runs.full_run`, and written in the Audit Trail text of `REPORT_RUN_QUEUED` with the row count.
- Report Properties: "Most rows in a report file run with Full" (10,000 to 100,000, not below the ordinary limit); changes are audited.
- Screens: Create Report (filter-required note, Full choice, limits, formats, no page preview for a large result), Report Properties, Run History (Run type), Run Detail, Schedule note. Fixed on the way: the preview table was empty (its column layout was made before the columns existed).

## Assistant decisions, to confirm
- Full ceiling is **100,000**, not the 200,000 proposed in the plan: the backend heap on DEV is 768 MB and a report is held in memory. Raising it needs a memory test.
- Existing schedules without a filter are not changed; they keep running under the ordinary limit. Only creating or editing a schedule requires a filter.

## Invariants and evidence
- Authorization is unchanged: scope, type permission and template approval are still checked at request and at run time.
- Unit/API tests: `ReportFullRunPolicyTest` (7), `ReportPropertiesTest` (9, includes Full limit range and audit), `ReportArtifactPublisherFailureTest`, `ReportLayoutApiTest` (4; two stale tests repaired), report-wide tests green except `ReportTemplateDatabaseTest`, which is opt-in (`EQMS_REPORT_TEST_DB`) and fails in its own setup with `REPORT_SIGNATURE_UNAVAILABLE` (not caused by this change, not repaired).
- Frontend: tsc clean; report tests 71 pass (3 new).
- DEV runtime: no filter → 400 `REPORT_FILTER_REQUIRED`; blank filter → same; filter → 202; Full CSV → 202 and COMPLETED with 10,796 rows (above the old 10,000 limit), `full_run = true`, Audit Trail text "Full run (no filter required), 10796 rows"; Full PDF → 400 `REPORT_FORMAT_ROW_LIMIT_EXCEEDED`.
- Screenshots: `evidence/dcv_2026_11_07/shots/R1__*.png`.

## Not verified
- A non-Full run above 10,000 rows (DEV has no filter that yields it); the row-limit refusal is covered by code and by the worker check only.
- A real run above 10,000 rows in XLSX; memory use of a 100,000-row Full file.
- GitNexus `detect_changes` (index is stale); impact for the edited symbols was LOW (`queueRun`, `render`, `snapshot`, `createSchedule`, `maxRows`, `ReportMetadataProvider`, `ReportPropertiesService`).
