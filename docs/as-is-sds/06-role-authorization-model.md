# 06 — Role & Authorization Model (AS-IS)

Evidence source: agent trace of `auth/`, `entity/`, `service/` authorization classes and Flyway migrations. All claims below are source-code evidence, not inference from the QF reference table.

## 6.0 Headline finding — classification: **QF-DEVIATION** (architecture-level)
The QF reference (SDS §4 Module Authorizations) models a **fixed 7-role matrix** (Admin/DCO/Author/Co-Author/Reviewer/Approver/Receiver-View-Only) with static per-role rights. The actual system implements a **DB-backed, permission-code-driven RBAC + policy-engine model**:
- `entity/WorkflowRole.java` (table `workflow_roles`, migration `V172__workflow_roles_catalog.sql`) — an admin-manageable role catalog that migration comments say **explicitly replaces** a prior hardcoded `WorkflowRoleCode` enum and `WorkflowPoolTypes` constants.
- Real authorization decisions are driven by **Permission codes** (`entity/Permission.java`, dot-namespaced strings such as `documents.workspace.manage`, `documents.revision.review`, `documents.revision.approve`, `documents.controlled_copy.request`, `security.maintenance.bypass`), attached to `RoleDefinition` ("Access Profile" in the UI) via `RolePermission`/`PermissionSet`/`AccessProfilePermissionSet`, evaluated through an `AuthorizationEngineService` policy engine reading `workflow_action_policies`.
- `WorkflowRole` membership (e.g. `DCO`, `QUALITY_ADMIN`) is, per code comments in `WorkflowRoleService`/`DocumentAuthorizationService.canViewAllDocuments`, **"descriptive/assignable metadata only"** — it does not itself grant access. This is an **IMPLEMENTATION-DISCOVERED** architectural fact: role *names* in the UI (Author, Co-Author, Reviewer, Approver, Publisher, DCO, Training Reviewer, Training Approver, Quality Admin — the system-seeded `WorkflowRole` codes) are labels; the actual authorization boundary is the permission code(s) an Access Profile grants, plus record-level actor scoping (see 6.3).

System-seeded `WorkflowRole` codes (`is_system=true`, cannot be deactivated/deleted): `DOCUMENT_AUTHOR`, `DOCUMENT_REVIEWER`, `DOCUMENT_APPROVER`, `DOCUMENT_PUBLISHER`, `DCO`, `TRAINING_REVIEWER`, `TRAINING_APPROVER`, `QUALITY_ADMIN`.

## 6.1 Authentication (not modeled in QF reference at all — system-specific)
- `auth/AuthTokenFilter.java`: JWT via `accessToken` cookie or `Authorization: Bearer`. Session state tracked in an `AuthSession` entity; idle-timeout produces `SessionStatus.LOCKED`. Gates checked before any permission logic: account `UserStatus.Active`, password-expiry. A "maintenance mode" bypass exists but is gated by permission `security.maintenance.bypass`, **not by a role name** — consistent with the permission-code-driven design.
- Builds Spring `Authentication` authorities from `PermissionEvaluationService.getPermissionCodes(user)` — **GrantedAuthority set = permission codes, not role names.**
- `auth/RateLimitFilter.java`: per-action rate-limit buckets (login, reauthenticate, mfa-verify, mfa-send-otp, forgot-password, reset-password, e-signature verification, password change, controlled-copy preview token). Client key = `user:<id>` when authenticated else `ip:<addr>`.

