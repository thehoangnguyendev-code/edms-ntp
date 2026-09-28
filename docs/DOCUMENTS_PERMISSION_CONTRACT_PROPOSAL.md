# Documents Permission Contract - Proposal

**Status:** Draft for business and quality review. This document does not change the currently deployed application.

**Goal:** define one canonical authorization contract for Document Control. The contract becomes the source for the permission database catalog, Permission Set UI, backend enforcement, workflow policies, capability API, SoD rules, and automated tests.

## 1. Authorization Rule

A permission grants an **action capability**. It never grants unconditional access by itself.

```text
ALLOW(action, user, record) =
  permission(action)
  AND object-scope(user, record)
  AND lifecycle-state-allows(action, record)
  AND workflow-assignment-allows(action, user, record)
  AND no-active-SoD-violation(action, user, record)
  AND valid-electronic-signature(action, user, record)
```

The backend evaluates this rule and returns record-level capabilities. The frontend uses the capability response to show or disable buttons; it must not independently decide authorization from a local permission list.

## 2. Boundary Between Permission, Role, Scope, and Button

| Concept | Meaning | Documents example |
|---|---|---|
| Permission | Stable business action a user can potentially perform | `documents.revision.approve` |
| Permission Set | Reusable package of action permissions | `PS_DOCUMENT_APPROVER` |
| Access Profile | Business persona: permission sets plus scope and workflow roles | `AP_QA_DOCUMENT_APPROVER` |
| Workflow Role | Eligibility to be selected/assigned in a workflow | `DOCUMENT_APPROVER` |
| Assignment | User is the current actor on this record | Approver #2 on revision SOP-0019 / Rev. 01 |
| Scope | Record population the Access Profile covers | Site HCM, Quality Assurance department |
| Lifecycle Policy | State in which the action is valid | Approve only at `PENDING_APPROVAL` |
| Button | UI representation of a capability | `Approve` button |

## 3. Independent Lifecycle State Machines

`Document Master`, `Document Revision`, and `Controlled Copy` are three distinct records. Each has its own status and lifecycle policy. A status in one object must never be treated as the status of either of the other objects.

| Object | Current lifecycle states to model separately | Meaning |
|---|---|---|
| Document Master | `DRAFT`, `ACTIVE`, `OBSOLETED`, `CLOSED_CANCELLED` | The identity and overall lifecycle of the controlled document. |
| Document Revision | `DRAFT`, `PENDING_REVIEW`, `PENDING_APPROVAL`, `PENDING_TRAINING`, `READY_FOR_PUBLISHING`, `EFFECTIVE`, `OBSOLETED`, `CLOSED_CANCELLED` | The lifecycle of one version of the document content. Multiple revisions can exist under one Document Master. |
| Controlled Copy | `READY_FOR_DISTRIBUTION`, `DISTRIBUTED`, `OBSOLETED`, `CLOSED_CANCELLED` | The lifecycle of a physical/electronic controlled-copy instance or batch. These are the four statuses shown in the Controlled Copy Batch UI. |

### 3.1 State Relationship Rules

```text
Document Master ACTIVE
  ├─ Revision 01 EFFECTIVE
  └─ Revision 02 DRAFT / PENDING_* / READY_FOR_PUBLISHING

Revision 01 EFFECTIVE
  └─ Controlled Copy A DISTRIBUTED
  └─ Controlled Copy B OBSOLETED (after recall/replacement handling)
```

- A Document Master can remain `ACTIVE` while a new Revision is still `DRAFT` or under review. The effective revision remains the currently controlled version until a replacement is published.
- Publishing a Revision changes that Revision to `EFFECTIVE`, keeps/sets the Document Master to `ACTIVE`, and obsoletes the previously effective Revision according to the revision-publishing policy.
- A Controlled Copy refers to an effective revision but has a separate operational status. Recalling, reporting lost/damaged, expiring or destroying a Controlled Copy are controlled business events/reasons; they do not create additional top-level lifecycle statuses and must not obsolete its parent Document Master or Revision.
- Obsoleting a Document Master is an orchestrated action: it may obsolete its effective Revision and require open controlled copies to be recalled/obsoleted under a separate controlled-copy policy. It is not a simple reuse of the Revision status.

