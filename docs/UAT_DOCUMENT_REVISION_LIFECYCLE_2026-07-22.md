# UAT – Document revision, snapshot and comment lifecycle

**Date:** 22 July 2026  
**Environment:** local Docker (`frontend`, `backend`, PostgreSQL, MinIO)  
**Roles exercised:** DCO (User A), Author (User B), Co-author (User D – existing response evidence), Reviewer (User C), Approver (User F).  
**Credentials:** test credentials were used interactively and are intentionally not recorded in this report.

## Scope and GMP controls verified

- Immutable PDF review snapshots and round-to-round comparison.
- Reviewer comment ownership, edit/delete restrictions and Author reply/resolution trace.
- Electronic signatures at Review, Approval and Publish.
- Status transitions and immutable audit-trail evidence.
- Publishing snapshot regeneration after Effective.

## Defect found and corrective change

### Critical: published PDF preview was denied to document viewers

Follow-up verification of the effective revision `SOP.0029 / 1.0.0` found that the
published PDF was present in MinIO and referenced by publishing metadata, but both
Revision Details and Document Details showed no preview for the DCO. The preview
endpoint correctly enforced `documents.document.preview_published`; however, the
current DCO Access Profile held `documents.document.view` without this companion,
read-only file permission.

**Correction implemented:**

- Migration `V271__grant_published_preview_to_document_viewers.sql` grants
  `documents.document.preview_published` to every permission set already granted
  `documents.document.view`.
- It deliberately does **not** grant download. Published-document download remains
  separately governed by `documents.document.download_published`.
- `DetailDocumentView` now surfaces a server-preview failure instead of incorrectly
  presenting it as though no effective PDF exists.

The corrected `PS_UAT_DOCUMENT_DCO` permission set was verified after migration;
the published object was verified in MinIO at the immutable version recorded by
publishing metadata.

### Critical: review snapshot history could be overwritten

During the UAT of revision `SOP.0029 / 0.0.1`, records in `revision_snapshot_history` for rounds 1 and 2 pointed to the same MinIO object key:

`documents/SOP.0029/revisions/0.0.1/review/review-snapshot.pdf`

This is not acceptable for GMP because MinIO bucket versioning may be disabled or unavailable; a later preview could then overwrite a reviewed record.

**Correction implemented:**

- `StoragePathBuilder` now creates an immutable key: `.../review/round-{n}/{snapshot-id}.pdf`.
- `FileStorageService`, `PublishingWorkspaceService` and `RevisionSnapshotAsyncService` now generate one UUID before storage and use it both for the immutable key and `RevisionSnapshotHistory.id`.
- The current preview metadata still points to the newest generated immutable object, while previous round records retain their own physical object.
- The Document tab now surfaces an explicit warning if a historical snapshot cannot load; it does not silently omit the second preview.

After deployment, two new round-2 records were verified with distinct object keys and distinct MinIO version IDs. The latest Effective regeneration was also recorded under a unique round-2 object key.

## Build and deployment verification

| Check | Result |
|---|---|
| Frontend `npm run build` | Passed |
| Backend `mvnw.cmd -q -DskipTests package` | Passed |
| Docker rebuild `docker compose up -d --build frontend backend` | Passed |
| Backend health check | Healthy |
| Search for `window.prompt` in revision/document UI | No matches |

## Executed UAT steps

### A. New Document data-entry validation

1. Signed in as DCO and created new controlled document `SOP.0030`.
2. Selected Author B, Co-author D, Quality Unit, Quality Assurance, SOP document type, review cycle and notification values.
3. Verified the new validation requires a Department and, where training is not required, a reason for skipping training.
4. Saved Reviewers and Approvers, then clicked the parent **Save** action and reloaded the document.
5. Confirmed Reviewer C and Approver F persisted.

**Observation:** the participant dialogs update the document form first; the parent **Save** persists the overall document. This is functional but should be made clearer in a later UX change (for example, label the button “Update selection – save document to persist”).

### B. Revision workflow and comments

The active controlled UAT revision `SOP.0029 / 0.0.1` was used for the completed workflow because it already contained the uploaded source, Office Online working copy and a rejected-round history required to test comparison/comment behavior.

1. Verified old round comments were read-only for Reviewer C after resubmission: no Edit/Delete control was available.
2. Opened **Comment & Edit History** and verified the Author reply could be expanded from the right panel.
3. Completed Review as C with an electronic signature and reason.
4. Confirmed database state transitioned to `PENDING_APPROVAL`, `review_round = 2`, `snapshot_status = READY`.
5. Signed in as Approver F, completed Approval with electronic signature and reason. An open-comment confirmation was presented before signing, preserving explicit decision evidence.
6. Confirmed transition to `READY_FOR_PUBLISHING`.
7. Signed in as DCO A, opened Publishing Workspace, then published with electronic signature and reason.
8. Waited for the asynchronous Effective PDF regeneration to finish.
9. Confirmed final database state: `EFFECTIVE`, `snapshot_status = READY`, `source_locked = true`.

## Audit evidence verified

For the completed revision, `audit_logs` contains, in order, signed Review, Approval and Publish events:

- `REVIEW_COMPLETE`: `PENDING_REVIEW` → `PENDING_APPROVAL`, signature applied.
- `APPROVE_COMPLETE`: `PENDING_APPROVAL` → `READY_FOR_PUBLISHING`, signature applied.
- `PUBLISH`: `READY_FOR_PUBLISHING` → `EFFECTIVE`, signature applied.
- `EFFECTIVE_SNAPSHOT_REGENERATED`: asynchronous final PDF regeneration.

## Result and residual test item

The production workflow path through **Effective** passed for `SOP.0029 / 0.0.1`, and the critical snapshot-storage flaw was corrected, rebuilt and revalidated.

The new-document data entry and participant persistence path passed for `SOP.0030`. A completely fresh `SOP.0030` revision was not run through to Effective in this pass because the new revision route depends on in-app navigation state from the document workspace; it did not expose a standalone document selector when opened directly. This is a UX/navigation test limitation, not evidence of a backend workflow failure. It should be run as one final clean-record regression after adding or confirming a direct “Create Revision” action from the saved Document Revisions tab.

No legacy snapshot is claimed to be repaired: earlier records that already shared the old mutable key cannot be retrospectively proven immutable. New snapshots created after this correction use unique physical keys.
