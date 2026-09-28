# Authorization Platform Refactor Plan

## Objective

Replace fragmented authorization with one platform contract across live modules while preserving each module's domain model, audit trail, SoD checks and electronic signatures. The platform answers one question consistently: **may this user perform this business action on this resource now?**

The answer is derived server-side from authentication, state, permission, scope, actor assignment, SoD and required e-signature. Frontend capability data is advisory UI state only; it is never the enforcement boundary.

## 1. Scope and module inventory

The implementation starts from the authoritative [Module Authorization Inventory](AUTHORIZATION_MODULE_INVENTORY.md), [Global Action Catalog](AUTHORIZATION_GLOBAL_ACTION_CATALOG.md), [Participant and SoD Catalog](AUTHORIZATION_PARTICIPANT_SOD_CATALOG.md) and [Legacy Dependency Register](AUTHORIZATION_LEGACY_DEPENDENCY_REGISTER.md). A module is only moved into a delivery wave after it has persistent data, mutating APIs and an approved Action Catalog.

Current implementation and release-gate evidence is maintained in the [Authorization Verification Status](AUTHORIZATION_VERIFICATION_STATUS.md). It must be reviewed before enabling any migrated action or retiring a compatibility path.

| Classification | Current modules | Delivery rule |
|---|---|---|
| Live workflow | Documents/Document Revisions, controlled copies | Integrate state, participant, policy, scope, SoD and e-signature with the common contract. |
| Live authorization administration | Security & Authorization | Make profiles, policies, scope and diagnostics use the same source-of-truth contract. |
| Live record membership | Work Management | Retain project membership as record-level actor data; add module-level capability and adapter integration. |
| Cross-cutting consumers | My Tasks, Navigation, Audit Trail, Notifications | Consume backend capability/visibility decisions; do not own business authorization policies. |
| Deferred | Standalone Training and mock-only features including CAPA, Change Control, Complaints, Deviations, Equipment, Product, Regulatory, Risk Management, Supplier and Report | Do not add policy, participant or security UI until persistence and action catalog exist. |

The Document Training stage is part of the live Documents workflow. It is distinct from the standalone Training feature, which remains deferred until confirmed live.

## 2. Business model and non-negotiable rules

```text
User -> User Access Profiles -> Permission Sets -> Permissions
                              -> Workflow-role eligibility
                              -> Scope rules

Business record -> workflow state -> record participants -> scope facts
                                  -> action policy -> SoD constraints
```

* An **Access Profile** grants durable capability. It never says who is assigned to one particular record.
* A **Participant Assignment** identifies the person assigned as Author, Reviewer, Approver, Owner, Assignee or a module-specific role for one resource.
* A user can have multiple profiles and multiple record assignments at the same time.
* Policies are defined for business actions, never for routes, screens or buttons.
* `app_users.role_name` is compatibility/display-only. New authorization reads and writes must use `user_access_profiles`.
* `SYSTEM_SUPER_ADMIN` bypasses only permission entitlement. State, participant/actor, scope, SoD and e-signature checks still apply.

Every action follows this evaluation order:

1. Authenticated, active user and existing resource.
2. Valid state transition or resource state.
3. Required permission through effective Access Profiles.
4. Resource scope entitlement.
5. Matching actor/record participant rule.
6. No SoD violation.
7. Valid e-signature before a signed mutation commits.

## 3. Required BA artifacts

### Global Action Catalog

Every action in a live module must have one approved row with: module, resource type, stable action code, from/to state, canonical permission, actor rule, scope facts, SoD rule, e-signature meaning, audit event, notification recipients, denial codes and acceptance criteria.

Example action code formats:

* `documents/DOCUMENT_REVISION/COMPLETE_REVIEW`
* `documents/CONTROLLED_COPY/DISTRIBUTE`
* `work-management/WORK_PROJECT/UPDATE_ISSUE`

### Participant and SoD Catalog

For each participant type define eligibility, assignment owner, sequence/parallel behavior, state in which it acts and conflicting combinations. `AUTHOR`, `REVIEWER`, `APPROVER`, `OWNER`, `ASSIGNEE`, `PROJECT_ADMIN`, `MEMBER` and `VIEWER` are reusable actor concepts; modules may add names such as `INVESTIGATOR` only after catalog approval.

### Module Authorization Contract

Each live module supplies an adapter that can:

1. Load state, owner, participant and typed scope facts.
2. Resolve actions registered for the resource.
3. Return eligible candidates for a participant type.
4. Execute its domain transition after an allow decision.
5. Supply audit and e-signature metadata.

Domain tables stay owned by their module. In particular, `work_project_members` remains Work Management's record membership data.

## 4. Technical target

### Common decision contract

Introduce and standardize an `AuthorizationContext` with subject user, module key, resource type, resource id, action code and resource facts. Every evaluator returns an `AuthorizationDecision` with:

```text
allowed, reasonCode, reasonMessage, requiredPermission,
resolvedPolicy, requiresESignature, auditContext
```

