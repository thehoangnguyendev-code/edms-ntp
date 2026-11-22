# Frontend regression assertions and numeric display — 2026-11-21

Status: implemented and test evidence recorded; not a QA release approval.

## Request and scope

The user requested fixing the five frontend failures reported after commit
`c9af6dbc`, explicitly preserving business logic. Existing unrelated Global Search,
Knowledge Explorer, and keyboard UI changes in the workspace are outside this record.

## Source-confirmed causes and changes

- Three WorkspaceEndButtons tests queried the old sentence-case button text. The
  button already renders `Send Attendance List to QA`. Update its queries, including
  negative assertions; keep the existing signature dialog title unchanged.
- PreviewFileTab's test expected a removed screenshot warning. Assert the existing
  download/print explanations instead, retaining saved checkbox state assertions.
  No production OnlyOffice component or setting is changed.
- The unchanged dateFormatGuard rejects `toLocaleString` with explicit arguments,
  including numeric calls. Three numeric-only displays (export record count and
  department/position employee counts) now use `Intl.NumberFormat('en-US').format`.
  The locale, grouping, values, and missing employee-count fallback are preserved.
  No exception or relaxed rule is added to the date guard.

## Invariants and boundaries

- Actor, capability/permission checks, object scope and API filtering: unchanged.
- Training lifecycle, attendance blockers, parent/child effects: unchanged.
- Sending still uses activity id, optimistic version and a confirmed signature token;
  a rejected request must leave the action available, without completing training.
- Audit, e-signature implementation, file versions/checksums and async generation:
  unchanged. No backend source, migrations or stored data changed by this work.
- Export format, selected columns, handlers and payload: unchanged; only count text
  uses an explicit numeric formatter.

## Impact and authorization

GitNexus was stale and its incremental rebuild exposed inconsistent FTS indexes.
A full `analyze --force --index-only --wal-checkpoint-threshold 67108864` succeeded.
DepartmentsTab and PositionsTab: LOW, 1 direct caller each, 0 identified processes.
TableExportModal: CRITICAL, 10 direct callers, 6 affected process groups. The user
explicitly authorized only its numeric-display expression after that report.
Test callbacks were not resolved as indexed symbols; their scope was reviewed from
the test files. Production Training/OnlyOffice workflow code is not edited.

## Test evidence

- Before: 31 focused tests, 26 passed, the same 5 failures reproduced.
- After: 41 focused tests passed, including dateFormatGuard and TableExportModal.
- Related regression: 113 tests passed (activity tests, OnlyOffice settings, export
  modal, and dictionary server-table hook).
- Added negative coverage: no attendance action without server capability; no API
  request before signature confirmation; one signed request with the original id,
  version and token; server rejection leaves the action available.
- Numeric equivalence checked for 0, 1, 999, 1000, 1000000 and MAX_SAFE_INTEGER.
- Full frontend suite (4 workers): 2239 tests, 2238 passed and 1 failed in
  NotificationEventView's placeholder-search test (outside this change). The five
  original failures passed in this run. The complete NotificationEventView test
  file passed when rerun alone; no changes were made to that file or its component.
- TypeScript (`tsc --noEmit --pretty false`) and production build (`npm run build`)
  passed. `git diff --check` passed.
- GitNexus `detect-changes --scope compare --base-ref main`: LOW, 0 identified
  affected processes. Its workspace report also includes unrelated ongoing edits;
  the three production diffs for this record were reviewed separately: exactly
  one numeric-format expression replaced in each file.
- Execution logs and JSON reports: `%TEMP%/eqms-fe-five-fixes-20261121/`
  (`before.json`, `after.json`, `related.json`, `full.json`,
  `notification-recheck.json`, `tsc.log`, `build.log`, `detect-changes.log`).

## Evidence limitations

The referenced `docs/system/00_EVIDENCE_CONVENTIONS.md` and validation template
`08_ONE_CHANGE_RECORD_TEMPLATE.md` are absent from this checkout. This record uses
the request, inspected source and executed test results; it does not assert a new
business requirement, runtime validation, regulatory compliance or QA approval.