## 6.2 Per-record participant model (Document / Revision)
- Author identity is a dedicated FK: `DocumentRecord.author` / `DocumentRevisionRecord.author` — not a participant row.
- Co-Author/Reviewer/Approver are rows in `DocumentWorkflowParticipant` (document-level) / `RevisionWorkflowParticipant` (revision-level), with `participantType` as a **free-text String** (`"CO_AUTHOR"`, `"REVIEWER"`, `"APPROVER"`), `sequenceOrder` (defines review/approval order), and on `RevisionWorkflowParticipant` an `actionStatus` (e.g. `PENDING`), `actionComment`, `actedAt`, `signatureSessionId`.
- `DocumentWorkflowPoolMember` (legacy `poolType` String + `active` flag) — pre-V172 pool of users eligible for DCO/Reviewer/Approver assignment; V172 migrates active members into Access Profile + `access_profile_workflow_roles` and keeps the table only for backward compatibility. **IMPLEMENTATION-GAP-adjacent**: legacy table still exists post-migration; verify in a later pass whether any live code path still reads it as authoritative (agent did not confirm dead-code status).
- `DocumentWorkflowSetting` — per-document workflow/SoD configuration flags: `reviewerNoApprove`, `requireTwoReviewers`, `requireOneApprover`, `authorCannotBeReviewerOrApprover`, `coAuthorCannotBeReviewerOrApprover`, `sameUserCannotHoldMultipleWorkflowRoles`, `dcoCannotBeReviewerOrApprover`, `reviewerAndApproverDifferentDepartments`. **UNKNOWN**: exact enforcement call sites for these flags were not located in this pass — flagged for follow-up (candidate: participant-assignment validation in `RevisionService`/a `DocumentWorkflowSettingService`).

## 6.3 Per-role authorization behavior (with citations)

