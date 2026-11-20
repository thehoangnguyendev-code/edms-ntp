# Authorization Platform — Verification Status

Last updated: 2026-11-18

This is an evidence register, not an approval to deploy. A row is only marked
**Verified** when the stated evidence exists; a code change alone is not proof of
release readiness.

| Gate | Status | Evidence / remaining condition |
|---|---|---|
| Documents Revision mutation guards | Verified in unit/regression scope | Revision workflow policy/runtime tests pass; state, scope, actor, SoD and signature paths are covered. |
| Controlled Copy mutation guards | Verified in unit/regression scope | `ControlledCopyAuthorizationServiceTest` and service authorization integration tests pass. |
| Work Management entitlement + membership | Verified in unit/regression scope | Permission guards, capability adapter and `WorkManagementMyTasksAuthorizationTest` pass. My Tasks now requires current assignment, active project and non-completed issue. |
| Navigation is a backend consumer | Verified in build/test scope | Sidebar consumes `GET /navigation`; backend includes Access Review and Workflow Role Catalog. `Sprint10AuthorizationHardcodeRegressionTest` passes. |
| Capability UI fails closed | Verified in frontend build scope | Revision and Controlled Copy workflow screens no longer use frontend permission fallbacks when capability data is loading or unavailable. A denied action may remain visible only as a disabled contextual control with the backend denial reason. |
| Canonical Access Profile–Object Rule mapping | Implemented; runtime migration pending | V234 is recorded in the current DB. |
| Generic workflow participant dual write/reconciliation | Implemented; status as of 2026-07-18, not re-checked | Re-verify against the current DB before relying on it (the DB is now at V815). |
| Shadow evaluation and mismatch report | Removed 2026-11-20 | The engine is the only decision for Document, Revision, Controlled Copy and every other type; no comparison with an old check remains. `authorization_shadow_evaluation_events` was dropped (V832), the cutover flags and the mismatch controllers were deleted. Decision Log: SECURITY-AUTHORIZATION-SHADOW-REMOVAL. |
| Hybrid engine for Training, Report, Access / Audit Review campaigns and Uncontrolled Copy (2026-11-18) | Implemented on DEV; not committed; not released | Policies V810–V815 in Workflow Authorization; matrix tests per lifecycle (every cell of state × permission × relation × scope × action); the old permission / scope / person checks were deleted from the services for the types listed in `ShadowGuard.ENGINE_DECIDES` and `REPORT_TEMPLATE` (the engine decides alone and fails closed; rollback means restoring code from history). Signature steps (`approvals.requireCanSign`) keep their check after the engine. See the Decision Log entries of 2026-11-18. |
| Buttons from the engine (2026-11-18) | Implemented for Training details, Uncontrolled Copy and Report template | `EngineCapabilities`; list rows and Access / Audit Review and Report schedule / run / file screens still use permission hints that equal the policies. |
| Real two-person flows, canary, observation window for these types | Pending | Only single-person calls on DEV were run (admin, approver.test1). There is no shadow table any more (V832), so volume must be observed from Engine Health counters. |
| Visibility tiers, Object Access Rules and Access Profile scope (2026-11-20) | Implemented on DEV; not committed; not released | Who sees records is chosen on the Access Profile (Document Control 3 levels, Training 2, Reports 2). The system-wide open mode, the Access Profile scope and the administrator-created Object Access Rules were removed (V826-V833). Decision Log: VISIBILITY-TIERS-*. Two-person live tests of the department level, the Training and Reports pickers and REQUEST_COPY are still pending. |
| Backend suite | 3032 tests, 8 failures at the last full run | 6 failures are identical on a clean checkout of HEAD (data of the shared DEV database); 2 appeared only in the full run and pass alone. `DocumentListVisibilityParityIntegrationTest` hangs on the DEV database and is excluded. |
| Revision migrated-action fail-closed enforcement | Not enabled | `migrated-revision-workflow-actions` is intentionally empty until policy and participant reconciliation are clean. |
| Legacy role-name fallback | Default disabled | Current DB check found 0 active users without an active Access Profile; legacy fallback remains an explicit, time-boxed environment exception only. Legacy table/read retirement still requires reconciliation and QA/Compliance approval. |
| Full clean-database Flyway verification | Status of 2026-07-18, not re-run | A temporary clean database failed at `V80__seed_document_relations_for_expanded_row.sql` because it inserts null `source_document_id`; modifying that historical migration would invalidate existing production checksums. The temporary database was dropped. |
| Existing DB Flyway validation | Passes on DEV on 2026-11-18 (Flyway validated 801 migrations of the repository and the DB is at V815); the 2026-07-18 note about V198–V200 was not reproduced and the reason was not investigated | The current DB has V198–V200 recorded, but their source files are absent. They were retired AI Copilot migrations later removed by V201. No Flyway repair or history change was performed. |
| Persona UAT / canary / QA-Compliance sign-off | Pending | Requires a deployable migration chain and business execution; not inferred from automated tests. |

## Commands that passed in the current workspace

```text
eqms-backend: mvnw -q -DskipTests compile
eqms-backend: mvnw -q -Dtest=!UpgradeRevisionIntegrationTest test
eqms-backend: mvnw -q -Dtest=Sprint10AuthorizationHardcodeRegressionTest test
eqms: npm run build
```

## Required release sequence once migration history is repaired

1. Restore historical V198–V200 source with checksum-preserving provenance, and
   resolve the clean-install V80 defect through an approved migration-history strategy.
2. Apply V235–V237 in a non-production environment and verify participant and shadow
   reconciliation reports are empty for the agreed monitoring window.
3. Enable revision actions one at a time in
   `app.security.migrated-revision-workflow-actions`; each missing/disabled policy
   must fail closed with `POLICY_NOT_CONFIGURED`.
4. Execute persona UAT and canary monitoring, then obtain explicit QA/Compliance
   approval before retiring legacy reads or fallbacks.