### 3.2 Authorization Context by Action

| Action family | Statuses that must be evaluated |
|---|---|
| Create/edit/upload/submit/review/approve/train/publish a revision | Revision status; parent Document Master status where the action depends on an active master. |
| View/download a published document | Document Master status, selected Revision status, department scope, and download policy. |
| Request a controlled copy | Parent Document Master `ACTIVE`, source Revision `EFFECTIVE`, then the new Controlled Copy's own state. |
| Distribute/recall/destroy a controlled copy | Controlled Copy status first; source revision/document status only as an additional policy condition. |
| Cancel/obsolete a Document Master | Document Master status, then downstream revision and controlled-copy impact rules. |

The capability API must therefore return separate fields, for example:

```json
{
  "documentStatus": "ACTIVE",
  "revisionStatus": "PENDING_APPROVAL",
  "controlledCopyStatus": "DISTRIBUTED",
  "actions": {
    "approveRevision": { "allowed": true },
    "recallControlledCopy": { "allowed": true },
    "obsoleteDocument": { "allowed": false, "reason": "ACTIVE_REVISION_WORKFLOW_IN_PROGRESS" }
  }
}
```

## 4. Canonical Permission Catalog

### 3.1 Module and Document Master

| Code | Action | Screen/resource | Additional conditions |
|---|---|---|---|
| `documents.module.view` | Open Document Control | Sidebar, list workspace | User may enter the module; it does not alone grant record visibility. |
| `documents.document.view` | View Document Master | All Documents, Document Detail | Object scope and record visibility must pass. |
| `documents.document.create` | Create Document Master | New Document | Within permitted scope; opened-by/author requirements apply. |
| `documents.document.edit_metadata` | Edit Document Master metadata | Edit Document / General Information | Draft/editable state and object scope. It does not bypass Author or workflow rules. |
| `documents.document.manage_relations` | Add/remove Related or Correlated Document links | Revision setup / relation subtabs | Both the source and target must be visible; target cannot be the source document. |
| `documents.document.view_audit` | View audit trail | Document/Revision Audit Trail tab | Object scope plus audit-view policy. |
| `documents.document.cancel` | Cancel Document Master | Document Detail | Lifecycle policy, reason and e-signature where configured. |
| `documents.document.obsolete` | Obsolete Document Master | Document Detail | Normally `ACTIVE` only; lifecycle policy, reason and e-signature. |

### 3.2 Revision Authoring

| Code | Action | Screen/resource | Additional conditions |
|---|---|---|---|
| `documents.revision.create` | Create a new revision | Document Detail / Create Revision | Parent document visible; lifecycle policy allows a revision. |
| `documents.revision.edit_metadata` | Edit Revision metadata | Create/Edit Revision | `DRAFT`; assigned Author, permitted Co-author, or DCO override according to policy. |
| `documents.revision.upload_source` | Upload or replace revision source file | Create/Edit Revision / Upload Revision | `DRAFT`; **assigned Author only**. Co-author and DCO cannot upload the source file. |
| `documents.revision.edit_online` | Edit source in Office Online | Create/Edit Revision / Edit File Online | `DRAFT`, source unlocked, assigned Author or Co-author. |
| `documents.revision.complete_authoring` | Complete authoring and lock source | Revision Detail / Complete Authoring | `DRAFT`; Author or configured Co-author; source must pass required validations. |
| `documents.revision.open_publishing_workspace` | Open publishing workspace | Revision Detail / Publishing workspace | Completed authoring plus configured Publishing role/permission. |
| `documents.revision.preview_source` | Preview a draft source file | Revision Detail | Must be able to view the revision; draft access remains participant-limited. |
| `documents.revision.download_source` | Download a draft source file | Revision Detail | Must be able to view the revision; use only if download must be separately controlled. |

