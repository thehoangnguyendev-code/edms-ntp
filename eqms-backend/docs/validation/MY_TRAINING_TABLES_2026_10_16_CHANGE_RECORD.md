# My Training: tab extraction and server-side tables

Date: 2026-10-16. Owner request: rename TrainingMyTrainingView.tsx to MyTrainingView.tsx, extract the three tabs, and provide search, filters, sorting and pagination like existing list screens.

## Invariants

- Read-only personal data: actor identity is supplied by CurrentUserService. Every table requires training.self.view and restricts its SQL to the actor before search/count/paging. Neither a query parameter nor an elevated department scope selects another person.
- Signature requests include pending assignments addressed to the actor plus pending receiver signatures on the actor's own job assignments. The FE no longer merges a partially paged general job list.
- Lifecycle, parent/child effects, stored artifacts/checksums, audit, electronic signature validation and async jobs are unchanged. Existing unpaged endpoints remain available to other callers. No schema migration is required.

## Implementation and impact

- GitNexus rename was previewed and applied for TrainingMyTrainingView to MyTrainingView; the dynamic route import and export were updated. The main file imports MyTrainingTodoTab, MyTrainingSignaturesTab and MyTrainingRecordsTab.
- The tabs reuse ReportListToolbar (ConfiguredDesktopFilters / mobile FilterDrawer), DataTable, Custom Column, useTableDragScroll and TablePagination, with ten rows initially.
- New read-only /training/me/{tasks,approvals,records}/table API uses bound filters/search/date values, allowlisted sort columns/direction, stable tie-break ordering, SQL count and SQL limit/offset. Page size is capped at 100 and out-of-range pages are clamped.
- Personal records add method, result, record state and completed-date filters. Existing non-personal TrainingRecordsTable behavior remains on its prior API.
- useServerTable adds optional syncToUrl=false for independent tables inside one tabbed route. Existing callers retain the default URL synchronization. This prevents another tab's sort/page from entering the current table.
- Upstream impact: TrainingMyTrainingView LOW (no indexed direct callers); TrainingRecordsTable LOW (2 direct callers); useServerTable MEDIUM (9 direct callers, 1 indexed process). New controller and service are additive. Unrelated working-tree changes were preserved.

## Verification

- TypeScript: npx tsc --noEmit --pretty false passed.
- Backend: mvnw -DskipTests compile passed.
- Backend MyTrainingQueryServiceTest: 5 passed, including actor scope in both signature sources, escaped wildcard search, server pagination, bounded filters, sort injection/reversed dates rejection, and permission denial before DB reads.
- Frontend: 5 tests passed across MyTrainingView.test.tsx and useServerTable.tabIsolation.test.tsx. Covers server search/filter/sort/page requests, Clear Filters, tab query isolation, personal record filters and existing default URL initialization.
- GitNexus detect-changes (all tracked changes) reported LOW, 0 indexed affected processes. Its output also includes pre-existing unrelated changes and does not fully cover newly added untracked symbols.

## DEV browser verification

- Docker backend and frontend rebuilt and started successfully on 2026-10-16. All three new table endpoints executed against the DEV PostgreSQL database through the signed-in Admin UI without query errors (0 tasks, 0 pending signatures, 6 personal records).
- Personal records: searching GMP returned 2 records; combining that search with Read and understood returned 0; Clear Filters restored all 6. Sorting Topic ascending displayed GMP basics, GMP basics (test), Gowning, Read the new SOP, SOP read, Self reading.
- At a 375px viewport, document width and scroll width were both 375px. The table scrolls inside its container; the shared mobile FilterDrawer opens with Method, Result, Record and Completed date. Viewport overrides were reset after the check.
- These are DEV smoke checks, not released-environment validation. No business record, signature or assignment was modified by these checks. Real pending tasks/signatures were unavailable for a populated-row smoke test; unit tests cover their query scopes and pagination.
- Runtime logs contain async disconnected-client / text-event-stream error handling messages during browser navigation. No MyTrainingQuery or SQL grammar errors were observed. The async notification handler was not changed in this slice.

## Limitations and rollback

Unit/component tests mock the JDBC/API boundaries. They do not by themselves validate real PostgreSQL execution or a released environment. Browser/runtime results are recorded above after deployment to DEV. The referenced system As-Is and change-record template files remain absent from this workspace; this record follows the existing local evidence structure. No new business transition or signature meaning was introduced.

Rollback this slice: restore the previous My Training view/import and personal-record API choice, remove the three new table endpoints/service, and remove the optional hook setting and its tests. No business data or schema needs reverting.
