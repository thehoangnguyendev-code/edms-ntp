# Change record — next-revision configuration not blocked after COMPLETE_AUTHORING (MinIO-only)

**Date:** 2026-09-08
**Area:** Document Control — "Edit Revision for Upgrade" / next-revision configuration
**Type:** Defect fix (guard gap) + FE relabel + test

## 1. Problem

`DocumentService.describeWhyNextRevisionIsNotConfigurable` decides whether the DCO may still
configure the next revision (reviewers/approvers/related/correlated/review-date/training) on an
Active document. It blocks when the in-progress revision is:
- past Draft (`PENDING_REVIEW/PENDING_APPROVAL/PENDING_TRAINING/READY_FOR_PUBLISHING`), or
- already uploaded to Office Online (`storageItemId` + `storageDriveId` set).

But `RevisionService.completeEditing` sets `editingStatus="COMPLETED"` + `sourceLocked=true`,
records the Author's `PREPARED` e-signature, and leaves the revision status at DRAFT — and it does
**not** require an Office Online working copy (a MinIO-only source revision reaches COMPLETED with
no `storageItemId`). Such a revision was still reported as "configurable".

`RevisionService.syncDraftRevisionWithDocument` refuses to propagate later changes to a Draft whose
`editingStatus == "COMPLETED"`, so a configuration change made in that window would be saved on the
Document but never reach the revision the Author already signed off — the two silently diverge, and
`submitForReview` then validates SoD/reviewers against the stale revision snapshot.

## 2. Fix

`describeWhyNextRevisionIsNotConfigurable` also blocks when the in-progress Draft has
`editingStatus == "COMPLETED"` or `sourceLocked == true`:

> "Cannot configure the next revision: revision X has already completed authoring and its source is locked."

This flows through both consumers automatically: the capability endpoint
(`DocumentMasterActionCapabilityService.nextRevisionConfigurablePermission`) reports the
`configureNext*` actions as not allowed, so the button/Save never render; and
`requireNoRevisionBeyondConfigurableStage` rejects a direct API call at save time.

## 3. Frontend (same review)

`DetailDocumentView.tsx`: the button/modal that *enters* edit mode now relabels by context —
`Edit Revision for Upgrade` when no in-progress Draft exists, `Adjust Upgrade Configuration` (with a
modal note that changes apply to the Draft already in progress) when one does. Visibility and the
Save button gating are unchanged; the Save button already re-derives from the 10s capability poll +
`revision-workflow-updated` realtime event, so it disappears within ~10s of the revision locking
even without a reload, and a stale-state save is rejected server-side.

## 4. Evidence

- New integration test `DocumentLifecycleBaselineTest.tcDoc014_nextRevisionNotConfigurableOnceInProgressDraftCompletedAuthoring`:
  early-stage Draft (IN_PROGRESS, no Office Online copy) → `isNextRevisionConfigurable == true`;
  after `editingStatus=COMPLETED` + `sourceLocked=true` (still no storage IDs) → `== false`.
- `DocumentLifecycleBaselineTest` 23/0/0 · `DocumentMasterActionCapabilityServiceTest` 5/0/0 ·
  `RevisionBusinessRulesTest` 33/0/0 · `RevisionUpgradeSessionServiceTest` 3/0/0.
- FE `tsc --noEmit` clean.
- Change confined to `DocumentService.describeWhyNextRevisionIsNotConfigurable` (+4 lines) and
  `DetailDocumentView.tsx` (relabel).

## 5. Rollback

Pure additional guard; reverting re-opens the gap but breaks nothing. No migration.