**Decision:** `documents.office_online.upload` and `documents.office_online.edit` should be migrated to the revision authoring names above. Office Online is an implementation channel, not a business resource boundary.

### 3.3 Revision Workflow and Lifecycle

| Code | Action | Screen/resource | Required lifecycle and assignment |
|---|---|---|---|
| `documents.revision.submit_review` | Submit revision for review | Revision Detail / Submit for Review | `DRAFT`, authoring completed, Author or configured DCO. |
| `documents.revision.review` | Complete review | Revision Detail / Review | `PENDING_REVIEW`, current assigned Reviewer only. The rule applies to every Document Type. |
| `documents.revision.reject_review` | Reject during review | Revision Detail / Reject | `PENDING_REVIEW`, current assigned Reviewer only. The rule applies to every Document Type. |
| `documents.revision.approve` | Complete approval | Revision Detail / Approve | `PENDING_APPROVAL`, current assigned Approver only; SoD must pass. |
| `documents.revision.reject_approval` | Reject during approval | Revision Detail / Reject | `PENDING_APPROVAL`, current assigned Approver only. |
| `documents.revision.complete_training` | Record completion of revision training | Document workflow / Training Information | `PENDING_TRAINING`; **DCO only** manages and records this step in the Documents workflow. |
| `documents.revision.publish` | Publish effective revision | Revision Detail / Publish | `READY_FOR_PUBLISHING`; **DCO only**. |
| `documents.revision.cancel` | Cancel in-progress revision | Revision Detail / Cancel | State policy plus reason; normally DCO/Document Controller. |
| `documents.revision.obsolete` | Obsolete an effective revision | Document Detail / Obsolete | Normally executed as part of `documents.document.obsolete`; keep only if the business needs an independent revision action. |
| `documents.revision.upgrade` | Create new revision from an effective revision | Document Detail / Create Revision | Parent active and visible; Author/DCO under lifecycle policy. |

**Decision:** `documents.revision.submit`, `documents.revision.reject`, and `documents.revision.upload_file` are non-canonical aliases. They must not appear in new Permission Sets.

### 3.4 Published Document Access

| Code | Action | Screen/resource | Additional conditions |
|---|---|---|---|
| `documents.document.preview_published` | Preview the effective published document | Document Detail / Preview | `documents.document.view`, record belongs to the user's permitted department scope, effective-like revision. |
| `documents.document.download_published` | Download the effective published document | Document Detail / Download | Same department scope as preview, **plus** an explicit download permission and a Document Type/Document Access Policy that enables download. |

**Decision:** preview and download stay separate. A user may view and preview documents in their permitted department, but download is enabled only when both their Permission Set and the Document Type/Document Access Policy permit it. The recommended default is **Preview allowed, Download disabled** until the business approves download for a document category.

### 3.5 Controlled Copies

