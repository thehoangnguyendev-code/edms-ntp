# Search debounce coverage — 2026-11-12

## Request and approved scope

User requested a project-wide search audit and debounce for missing search fields. User explicitly approved the shared Select, MultiSelect and Custom Column changes after GitNexus CRITICAL warnings, with selection, save logic, API and authorization unchanged.

This is a search timing change, not a change to data scope or regulated business rules. The repository's referenced `08_ONE_CHANGE_RECORD_TEMPLATE.md` and `docs/system/00_EVIDENCE_CONVENTIONS.md` were absent; this record states the scope, invariants, sources, evidence and limitations explicitly instead.

## Invariants

- The same actor, permissions, object scope, stable filter values and server endpoints apply.
- Input text updates synchronously. Newly covered live filtering waits 300 ms after the latest keystroke.
- Existing server debounce remains at its existing location; no second delay is added to async Select/MultiSelect searches.
- Selection, saving, lifecycle, parent/child transitions, artifacts, checksums, audit/e-signatures and asynchronous generation are unchanged.
- Explicit Run/Search submission fields keep immediate criteria updates; pending input must not be lost when submitting a form.

## Source-confirmed coverage

The scan inventoried 156 native search input instances across 75 TSX files and separately traced shared search controls and their callers. An input lacking its own timer is not automatically missing debounce: list pages commonly delegate it to a hook.

Already covered: `useServerTable`, `useDictionaryServerTable`, `useUserList`, notification administration's `useServerList`, report catalog/schedules, Document filters' callers, Dashboard pending work, sidebar search, Knowledge suggestions/share lists, server-backed Select/MultiSelect, and Advanced-filter async option lists. Existing delays were retained.

Added coverage:

| Source | Change |
| --- | --- |
| `eqms/src/components/ui/select/Select.tsx` | Debounce local option/group filtering only; retain existing async search timer. |
| `eqms/src/components/ui/select/MultiSelect.tsx` | Debounce local option filtering only; retain existing async search timer. |
| `eqms/src/components/ui/table/CustomColumnDrawer.tsx` | Enable 300 ms search debounce via the existing FilterSearchInput. |
| `eqms/src/components/ui/filter/FilterOptionList.tsx` | Debounce local option lists; retain a single effect timer for server lists. |
| `eqms/src/features/training-activities/shared/TransferPicker.tsx` | Debounce the selected-list filter; available-list search remains owned by the caller. |
| `eqms/src/features/training-activities/jobs/TrainingJobCreatePage.tsx` | Debounce the available Work Position filter passed to TransferPicker. |
| `eqms/src/features/security-authorization/user-management/profile/components/EditAccessProfilesModal.tsx` | Debounce both list filters without changing assigned profile IDs or save handlers. |
| `eqms/src/features/security-authorization/lifecycle-policies/components/ActionStatusMatrix.tsx` | Debounce action-name filtering. |
| `eqms/src/features/settings/configuration/tabs/NavigationLabelsTab.tsx` | Debounce menu filtering and matching-group expansion. |
| `eqms/src/features/backup-restore/components/LocalListTable.tsx` | Debounce filtering and the corresponding page reset. |

## Impact and evidence

GitNexus upstream impact: Select 165 direct callers / 26 affected processes, MultiSelect 13 / 6, CustomColumnDrawer 2 / 9 (CRITICAL). Other resolved targets were LOW. LocalListTable was not present in the index; source search found its BackupDetailView caller. No backend functions, endpoint contracts or database schema were changed.

Focused test run: 119 tests passed before the additional Select/MultiSelect timing tests. Additional timing tests: 4 passed, covering local filtering, rapid typing, unchanged selected values, single server debounce and cancellation on unmount. TransferPicker and FilterOptionList tests verify delayed filtering with immediate text display. LocalListTable tests retain paging/sorting coverage.

Full FE regression: 1,392 passed and two 5-second timeouts (NotificationDock pinning and KnowledgeExplorer helpful/feature). Both affected suites passed when rerun separately: 39 tests / 2 files. No changes were made to those tests or their production components to obtain that result. This is not an all-green full-run result.

TypeScript: blocked by TS1117 at `eqms/src/features/settings/backup-restore-administration/__tests__/BackupPolicy.test.tsx:17` (duplicate `targets` property), outside this change. No TypeScript diagnostic pointed at the modified debounce files. The unrelated test file was preserved.

Test logs are local build artifacts under `eqms-backend/target/search-debounce-*.log` and are not release validation or an EU-GMP compliance claim. Browser/end-to-end verification of every caller has not been performed. No Docker deployment or container restart was performed.

## Rollback

Revert only the debounce additions and matching test updates listed above. No migration, data rewrite or credential change is required. Preserve unrelated concurrent workspace changes.