Existing `AuthorizationService`, revision workflow authorization, controlled-copy authorization, lifecycle policy and object access evaluators are reused behind adapters. No module copies the Documents evaluator.

For an action marked migrated, an absent/inactive policy denies with `POLICY_NOT_CONFIGURED`. Hard-coded fallback is permitted only for an explicitly non-migrated action and must emit a telemetry/audit warning.

Current Revision rollout flag: `app.security.migrated-revision-workflow-actions` accepts comma-separated `RevisionWorkflowAction` values (or `ALL`). It defaults empty for compatibility. Add an action only after its policy/action-catalog/shadow-reconciliation gate has passed; then a missing policy fails closed with `POLICY_NOT_CONFIGURED`.

Set `app.security.authorization-shadow-evaluation-enabled=true` before migration enforcement to compare active DB policy with the legacy fallback for non-migrated Revision actions. Only mismatches are persisted; Security Admin can inspect them through `GET /security/authorization-shadow-mismatches`. A migrated action is enabled only after this report and `authorization_participant_reconciliation` both show no unresolved mismatch for its rollout window.

### APIs

Existing endpoints remain compatible. New generic endpoints are additive:

* `GET /authorization/resources/{resourceType}/{resourceId}/capabilities`
* `GET /authorization/resources/{resourceType}/{resourceId}/eligible-users?participantType=...`
* `POST /security/effective-access/diagnose`
* `PUT /security/access-profiles/{id}/configuration`

Capability responses carry `allowed`, stable reason code/message and `requiresESignature` for every registered action. Mutation endpoints must run the authoritative server evaluator even when a capability was previously returned as allowed.

### Scope/Object Access

`access_profile_object_rules` is the canonical Access Profile-to-rule relation. Stop new writes to legacy `object_access_rules.role_id`, backfill to the join relation, retain compatibility reads during rollout and remove legacy reads only after reconciliation.

Object Access Rule administration must explicitly show the subject profile, scope facet, applicable actions, effect, priority and active state. Use allow-list scope rules as the normal case; reserve `DENY` for approved exceptions.

### Participant migration

Use generic `workflow_participants` behind an off-by-default feature flag. Before switching reads, dual-write from the module's existing participant source and run idempotent reconciliation. Do not delete module participant tables in this program.

## 5. Delivery waves

### Wave 0 — Discovery and approval

* Finish Module Authorization Inventory and Legacy Dependency Register.
* Catalog every real mutation, direct role check, legacy fallback and frontend-only authorization decision.
* Approve Global Action Catalog and Participant/SoD Catalog with BA, QA and Compliance.

**Exit:** live/deferred scope is agreed; every live action has acceptance criteria.

### Wave 1 — Platform foundation

* Standardize decision and reason-code contracts.
* Add resource adapter registry, capability and eligible-user contracts, diagnostics and per-action feature flags.
* Add only additive migration/index work needed for policy metadata, profile configuration versioning, scope linkage and participant reconciliation.
* Add shadow evaluation and mismatch reporting.

**Exit:** a resource action can be evaluated through the shared contract without changing its UI.

### Wave 2 — Security administration

* Add aggregate profile configuration save: optimistic locking, one transaction, one e-signature, server diff, SoD validation and composite audit event.
* Consolidate navigation into Users, Roles & Permissions, Workflow Security, Access Review and Advanced.
* Move raw Permission Sets/Object Rules/SoD Catalog into Advanced and make business presets the default role-creation flow.
* Fix UI manage guards so a view permission never unlocks mutation controls.

**Exit:** an administrator can create, assign and diagnose a business role without stitching together technical screens.

### Wave 3 — Module integration

1. Documents revision actions and participant capability/eligibility.
2. Controlled Copy actions as a distinct resource/policy lifecycle.
3. Work Management entitlement plus project membership actor adapter.
4. Any additional persisted module confirmed by the inventory.

Each integration includes feature flag, adapter, capability endpoint, authoritative mutation guard, audit evidence and regression tests.

### Wave 4 — Rollout and retirement

* Reconcile effective permissions, participant rows and policy decisions.
* UAT by Business User, participant, manager, module admin, security admin, auditor and super administrator.
* Canary-enable per module/action while monitoring denied reason codes, legacy fallback usage, shadow mismatch and authorization exceptions.
* Stop legacy writes, then legacy reads/fallback only after one stable release and signed QA/Compliance approval.

## 6. Test and release gates

Automated coverage must include permission, state, actor, scope, SoD, super-admin, e-signature, missing-policy fail-closed, stale profile configuration, capability API, eligible-user API, mutation endpoint enforcement, reconciliation and feature-flag rollback.

Release is blocked unless:

* no migrated mutation is protected only by the frontend;
* no migrated action uses hard-coded fallback;
* every security mutation has e-signature/audit evidence where required;
* no unresolved legacy/new evaluator mismatch remains;
* Security Admin cannot self-grant critical rights or bypass SoD through aggregate configuration;
* deferred modules have no premature authorization implementation.
