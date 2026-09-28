# Document Control Role / Action Matrix

Snapshot reviewed: 30 July 2026.  This matrix is based on the active database
workflow policies, effective permission sets, backend authorization services,
and the buttons rendered by the Document and Revision workspaces.

Legend: `✓` allowed when the stated assignment and permission are present;
`—` not an allowed workflow action; `!` currently inconsistent between UI and
API and requires remediation before UAT sign-off.

## Preconditions

Role labels are not an authorization source.  The application evaluates an
Access Profile -> Permission Set -> Permission chain, plus the assignment on
the exact Document/Revision (Author, Co-author, Reviewer, or Approver).

| Role | Required assignment | Key permissions |
|---|---|---|
| DCO | Access Profile granted Document Control workspace access | `documents.workspace.manage` plus each action permission |
| Author | Assigned as the Document/Revision Author | `documents.revision.upload_source`, `documents.revision.complete_authoring`, `documents.document.edit_metadata` where Draft master metadata is changed |
| Co-author | Assigned as `CO_AUTHOR` on the Revision | Source/edit permissions where enabled |
| Reviewer | Assigned as the current pending Reviewer | `documents.revision.review` / `documents.revision.reject_review` |
| Approver | Assigned as the current pending Approver | `documents.revision.approve` / `documents.revision.reject_approval` |

## Document Master buttons

| Status | Button / action | DCO | Author | Co-author | Reviewer | Approver | Effective rule |
|---|---|---:|---:|---:|---:|---:|---|
| Draft, no Revision | New Document / Save Draft | ✓ | — | — | — | — | `documents.workspace.manage` is required by the create API. |
| Draft, no Revision | Edit Document | ✓ | ✓ | — | — | — | DCO: `edit_metadata` + `workspace.manage`; Author: assigned Author + `upload_source` + `edit_metadata`. |
| Draft | Cancel Document | ✓ | — | — | — | — | `workspace.manage` + `documents.document.cancel`. |
| Active | Obsolete Document | ✓ | — | — | — | — | `workspace.manage` + `documents.document.obsolete`. |
| Closed-Cancelled | Reopen Document | — | — | — | — | — | Dedicated `documents.document.reopen`; normally System Administration only. |
| Any visible document | View Audit Trail | ✓ | ✓ | ✓ | ✓ | ✓ | User must have document visibility and `documents.document.view_audit`. |

Once the first Revision exists, Document Master metadata is no longer the
authoring entry point.  Users must continue from the Draft Revision workspace.

## Revision buttons and status transitions

| Revision status | Button / action | DCO | Author | Co-author | Reviewer | Approver | Effective rule |
|---|---|---:|---:|---:|---:|---:|---|
| Draft | Open/Edit Revision workspace | ✓ | ✓ | ✓ | — | — | Exact Revision must be Draft; Author/Co-author are assignment-based, DCO is workspace-management based. |
| Draft | Upload / Replace source file | —* | ✓ | ! | — | — | Must be DOC/DOCX, unlocked, and have `documents.revision.upload_source`. See discrepancy 2. |
| Draft | Edit Online / Sync Office file | —* | ✓ | ! | — | — | Must be an unlocked DOC/DOCX and have Office permissions. See discrepancy 2. |
| Draft | Complete authoring (locks source) | — | ✓ | ! | — | — | Requires `documents.revision.complete_authoring`; see discrepancy 3. |
| Draft | Update Revision metadata / workflow people | ✓ | ! | — | — | — | Workflow policy requires `documents.workspace.manage`; see discrepancy 1. |
| Draft | Generate / regenerate review snapshot | ✓ | — | — | — | — | DCO workspace management. Current policy uses the wrong required permission code; see discrepancy 4. |
| Draft, source completed and locked | Submit for Review | ✓ | — | — | — | — | `documents.workspace.manage`; source must be completed and locked. |
| Pending Review | Approve Review / Reject Review | — | — | — | ✓ | — | Must be the assigned pending Reviewer, in sequence, with Review permission. |
| Pending Approval | Approve / Reject Approval | — | — | — | — | ✓ | Must be the assigned pending Approver with Approval/Reject permission. |
| Pending Training | Complete Training | ✓ | — | — | — | — | `documents.workspace.manage` + `documents.revision.complete_training`. |
| Ready for Publishing | Open Publishing Workspace / Publish | ✓ | — | — | — | — | `documents.workspace.manage` + publish permission. |
| Effective | Upgrade Revision | ✓ | — | — | — | — | `documents.workspace.manage` + `documents.revision.upgrade`. |
| Effective | Obsolete Revision | ✓ | — | — | — | — | `documents.workspace.manage` + `documents.revision.obsolete`. |
| Draft | Cancel Revision | ✓ | ✓ | ✓ | — | — | Author/Co-author or DCO workspace manager, plus `documents.revision.cancel`. |

`*` DCO is able to manage metadata and lifecycle steps but is deliberately not
the source-file Author unless also assigned as Author/Co-author.

## Current implementation findings requiring a decision/fix

1. **Author/Co-author Edit Revision can be visible but metadata Save requires
   DCO workspace permission.**  The list/detail entry check accepts Draft
   Author or Co-author, but `RevisionService.updateRevision` requires
   `documents.workspace.manage`.  Either grant an Author-specific metadata
   action or limit the Edit Revision button to DCO for metadata operations.

2. **Co-author source-file actions are inconsistent.**  The capability API
   advertises source upload/replace and Edit Online for an assigned Co-author,
   but the mutation endpoint first checks the Document Author.  Co-author can
   see a button that can be rejected by the server.  The recommended rule is
   to allow assigned Co-author consistently when the source permission exists.

3. **Co-author Complete Authoring is inconsistent.**  The direct endpoint
   allows an assigned Co-author, while the active workflow policy/capability
   allows Author only.  Choose one GMP rule and apply it to both layers.

4. **Snapshot policy permission is misconfigured.**  The active
   `GENERATE_REVIEW_SNAPSHOT` and `REGENERATE_SNAPSHOT` policies use
   `documents.revision.submit_review` instead of
   `documents.revision.generate_preview`.  DCO currently has both grants, so
   UAT may pass, but the permission catalog and policy do not match.

5. **The supplied UAT accounts are not isolated by role.**  `user.b.test`,
   `user.c.test`, and `user.d.test` all use
   `AP_UAT_DOCUMENT_CONTRIBUTOR_QUALITY`, which grants Author, Reviewer, and
   Approver workflow roles together.  Their results cannot prove segregation
   of duties.  Create dedicated profiles/accounts for Author, Co-author,
   Reviewer, and Approver before formal UAT.

## Recommended UAT scenarios

1. DCO creates a Draft, assigns Author/Co-author/Reviewer/Approver, and saves.
2. Author uploads a DOCX, edits it, completes authoring, and confirms source
   is locked.
3. DCO generates the snapshot and submits for review.
4. The assigned Reviewer completes/rejects review; then the assigned Approver
   completes/rejects approval.
5. DCO completes required training, opens publishing, and publishes.
6. DCO upgrades the Effective revision, then verifies the next Draft follows
   the same segregation-of-duties rules.
