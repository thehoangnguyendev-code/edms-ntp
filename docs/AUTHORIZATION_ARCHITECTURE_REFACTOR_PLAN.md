# Authorization Architecture Refactor Plan

## Objective

Make the server the sole authority for every protected action. The frontend may
guard routes and hide unavailable controls, but it must never grant access based
on a role label, local status inference, or a cached permission alias.

An action is allowed only when the server confirms all applicable conditions:

```text
authenticated active user
AND canonical permission
AND object scope
AND lifecycle state
AND workflow assignment / actor policy
AND segregation of duties
AND business invariants
```

Training is intentionally outside this refactor.

## Implementation status (2026-08-04)

- Completed: `AuthorizationService` no longer treats the System Super Admin
  access profile as an implicit business-action wildcard. Every protected
  action still requires an explicit effective permission.
- Completed: Document Master `CANCEL` and `OBSOLETE` mutations now use the
  persisted lifecycle-state policy evaluator instead of a workspace-management
  shortcut.
- Completed: `GET /authorization/resources/DOCUMENT_MASTER/{documentId}/capabilities`
  is the server-authoritative contract for Document Detail actions. It evaluates
  access, canonical permissions, lifecycle policy, Active/Effective state and
  in-progress revision invariants for upload, controlled-copy request, next
  revision configuration, review date and obsolete actions.
- Completed: Document Detail only renders the returned capability contract for
  those controls; it does not use a role label or local permission hook to
  grant an action.
- Completed: Revision list and "Revisions Owned By Me" screens no longer add a
  local "manage all drafts" grant to the server-returned per-revision edit
  capability. Their Edit Revision controls now render only when
  `canEditRevision` is allowed by the server.
- Completed: Document and Revision participant validation now implements the
  persisted SoD policy consistently: Author/Co-author review participation is
  configurable, while Author/Co-author approval of the same revision is always
  denied. Eligible-user lookup mirrors the same decision, so the picker cannot
  present a user that the mutation will reject.
- Completed: `GET /settings/document-administration` now returns the
  server-owned workflow-rule labels, descriptions, current values and version.
  The UI therefore renders the policy contract returned by the server instead
  of maintaining a separate description of the validation rules.
- Completed: the Document Administration API accepts and returns the stable
  `workflowCoordinatorCannotBeReviewerOrApprover` property, while accepting
  the older DCO-named payload field for migration compatibility.
- Completed: Controlled Copy request mutation now calls the same centralized
  evaluator as its capability endpoint.  The prior independent flat
  permission/scope checks were removed so policy changes cannot make the UI
  and API disagree.
- Completed: redundant Controlled Copy technical permissions retired by V320
  (`reject_request`, `prepare_distribution`, `generate`) are no longer
  represented by the runtime workflow/file-access enums or permission
  mappings.  Historical audit data remains untouched.
- Completed: the configurable workflow-coordinator segregation rule no longer
  reads the tenant-editable `DCO` workflow pool in document creation or
  revision-upgrade validation. It evaluates the canonical
  `documents.workspace.manage` entitlement instead; renaming a role label
  therefore cannot change Reviewer/Approver eligibility.
- Completed: Revision Workspace `saveSnapshot` (and the batch save/submit path,
  which calls it internally) previously had no authorization check beyond an
  authenticated session — any signed-in user could save another user's
  workspace for any revision. It now requires the caller to be the assigned
  Author or Co-Author (`documentAuthorizationService.requireCanEditDraftRevision`).
- Completed: the `/action-capabilities` contract now exposes `saveWorkspace`,
  `batchSaveSubmit`, `addWorkingNote` and `deleteWorkingNote` — the first two
  wrap the check above; the working-note pair wrap the existing
  pending-Reviewer/Approver check the mutation already enforced, previously
  only surfaced through the older `workingNotesEditable` field.
- Known gap: batch save/submit can touch multiple items belonging to different
  documents/revisions in one call; the new check only validates the top-level
  `sourceRevisionId`, not each item's own document/revision. Needs a dedicated
  pass into `RevisionWorkspaceItemRequest` before it can be called complete.
- Next: migrate the remaining Document/Revision/Controlled Copy UI action
  surfaces and mutation endpoints to the same contract, then add a role-free
  authorization matrix for each state transition.

## Stable authorization model

| Concept | Purpose | Stable identifier |
| --- | --- | --- |
| Permission | A business action a user may be entitled to perform | `module.resource.action` code |
| Permission set | Reusable collection of permissions | code / UUID |
| Access profile | User entitlement and scope package | code / UUID |
| Workflow role | Eligibility for Author, Co-Author, Reviewer, or Approver assignment | code / UUID |
| Assignment | A user's actor relationship to one concrete record | record UUID |
| Workflow action policy | State, permission, and actor constraints for a transition | action code + policy version |
| SoD constraint | Incompatible actions on the same record | rule UUID |

Display labels such as “DCO”, “QA Manager”, and “Reviewer” are editable names
only. They never grant access. System Super Admin is not a business-action
wildcard; it receives only explicit permissions through its active access
profiles.

## Canonical permission catalog

### Document Master

