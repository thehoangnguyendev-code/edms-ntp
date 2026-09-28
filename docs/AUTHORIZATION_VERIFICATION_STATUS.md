# Authorization Platform — Verification Status

Last updated: 2026-07-18

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
| Generic workflow participant dual write/reconciliation | Implemented; runtime migration pending | V235 exists in source but is not recorded in the current DB. Generic read remains off. |
| Shadow evaluation and mismatch report | Implemented; runtime migration pending | V237 exists in source but is not recorded in the current DB. Shadow evaluation remains off. |
| Revision migrated-action fail-closed enforcement | Not enabled | `migrated-revision-workflow-actions` is intentionally empty until policy and participant reconciliation are clean. |
| Legacy role-name fallback | Default disabled | Current DB check found 0 active users without an active Access Profile; legacy fallback remains an explicit, time-boxed environment exception only. Legacy table/read retirement still requires reconciliation and QA/Compliance approval. |
| Full clean-database Flyway verification | Blocked by historical migration chain | A temporary clean database failed at `V80__seed_document_relations_for_expanded_row.sql` because it inserts null `source_document_id`; modifying that historical migration would invalidate existing production checksums. The temporary database was dropped. |
| Existing DB Flyway validation | Blocked by missing historical source | The current DB has V198–V200 recorded, but their source files are absent. They were retired AI Copilot migrations later removed by V201. No Flyway repair or history change was performed. |
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
