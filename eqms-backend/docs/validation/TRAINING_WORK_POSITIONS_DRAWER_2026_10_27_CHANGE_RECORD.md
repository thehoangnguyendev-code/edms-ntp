# Work Positions preview and drawer — 2026-10-27

## Scope and invariants

User selected the compact preview and shared drawer for Job Assignments and Job Assignment Details. This is a read-only presentation change. The list query retains its existing actor, permission and department/self predicates and pagination. The new positions search uses the same visible(actor, assignmentId) guard as the existing detail endpoint before querying any roles. Search values are bound and LIKE wildcards escaped. No lifecycle, parent-child, file, audit, electronic signature, or asynchronous-generation behavior is changed.

The list response adds structured positions while preserving positionName and existing fields. Names are never parsed by commas. The details view uses the existing role objects; carried roles retain their held-before marker. Drawer search is executed on the server.

## Impact and verification

GitNexus: TrainingJobListView LOW (zero direct callers), TrainingJobDetailPage LOW (zero direct callers), TrainingJobAssignmentService.list eight-argument overload LOW (two direct callers, no affected processes).

Frontend TypeScript passed; WorkPositionsPreview.test.tsx passed and covers comma-containing names, carried roles and server search. Backend TrainingJobPositionsTest passed (2 tests): existing department-scope guard and wildcard escaping, and refusal before position query for an out-of-scope actor. Maven compile passed. PostgreSQL accepted the JSON aggregation expression in a read-only query. These are not end-to-end or released-environment validation; the full API query and UI were not exercised against a live signed-in session. The current running backend has not been updated. The AGENTS-referenced evidence conventions and change-record template files are absent; this record uses the existing local record format.

Rollback: revert the new controller endpoint, service search and structured list field, the API method, preview component and its two consumers. No migration or historical-data change is required.

## Drawer pagination follow-up — 2026-10-27

The drawer keeps search fixed and loads positions in server pages (default 20, maximum 100), numbered in order. The server applies the existing assignment visibility guard before counting and selecting rows, filters the complete matching set, and orders by assignment sort order and role ID. The summary API now includes only the first two structured positions plus a count; the existing positionName field is retained for compatibility. Existing detail responses still include their full role list.

Verification: TypeScript passed; WorkPositionsPreview tests (2) cover server search after loading a subsequent page and visible numbering. TrainingJobPositionsTest (3) covers scoped access, wildcard escaping and bounded page/offset/count. PostgreSQL accepted the bounded preview aggregation in a read-only query. The running backend has not been redeployed; no end-to-end browser or real paginated endpoint test was performed. GitNexus could not identify the newly created drawer and positions endpoint in its stale index; the list overload remained LOW (two direct callers).

## Work Positions Held drawer — 2026-10-27

The Work Positions Held tab now previews at most two structured names and a remaining count, reusing the shared drawer. The new read-only person-positions/{personId} endpoint checks the same training permissions, active-user condition and department-name scope as the existing person-positions list. Scope is also included in count and data queries. Search covers all matching active positions server-side; pages are capped at 100 and ordered by name and ID. This is the person's currently held positions, not an assignment snapshot. Lifecycle, signatures, audit, files and existing list search/filter/sort semantics are unchanged.

GitNexus: PersonJobRolesPanel LOW (one direct caller), TrainingMatrixService.personPositions LOW (one direct caller); newly added endpoint and drawer changes were not in the index. Frontend TypeScript passed; 3 preview tests cover assignment and person sources, server search and pagination. Backend TrainingPersonPositionDetailsTest (2) verifies denial outside department and scoped search/paging; TrainingJobPositionsTest (3) passed. A read-only PostgreSQL query confirmed the joins and scope predicate execute, with no matching rows for the selected sample. This is not a live API or signed-in browser validation. Running backend and frontend have not been redeployed for this feature. No schema changes.