```text
documents.module.view
documents.document.view
documents.document.view_all
documents.document.create
documents.document.edit_metadata
documents.document.configure_initial_workflow
documents.document.preview_published
documents.document.download_published
documents.document.view_audit
documents.document.cancel
documents.document.reopen
documents.document.obsolete
```

### Revision

```text
documents.revision.upload_source
documents.revision.upload_office_online
documents.revision.edit_online
documents.revision.download_source
documents.revision.complete_authoring
documents.revision.submit_review
documents.revision.review
documents.revision.reject_review
documents.revision.approve
documents.revision.reject_approval
documents.revision.complete_training
documents.revision.open_publishing_workspace
documents.revision.generate_preview
documents.revision.preview
documents.revision.publish
documents.revision.cancel
documents.revision.upgrade
documents.revision.configure_next_reviewers
documents.revision.configure_next_approvers
documents.revision.configure_next_related_documents
documents.revision.configure_next_correlated_documents
```

`documents.revision.obsolete` is deliberately not a user-facing permission or mutation. An
Effective revision becomes Obsoleted only as a controlled consequence of publishing its
successor, or when its Document Master is made Obsolete. This prevents a direct revision
transition from leaving an Active Document Master without an Effective revision.

### Controlled Copies

```text
documents.controlled_copy.view
documents.controlled_copy.request
documents.controlled_copy.distribute
documents.controlled_copy.cancel_request
documents.controlled_copy.recall
documents.controlled_copy.expire
documents.controlled_copy.report_lost_damaged
documents.controlled_copy.replace_lost_damaged
documents.controlled_copy.view_file
documents.controlled_copy.download_file
documents.controlled_copy.print_file
documents.controlled_copy.upload_evidence
documents.controlled_copy.view_evidence
documents.controlled_copy.download_evidence
```

`approve_request`, `reject_request`, `prepare_distribution`, `generate`,
`confirm_destroy`, refresh, cache invalidation, Office Online sync, and preview
token creation are technical operations, not assignable human permissions.

### Security and configuration

Keep security administration separate from business permissions:

```text
security.permission_sets.*
security.access_profiles.*
security.workflow_authorization.*
security.object_rules.*
security.sod.*
security.effective_access.*
settings.configuration.view
settings.configuration.edit
```

Migrate `settings.configuration.manage` to `settings.configuration.edit` and
deprecate it after consumers have moved.

## Server capability contract

Use the existing resource capability endpoint as the common read contract:

```http
GET /authorization/resources/{resourceType}/{resourceId}/capabilities
GET /authorization/resources/{resourceType}/{resourceId}/eligible-users
```

Extend resource support to `DOCUMENT_MASTER` and administration resources.
Every action response must include `allowed`, a safe denial reason,
`requiredPermissionCode`, `state`, assignment/scope outcome,
`requiresESignature`, and `policyVersion`. Mutation endpoints must call the
same evaluator again inside their transaction; they must never trust a previous
capability result supplied by the client.

Frontend rules:

- `ProtectedRoute` is a coarse module/page guard only.
- Multi-permission route guards must declare `any` or `all` explicitly.
- Buttons and menu actions are driven by server capabilities and are hidden when
  denied.
- Permission catalog data is served by the API; frontend constants are only UI
  typings/mappings and cannot be an authorization source.

## SoD and scope rules

- An assigned Author may also be an assigned Reviewer.
- Author, Co-Author, or Reviewer cannot approve the ame revision.
- A user holding both Review and Approve permissions is valid; the conflict is
  evaluated per revision, not as a global permission-pair ban.
- An exact workflow assignment may grant access to that record outside normal
  business-unit or department scope. It grants no wider scope.
- An administrator does not receive authoring, review, approval, publishing, or
  controlled-copy actions without explicit entitlements and required assignment.
- Participant changes must run the same SoD validation before save and before a
  workflow transition.

## Execution order

1. Inventory each non-Training UI action through route, API, controller,
   service, permission, policy, state, assignment, SoD, and audit event.
2. Remove System Super Admin wildcard behaviour and reconcile all current
   policy/permission drift before changing workflow access.
3. Classify every code referenced by source but absent from the live catalog as
   canonical, legacy alias, technical operation, test fixture, or invalid code.
4. Add/retire database catalog entries and migrate Permission Sets and active
   policies without deleting historical audit values.
5. Extend shared capability evaluation to Document Master and configuration
   resources. Domain services remain authoritative for record-specific rules.
6. Convert mutations and frontend actions one workflow at a time, proving that
   capability and mutation decisions match.
7. Replace global SoD permission pairs with revision-record SoD rules and
   revalidate participant changes.
8. Remove legacy alias grants and role-name runtime checks after telemetry and
   regression tests confirm that no consumer remains.

## Acceptance tests

- Direct API calls are denied when the UI is manipulated to show a hidden action.
- Renaming an access profile or workflow role leaves effective permission and
  assignment decisions unchanged.
- Permission without assignment is denied for participant-only actions.
- An exact assignment outside the normal scope works only for that record.
- An Author assigned as Reviewer may review, but may not approve that revision.
- A System Super Admin without the action permission is denied.
- Capability and mutation return the same allow/deny result for every lifecycle
  action.
- Policy edits are e-signed, versioned, audited, and effective immediately.
- Backend unit/integration tests, frontend typecheck/build, and Docker health
  checks pass before an action family is marked complete.
