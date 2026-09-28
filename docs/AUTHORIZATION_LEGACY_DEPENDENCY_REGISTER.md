# Authorization Legacy Dependency Register

This register tracks compatibility paths that exist during the authorization
platform migration. It is a release gate: no entry may be retired until its
reconciliation evidence, replacement path and QA/Compliance approval are recorded.

| Legacy dependency | Current compatibility use | Replacement / target | Retirement gate |
|---|---|---|---|
| `app_users.role_name` | Display and compatibility reads for older role checks | Effective `user_access_profiles` and permission evaluation | Backfill report clean; no production authorization read remains; one stable release. |
| Legacy revision hard-coded fallback | Non-migrated revision actions only | Workflow Action Policy evaluated by `RevisionWorkflowAuthorizationService` | Enable action in `migrated-revision-workflow-actions` only after shadow mismatch report is clean. |
| `revision_workflow_participants` | Revision participant source of truth | `workflow_participants` generic read behind feature flag | Dual-write migration applied; `authorization_participant_reconciliation` clean during rollout window. |
| `object_access_rules.role_id` | Compatibility read for historical object rules | `access_profile_object_rules` canonical mapping | V234 applied and profile-rule reconciliation clean; no new legacy writes. |
| Direct project-role checks | Record-level actor compatibility in Work Management | Module entitlement plus `work_project_members` actor adapter | All issue/project mutations call the shared Work Management authorization path. |
| Frontend action visibility | Presentation only | Capability API and backend mutation guard | Endpoint enforcement tests pass; no frontend-only action protection. |

## Required evidence for each retirement

1. Feature flag and migration version used in the rollout.
2. Count of legacy/new records and mismatch count over the agreed monitoring window.
3. Allow/deny regression evidence for permission, scope, actor, SoD and e-signature.
4. Explicit QA/Compliance approval and rollback decision.

The register deliberately does not list Deferred modules: they must not receive a
compatibility path or authorization implementation until their Module Authorization
Contract is approved.