| Code | Action | Screen/resource | Additional conditions |
|---|---|---|---|
| `documents.controlled_copy.view` | View controlled-copy log and own copies | Controlled Copies | Record scope; holder sees own assigned copy where policy permits. |
| `documents.controlled_copy.request` | Request a controlled copy | Request Controlled Copy | Effective source revision; request reason and recipient required. |
| `documents.controlled_copy.approve_request` | Approve a controlled-copy request | Controlled Copy Detail | Current assigned authorizer; SoD/reason/signature according to policy. |
| `documents.controlled_copy.reject_request` | Reject a controlled-copy request | Controlled Copy Detail | Current assigned authorizer; rejection reason required. |
| `documents.controlled_copy.prepare_distribution` | Prepare approved copy for distribution | Controlled Copy Detail | Approved request; Controlled Copy Coordinator. |
| `documents.controlled_copy.distribute` | Mark a copy distributed | Controlled Copy Detail | Prepared copy; Controlled Copy Coordinator. |
| `documents.controlled_copy.recall` | Recall a distributed copy | Controlled Copy Detail | `DISTRIBUTED`; Coordinator/DCO; reason required. The copy moves to `OBSOLETED` according to policy. |
| `documents.controlled_copy.report_lost_damaged` | Report a copy lost or damaged | Controlled Copy Detail | `DISTRIBUTED`; records an event/reason, not a new lifecycle status. Coordinator/DCO handles the resulting disposition. |
| `documents.controlled_copy.replace_lost_damaged` | Issue replacement copy | Controlled Copy Detail | Source copy is `OBSOLETED` after loss/damage disposition; Coordinator/DCO creates a replacement batch/copy. |
| `documents.controlled_copy.expire` | Expire a copy | Controlled Copy Detail / scheduler | `READY_FOR_DISTRIBUTION` or `DISTRIBUTED`; event moves the copy to `OBSOLETED` under policy. The scheduler uses a service identity. |
| `documents.controlled_copy.destroy` | Record physical destruction | Controlled Copy Detail | `OBSOLETED`; Coordinator/DCO records reason/evidence. The lifecycle status remains `OBSOLETED`. |
| `documents.controlled_copy.cancel_request` | Cancel pending batch distribution | Controlled Copy Detail | `READY_FOR_DISTRIBUTION`; DCO cancels the batch, moving it to `CLOSED_CANCELLED`. |
| `documents.controlled_copy.preview_file` | Preview rendered controlled-copy file | Controlled Copy Detail | Must be allowed to view that specific copy. |
| `documents.controlled_copy.download_file` | Download rendered controlled-copy file | Controlled Copy Detail | Explicitly controlled; may be denied for online-only copies. |
| `documents.controlled_copy.upload_evidence` | Upload destruction/receipt evidence | Controlled Copy Detail | Relevant Coordinator/holder action and copy status. |
| `documents.controlled_copy.view_evidence` | View controlled-copy evidence | Controlled Copy Detail | View permission plus copy scope. |
| `documents.controlled_copy.download_evidence` | Download controlled-copy evidence | Controlled Copy Detail | Explicitly controlled where evidence is sensitive. |
| `documents.controlled_copy.generate` | Generate a controlled-copy file | Backend service action | Not assignable to a person. It is executed only after a permitted business action. |

**Decision:** retire broad `documents.controlled_copy.authorize`. Approval, rejection, preparation, distribution, recall, replacement and destruction are independently auditable GxP actions.

### 3.6 Document Administration

| Code | Action | Screen/resource | Additional conditions |
|---|---|---|---|
| `documents.admin.view` | Open Document Administration | Document Administration | Does not grant document record mutation by itself. |
| `documents.admin.manage_workflow_roles` | Maintain DCO/Reviewer/Approver role pools | Document Administration / Workflow Roles | Security change control, audit trail and e-signature. |
| `documents.admin.manage_sod_constraints` | Maintain Document SoD rules | Security & Authorization / SoD | Security change control, audit trail and e-signature. |

## 5. Actions That Must Not Become Human Permissions

The following are internal technical operations. They are invoked after a permitted business action and must not be selectable in a Permission Set:

- Generate or regenerate preview/review snapshot.
- Synchronize a draft to Office Online.
- Refresh revision list/cache.
- Create a preview version token.
- Generate a controlled-copy file after authorization.

The code may retain technical endpoint guards, but the guard must derive from the parent business capability rather than create a second hidden permission catalog.

## 6. Required Workflow Roles

These roles determine eligibility/assignment, not general capability.

