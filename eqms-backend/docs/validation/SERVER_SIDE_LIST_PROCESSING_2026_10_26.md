# Server-side list processing audit and migration — 2026-10-26

Owner request: scan the project for business-data search/filter/sort/pagination implemented only in the frontend and move it to the server. Owner explicitly approved CRITICAL-impact AuditTrailTab and TrainingActivityService.get work, retaining authorization and compatibility with existing commands.

## Invariants and scope

Existing actor permissions, object/department scope and lifecycle visibility must be applied before filtering, sorting, counting and paging. Query operations are read-only. They cannot change workflow state, parent/child validity, stored file/checksum, audit or electronic-signature meaning. Responses remain bounded and stable; frontend renders the server's order/page and debounces requests, ignores obsolete responses. No arbitrary client SQL/sort paths are accepted.

Uncommitted edits from other work are preserved. Draft-only collections (unsaved form fields, selected participants/relationships/rules) are not persisted merely to support a search: introducing draft persistence would change the approved save/sign flow. Filtering selection-control options, removing an already-selected item, rendering columns, grouping chart segments and formatting text are distinct from querying a persisted business register.

The source-backed evidence conventions and change-record template referenced by AGENTS.md are absent from this checkout. This record describes source/test evidence, not a compliance certification.

## Source inventory and disposition

| Area | Source-confirmed finding | Disposition |
| --- | --- | --- |
| Access Profiles | Server pagination, but client sorts only the returned page | Move all six sortable columns, including assignment counts, to DB query before pagination |
| Shared AuditTrailTab | Preloaded record branch filters, sorts and pages locally; batch history fans out/merges in FE | Object-authorized paged endpoint; server-side batch/child scope with per-copy permission checks; remove local query pipeline |
| Knowledge classic folder | FE search/sort on a server page; no full-result pagination controls | Controlled query state in parent, search/sort before server pagination and server totals |
| Knowledge Explorer search/smart lists | FE sorts/slices bounded search/overview lists | Server query for full authorized search/smart collection, stable sort and page/count |
| Dashboard Pending Work | Search only in the 20 rows already loaded | DB search before top-20 limit, preserving current-user workflow predicate |
| RevisionTableView | Local pagination fallback exists; production list callers supply server totals | Verify all callers; remove dead business-data fallback after regression coverage |
| Draft selected relationships and uncontrolled-copy eligibility rules | Pending form state queried locally before Save/sign | Preserve explicit draft-edit semantics; distinguish saved view from draft editor |
| Training proposed participants / grouped people picker | Local group intersection/search and saved proposal paging | Authorized server queries and pages; unsaved selection state remains local |
| Training activity participants and session tables | Client grouping/filtering of detail payload | Server roster pages and server summary for display; legacy commands and their editable roster context remain compatible |
| Training paper transcriptions | Activity screen fetched every transcription and its lines | Server page plus activity-wide pending-session IDs; a failed status query disables entering a new transcription |
| Effective Access simulation | Local search/outcome filtering of evaluated server matrix | Evaluation and filtering on server, with summary computed before filtering |
| Access Profile editor and assigned-user / permission-set tabs | Full user details loaded and permission-set catalog searched locally | Editor summary carries IDs; assigned users and shared permission sets are queried in server pages. Draft assignment diffs remain local until signed Save |
| User authorization summary | Search on all loaded assigned profiles | Object-authorized server query with total and complete IDs for edit; matching is currently performed in server memory |
| Calendar day category view, backup alerts and configuration selectors | Grouping, short display lists or editable form state | Kept as presentation/unsaved draft; not treated as independent stored-data pages |

## Impact and verification

- AccessProfileListView and controller LOW; listProfiles(9) LOW, 2 direct callers, 3 transitive dependencies. New sort whitelist and deterministic ID tiebreaker; count sorts use correlated DB subqueries.
- AuditTrailTab CRITICAL; owner approved before modification. After reindexing: 19 direct callers, 9 indexed flows, 23 dependencies. AuditTrailService.listQuery LOW (2 direct callers, 4 transitive dependencies). ControlledCopyDetailView and DetailRevisionView LOW.
- Dashboard getMyTasks, PendingWorkPanel and parent dashboards LOW. No permission or task-eligibility predicate change.
- Knowledge service/browse and both frontend screens LOW. Existing visibleKnowledgeEntries authorization remains the source of eligible records; this work does not claim all server processing is already SQL-optimized.
- TrainingActivityService.get CRITICAL (55 direct callers, 107 dependencies); owner approved preserving the existing command contract and regression testing attendance, results and signatures.
- PermissionSetsTab, AssignedUsersTab and their loaders LOW. AccessProfileService.getAssignedUsers LOW (one direct caller); toDetailResponse MEDIUM (seven direct callers). Editor summary is additive; existing endpoints and signed update contract remain available.
- TrainingTranscriptionBlock LOW (two direct callers, one flow) and TrainingTranscriptionService LOW (two direct callers). The page endpoint retains the existing view and department-scope gates; enter/verify/reject commands are unchanged.
- 2026-10-27: TypeScript `npx tsc --noEmit` passed after the transcription change. Eleven focused FE test files passed (64 tests), plus two paged assignment tests, one signed aggregate Save test and two transcription UI tests; the latest combined Training and Access Profile FE regression passed 21 tests. Backend broader regression passed 188 tests, including DB paging/scope and denied authorization. A subsequent Training-only regression passed 149 tests, including two transcription query tests.
- Full FE run: 971/974 passed. Backup Verification and Recall by Scan both passed in a subsequent isolated run (33 tests combined). TableArchitecture still reports native table markup in Training Job Roles and Training Job Detail, both outside this query change. This check was not rerun after the latest transcription work.
- GitNexus `detect-changes --scope all` completed, but the workspace also contains unrelated user changes; its broad results cannot establish isolation of this change. No commit was made.

## Known limits requiring follow-up

- `KnowledgePortalService` and several access-profile queries still materialize authorized sets and sort/filter in server memory. Moving these computations to SQL with bounded queries remains necessary to reduce server/database load at scale.
- Training activity `overview` currently calls the legacy full-detail reader before producing server summaries. Some attendance/result editing screens intentionally still load the full editable roster, and supplementary candidates are sent as a list. These paths are not yet a complete paged solution for very large activities; preserve their signed bulk-command semantics when addressing them.
- The Access Profile aggregate Save endpoint still returns its legacy full assigned-user detail after a successful save. The initial editor and tab reads are paged or carry IDs only; reducing the save response also requires a compatible API contract change.
- Some filter facets are built from existing bounded lists or record snapshots; their completeness across all pages was not established by the current tests.
- This record does not establish EU-GMP compliance or validate live user workflows. Source documentation and validation template named in AGENTS.md were not present when checked.

No commit or push unless separately requested.
