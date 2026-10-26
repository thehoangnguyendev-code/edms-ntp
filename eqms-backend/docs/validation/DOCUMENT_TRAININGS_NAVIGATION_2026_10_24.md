# Document Trainings navigation parity — 2026-10-24

Owner approved implementation after the source-backed diagnosis: FE defines training-document-trainings and /training-management/document-trainings under Training Programme, gated by training.matrix.view; NavigationService omitted the item, so the server-driven Sidebar removed it.

## Invariant and scope

Add the same ID, label, route and parent to the server navigation. Retain existing training.module.view + feat-tms module gates and training.matrix.view child gate. No new grant, role, DB data/migration, API authorization or department/object scope change. TrainingImpactService continues enforcing its existing permission and department scope. No lifecycle, parent/child, artifact, audit, signature or async behavior changes.

GitNexus getNavigation upstream: LOW, two direct callers, zero indexed affected processes. Existing unrelated working-tree changes are preserved. Source As-Is documents referenced by the validation skill are absent from this checkout; this record describes source/test evidence only and does not approve new business rules.

## Verification

TrainingNavigationTest adds assertions for exact node ID/label/route/group, denied matrix permission, missing module permission, disabled feature and existing wildcard grants.

- TrainingNavigationTest: 7/7 passed. RecordsNavigationTest: 3/3 passed.
- Extended Sprint10AuthorizationHardcodeRegressionTest: 20/21 passed. The unchanged navigation_withoutPermissionsGetsEmptyMenu test expects an empty menu, but Calendar is returned unconditionally by the pre-existing code. This unrelated mismatch is not repaired in this change.
- Backend Docker rebuilt and started successfully. Logged-in DEV UI verified: Training Management > Training Programme includes Document Trainings, route /training-management/document-trainings renders and loads 40 department-scoped rows (10 per page). No business records or permission assignments were modified by the check. Local screenshot: target/document-trainings-menu.png.
- Git diff for NavigationService contains only the three added lines. detect-changes LOW includes unrelated existing/concurrent work; no commit performed.

Rollback: remove the new menu node; no data rollback required. No commit/push unless separately requested.