### Author
- `DocumentAuthorizationService.canUploadRevision` — author-FK match + permission `documents.revision.upload_source`.
- `canEditDraftRevision` / `canEditRevisionFileOnline` / `canCompleteRevisionEditing` / `canUploadRevisionSource` — author (or Co-Author for edit-only) + revision status DRAFT + not source-locked.
- Access is **record-level** (scoped to the specific revision's author FK), not global.

### Co-Author
- Row in `RevisionWorkflowParticipant`/`DocumentWorkflowParticipant` with `participantType="CO_AUTHOR"`.
- Can edit draft content/online but **cannot** upload/replace the controlled source file — `canUploadRevisionSource` checks the author FK only. Code comment: "A Co-Author can edit online, but cannot replace the controlled source artifact." — **IMPLEMENTATION-DISCOVERED rule**, not explicit in the QF field table (QF marks Co-Author "Edit Online" = X but does not explicitly deny source upload).

### Reviewer / Approver
- `DocumentAuthorizationService.canReviewRevision` / `canApproveRevision` → `canActOnRevisionParticipant`: requires `snapshotStatus=="READY"` AND the current user must be the **first participant of that type with `actionStatus=="PENDING"`**, strict FIFO by `sequenceOrder` — `RevisionWorkflowAuthorizationService.isPendingReviewer`/`isPendingApprover` via `isNextPendingInSequence`. **IMPLEMENTATION-DISCOVERED**: a second Reviewer cannot act while the first Reviewer's action is still pending — QF's field table implies multiple reviewers can act but does not specify sequencing; this is a stricter, sequence-gated implementation (`QF-DEVIATION`, refine to `QF-MATCH`/`QF-DEVIATION` once QF workflow diagrams are checked — diagrams were image-only in the source .md, not text-extractable in this pass).
- Eligibility to be *assigned* as Reviewer/Approver: `WorkflowParticipantEligibilityService.requirePoolMembership` requires permission `documents.revision.review`/`documents.revision.approve` respectively; Author/Co-author/SoD exclusions enforced by separate callers (see 6.2 UNKNOWN).
- Actual grant/deny of workflow-transition actions (SUBMIT_FOR_REVIEW, COMPLETE_REVIEW, REJECT_REVIEW, COMPLETE_APPROVAL, REJECT_APPROVAL, PUBLISH, etc.) is delegated to `AuthorizationEngineService`, a rules engine reading `workflow_action_policies` (seeded by `V159__seed_workflow_action_policies.sql`, controlled-copy variants `V160`/`V161`), invoked from `RevisionWorkflowAuthorizationService.check`. Code/comments describe this as the result of a "hybrid-engine cutover" that removed an older hardcoded decision tree. **Fails closed** on engine error (`AUTHORIZATION_ENGINE_ERROR`).

### DCO (Document Control Officer)
- Not a hardcoded actor selector. `WorkflowRole` code `DCO` is descriptive metadata only (per 6.0).
- Actual DCO-equivalent authority comes from permission bundles: `documents.workspace.manage` (drives `canManageDocumentWorkspace`, `canManageRevisionWorkspace`, `canPublishRevision`), and/or `documents.admin.view` / `documents.admin.manage_workflow_roles` / `documents.admin.manage_sod_constraints` / `documents.document.view_all` (drives `hasDocumentAdministrationPermission` → `canViewAllDocuments`).
- Publish / Cancel / Obsolete document-master actions route through `DocumentMasterWorkflowAuthorizationService.check` → `AuthorizationEngineService` (policy-driven).
- Migrations `V286`/`V305`/`V367` show DCO-equivalent permission grants/revocations evolving over time at the permission-set level (e.g. V367 "remove document workflow permissions from admin profiles") — evidence that role-to-permission mapping is data, not code, and has been actively re-tuned post-deployment.

### System Administrator (SYSTEM_SUPER_ADMIN)
- **IMPLEMENTATION-DISCOVERED, notable**: `ControlledCopyAuthorizationService.evaluateInternal` explicitly enforces that SYSTEM_SUPER_ADMIN is **not exempt** from Controlled Copy authorization — "GMP Segregation of Duties: ... it must hold the required permission like any other user" (per `V243__seed_system_super_admin_permission_set.sql`). No God-mode bypass branch was found in the files read for this module. This directly **contradicts** an assumption a naive reading of "Admin = full access" (as implied loosely by QF's Admin column) would produce — classify as `QF-DEVIATION` (system is stricter/more segregated than the reference implies). **UNKNOWN** whether this non-exemption holds for every other module (only confirmed for Controlled Copy in this pass).

### Receiver / View-Only (Controlled Copy consumer)
- `ControlledCopyAuthorizationService.matchesDocumentViewer` grants controlled-copy read + self-service `REQUEST_COPY` (one copy for self, enforced in `ControlledCopyService.requestControlledCopy` — not the authorization service) to anyone who can view the parent document (author, co-author, reviewer, approver, workspace manager, or strict-visibility viewer).
- Anonymous/public token-link access (`requireTokenPreviewAccess`/`requireTokenDownloadAccess`): trust boundary is **possession of `ControlledCopyRecord.accessToken`** plus a separately issued preview password hash (`requirePreviewPassword`) — **no EQMS login or permission check at all** on this path. This is record/token-scoped access, structurally different from the RBAC path, and should be highlighted for security review as an explicit-by-design out-of-band access mechanism (matches QF's "download via email link" concept but implemented as an unauthenticated token, not a QF detail — `IMPLEMENTATION-DISCOVERED`).

## 6.4 Record-level vs. global visibility
`DocumentAuthorizationService.canViewDocument`/`canViewRevision`: global bypass only via the permission-driven `canViewAllDocuments`; otherwise strictly scoped to: author FK match, OR a participant row (Co-Author/Reviewer/Approver) on that specific document/revision, OR (feature-flagged: `app.security.participant-visibility-strict`) permission `documents.document.view` limited to terminal-status (EFFECTIVE/OBSOLETED/CLOSED_CANCELLED) records only. This **confirms** the QF intent that Reviewers/Approvers see only assigned records (`QF-MATCH` on intent), though the enforcement mechanism (DB-row participant scoping, not a role enum) is an implementation detail beyond what QF specifies.

## 6.5 `AccessEffectiveService` — self-diagnostic tool
Read-only "Effective Access" diagnostic: for a given Access Profile (+ optional document type), replays the three real runtime evaluators (`WorkflowActionPolicyService`, `LifecycleStatePolicyEvaluator`, `ObjectAccessEvaluationService`) across every `RevisionWorkflowAction` × revision status and `LifecycleCapability` (CANCEL/OBSOLETE) × document status, reporting Allow/Deny with reason codes (`MISSING_PERMISSION`, `ACTOR_SCOPE_NOT_SATISFIED`, `OBJECT_ACCESS_DENIED`, `NO_MATCHING_POLICY`). It self-documents a known limitation: instance-specific actor scopes (AUTHOR/PARTICIPANT) "cannot be resolved in the abstract" for a whole profile — the tool flags this rather than silently guessing. Relevant for `21-known-unknowns-conflicts.md` as a system-acknowledged limitation, not a bug.

## 6.6 Segregation of Duties (SoD)
- `entity/SodConstraint.java`: admin-configurable **permission-pair** conflicts (`permissionCodeA`, `permissionCodeB`, `severity` [WARN/other], `regulationRef`, `active`, `system`) — a generic conflict model, not a fixed role-pair table as QF's matrix implies.
- `SodConstraintService.scanViolations()` detects two violation kinds: (a) a single Access Profile alone grants both conflicting permissions (`ViolatingAccessProfile`), or (b) no single profile does, but a user's combined active profiles do (`ViolatingUserCombination`) — surfaced via `dto/user/SodViolationResponse.java`. Also `checkAccessProfileCombination` (pre-assignment check) and `checkPermissions` (ad hoc check).
- Separate from the above: `DocumentWorkflowSetting` boolean flags (6.2) represent workflow-specific SoD rules (author/co-author/DCO cannot be reviewer/approver, no dual-role holding, reviewer/approver must be different departments) — enforcement call sites **UNKNOWN** (not located in this pass).

## 6.7 Classification summary
| Area | Classification |
|---|---|
| Fixed 7-role model (QF) vs. permission-code + policy-engine model (actual) | `QF-DEVIATION` (architecture) |
| Reviewer/Approver record-scoped visibility | `QF-MATCH` (intent), implementation detail beyond QF scope |
| Strict FIFO sequencing of multiple reviewers/approvers | `QF-DEVIATION` / possible `QF-MATCH` — needs QF workflow diagram (image, not extracted) to confirm; provisionally flagged |
| Co-Author cannot upload/replace source | `IMPLEMENTATION-DISCOVERED` |
| SYSTEM_SUPER_ADMIN not exempt from Controlled Copy SoD | `IMPLEMENTATION-DISCOVERED` (stricter than naive Admin-column reading) |
| Anonymous token-based Controlled Copy access | `IMPLEMENTATION-DISCOVERED` |
| `DocumentWorkflowSetting` SoD flags enforcement | `UNKNOWN` (follow-up needed) |
| Legacy `DocumentWorkflowPoolMember` live-path status post-V172 | `UNKNOWN` (follow-up needed) |
| SYSTEM_SUPER_ADMIN exemption in modules other than Controlled Copy | `UNKNOWN` (follow-up needed) |

## Source evidence index
`com.eqms.auth.AuthTokenFilter`, `com.eqms.auth.RateLimitFilter`; `com.eqms.entity.{DocumentWorkflowParticipant, DocumentWorkflowPoolMember, DocumentWorkflowSetting, RevisionWorkflowParticipant, WorkflowRole, Permission, RoleDefinition, SodConstraint}`; `com.eqms.service.{DocumentAuthorizationService, RevisionWorkflowAuthorizationService, ControlledCopyAuthorizationService, WorkflowRoleService, WorkflowRoleCatalogService, WorkflowParticipantEligibilityService, DocumentMasterWorkflowAuthorizationService, DocumentMasterActionCapabilityService, RevisionActionCapabilityService, AccessEffectiveService, SodConstraintService}`; migrations `V172__workflow_roles_catalog.sql`, `V159__seed_workflow_action_policies.sql`, `V160/V161__*controlled_copy_workflow_policies.sql`, `V243__seed_system_super_admin_permission_set.sql`, `V286/V305/V367__*dco*.sql`.