| Workflow role | Typical actions enabled after assignment |
|---|---|
| `DOCUMENT_AUTHOR` | Edit metadata, upload source, complete authoring, submit review |
| `DOCUMENT_CO_AUTHOR` | Edit draft content online where the policy allows; cannot upload or replace the revision source file |
| `DOCUMENT_REVIEWER` | Review or reject review when current assignee |
| `DOCUMENT_APPROVER` | Approve or reject approval when current assignee |
| `DOCUMENT_CONTROLLER` | Create/manage documents, record training completion, publish ready revisions, revision cancellation, and controlled-copy coordination as separately granted |
| `CONTROLLED_COPY_COORDINATOR` | Prepare/distribute/recall/destroy controlled copies as separately granted |

## 7. Mandatory Initial SoD Rules

| Rule | Default decision |
|---|---|
| Author of a revision cannot approve the same revision | Deny |
| Co-author of a revision cannot approve the same revision | Deny |
| Reviewer cannot approve the same revision | Deny for every Document Type |
| System Administrator has no automatic business approval/publishing right | Deny unless separate Access Profile is assigned |

## 8. Permission Set Templates to Create After Approval

| Permission Set | Included canonical actions |
|---|---|
| `PS_DOCUMENT_READER` | module/view/published preview; optional published download |
| `PS_DOCUMENT_AUTHOR` | document create/edit/relations, revision create/edit/upload/edit-online/complete/submit, draft preview/download as policy permits |
| `PS_DOCUMENT_REVIEWER` | document/revision view, review, reject review |
| `PS_DOCUMENT_APPROVER` | document/revision view, approve, reject approval |
| `PS_DOCUMENT_CONTROLLER` | document management, revision create/upgrade/cancel, record training completion, publishing workspace/publish, controlled-copy operational permissions as approved |
| `PS_CONTROLLED_COPY_COORDINATOR` | controlled-copy view, prepare, distribute, recall, replacement, destruction, evidence actions |
| `PS_DOCUMENT_SECURITY_ADMIN` | document administration permissions only; not business author/reviewer/approver rights |

## 9. Implementation Acceptance Criteria

Before any permission is marked implemented:

1. The canonical code exists in the backend permission table and is shown in the Permission Set catalog.
2. No new Permission Set can select a retired alias.
3. Each human action has backend enforcement using exactly the canonical code.
4. Backend capability API returns `allowed`, `requiredPermission`, `state`, `assignment`, `scope`, and a safe denial reason.
5. The UI button is driven by that capability result.
6. Unit/integration tests cover allowed and denied cases for permission, state, scope, assignment and SoD.
7. Every human-triggered Document Control business action requires electronic signature. System-scheduled technical operations use a service identity and are audit logged; they do not impersonate a human signature.
8. Any change to permission, role assignment, scope, workflow policy or SoD rule is audited and electronically signed.

## 10. Confirmed Business Decisions

| Decision | Confirmed rule |
|---|---|
| Revision source upload | Only the assigned Author may upload or replace the revision source file. |
| Reviewer action | A user assigned as Reviewer may review or reject that revision regardless of Document Type; the user must be the current assigned Reviewer. |
| Publishing | DCO publishes a revision; no separate Publisher persona is required for v1. |
| Training | Training remains inside the Document workflow and DCO manages/records the step. |
| Electronic signature | Every human-triggered Document Control business action requires electronic signature; no second-person signature is required. |
| Department visibility | A user may view documents belonging to the department scope assigned to the user. |
| Download | Download is configurable and is allowed only when both the user's Permission Set and the applicable Document Type/Document Access Policy enable it. Default recommendation: preview enabled, download disabled. |

## 11. Final Confirmation Needed for Download

The recommended implementation is a three-level decision:

```text
Department scope allows viewing the document
  AND Permission Set grants documents.document.download_published
  AND Document Type / Document Access Policy enables download
  = Download allowed
```

This permits, for example, SOP documents to be preview-only while non-controlled guidance documents may be downloadable by their owning department. If this recommendation is approved, it becomes the default download policy in implementation.
