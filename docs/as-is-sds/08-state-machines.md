# 08 — State Machines (AS-IS)

Evidence: direct read of `service/DocumentService.java`, `service/RevisionService.java`, `service/ControlledCopyService.java`, `service/RevisionWorkflowAuthorizationService.java`, plus the async/scheduler classes cited inline. **Document, Document Revision, and Controlled Copy lifecycles are all fully confirmed below** (two independent verification passes were run on the Document/Revision/Controlled Copy trace and reconciled — see §8.4.3b for the one correction that resulted). For a BA/QA-readable, per-workflow narrative of the same confirmed behavior (steps, actor, preconditions, target state, side effects), see `07-workflows.md`; for the canonical rule catalog derived from this file, see `09-business-rules.md`.

## 8.0 Architectural finding: there is NO declarative transition graph
`LifecycleStatePolicyEvaluator`, `LifecycleStatePolicyService`, `WorkflowActionPolicyService`, `WorkflowActionDefaultPolicyRegistry` are **actor/permission gates only** — each policy row is keyed by `(capabilityCode or actionCode, fromStatus, documentTypeId, actorScope, requiredPermissionCode)`. None of them carries a `toStatus`/next-state field. **The legal state graph itself is hardcoded imperatively inside `DocumentService`/`RevisionService` methods** as `if`/`throw IllegalStateException` guards, not data-driven. This is `IMPLEMENTATION-DISCOVERED` and architecturally significant: adding a new lifecycle state requires a code change to the relevant `*Service` class, even though WHO-can-act is fully data-driven.

## 8.1 Document status values confirmed in code (`DocumentService.java`)
Exact literals compared/set: `DRAFT`, `ACTIVE`, `EFFECTIVE`, `OBSOLETED`, `CLOSED_CANCELLED`, `PENDING_REVIEW`, `PENDING_APPROVAL`, `PENDING_TRAINING`, `READY_FOR_PUBLISHING` (these last several appear to be Revision-status literals reused/checked from the Document side to gate Document-level actions), plus Controlled-Copy stage literals `DISTRIBUTED`, `READY_FOR_DISTRIBUTION`/`READY FOR DISTRIBUTION`.
There is **no** `EXPIRED` document status literal in `DocumentService`. Action-type strings used only for audit logging (`"OBSOLETE"`, `"CANCEL"`) must not be confused with status codes (`"OBSOLETED"`, `"CLOSED_CANCELLED"`) — they are distinct fields (action vs. resulting status).

## 8.2 Document: CANCEL transition — `DocumentService.cancelDocument()`
- Guard: `documentAuthorizationService.requireDocumentMasterLifecycleAction(currentUser, document, "CANCEL")`.
- **Hard precondition**: throws `IllegalStateException` if the document has **any** revision at all (`documentRevisionRepository.existsByDocument_Id(documentId)`), regardless of that revision's status. Code comment: cancel is only for documents that "never started"; once a revision exists, Obsolete is the required path.
- Effect: status → `CLOSED_CANCELLED`; sets `cancelledBy`, `cancelledAt`, `openedBy`, `lastModifiedBy`; single `documentRepository.save()`.
- **No electronic signature required** for Cancel (contrast with Obsolete, 8.3) — `IMPLEMENTATION-DISCOVERED` asymmetry: QF states Cancel "requires the Activity Summary to be filled in" but doesn't call for e-signature either way, so this is `QF-MATCH` on absence-of-signature, but the doc-has-no-revision guard is `IMPLEMENTATION-DISCOVERED` (not in QF text).
- No cascade (guard makes revisions impossible to exist at this point). No async/event publish observed.
- `@Transactional`; concurrency = `@Version lockVersion` optimistic lock only, no explicit re-fetch before final save.

## 8.3 Document: OBSOLETE transition — `DocumentService.obsoleteDocument()`
```
requireDocumentMasterLifecycleAction(user, doc, "OBSOLETE")
requireValidSignatureToken(request, user)          // e-signature REQUIRED, consumed
assert fromStatus == "ACTIVE"                       // else IllegalStateException
assert an EFFECTIVE revision exists                 // else exception
assert no revision in {DRAFT, PENDING_REVIEW, PENDING_APPROVAL, PENDING_TRAINING, READY_FOR_PUBLISHING}
                                                      // i.e. no in-progress revision — else exception
doc.status = OBSOLETED; obsoletedBy/obsoletedAt/openedBy/lastModifiedBy set; save()
electronicSignatureService.createEntitySignature(... "OBSOLETED" ...)   // persisted signature row
```
**Cascade to Document Revisions (answers the priority question "Document Obsolete → Revisions"):**
```
for each DocumentRevisionRecord of this document (all, ordered by createdAt desc):
    if status in {OBSOLETED, CLOSED_CANCELLED}: skip (already terminal)
    else: revisionService.obsoleteRevisionAsPartOfDocumentObsolete(revision, obsoletedRevisionStatus, user, obsoletedAt, signatureSessionId)
```
Confirmed **`QF-MATCH`** with QF's "BR_DOC02 (Obsolete Revisions): all related open Document Revisions linked to the parent record are automatically marked as Obsoleted." Delegates to a real `RevisionService` method (not a raw field flip) — an in-code comment notes this replaced an earlier version that only flipped status fields with a plain `save()` and no per-revision history/audit, i.e. the cascade used to be an `IMPLEMENTATION-GAP` that has since been fixed. Exact internals of `obsoleteRevisionAsPartOfDocumentObsolete` (audit detail, history row, notification) are **UNKNOWN** — not yet read; follow-up needed for full 07-workflows detail.

**Cascade to Controlled Copies (answers the priority question "Revision/Document Obsolete → Controlled Copy"):**
```
for each ControlledCopyRecord where revision.document.id == this document (all):
    distributed = statusCode=="DISTRIBUTED" or currentStage=="DISTRIBUTED"
    readyForDistribution = statusCode=="READY_FOR_DISTRIBUTION" or currentStage=="READY FOR DISTRIBUTION"
    if not (distributed or readyForDistribution): skip
    copy.status="Obsoleted"; copy.statusCode="OBSOLETED"; copy.currentStage="Obsoleted"
    copy.obsoleteReason="DOCUMENT_OBSOLETED"; obsoletedBy/obsoletedAt set; save()
    auditTrailService.logAs(..., "OBSOLETE", copyFromStatus, "Obsoleted", ..., signatureSessionId)
controlledCopyBatchStatusService.synchronize(controlledCopies)
```
This is a **document-level** cascade path with reason code `DOCUMENT_OBSOLETED`. Note both `statusCode`/`currentStage` are checked with an OR — `IMPLEMENTATION-DISCOVERED` defensive dual-field check suggesting these two fields have drifted or are kept in sync manually elsewhere (see `ControlledCopyBatchStatusDiscrepancy` entity in `02-architecture.md` — a dedicated drift-detection entity exists, corroborating that `status`/`statusCode`/`currentStage` can disagree). **A parallel path exists at the Revision level** (`ControlledCopyService`/an event listener reacting to a single revision becoming OBSOLETED, likely with a different reason code such as `REVISION_OBSOLETED`) — **UNKNOWN/pending**, not yet confirmed by direct read; do not assume it is identical to this document-level cascade until verified.

- `@Transactional` for the whole method (single revisions loop + copies loop + audit, one transaction).
- **Concurrency**: only `@Version lockVersion` optimistic locking on `DocumentRecord`; the `fromStatus=="ACTIVE"` check happens once early in the method, then several repository reads/writes occur before the final save — a TOCTOU window exists within the same transaction, protected only by the version column (which will cause an `OptimisticLockException` on concurrent writers to the *same row*, but does **not** protect against a concurrent action on a *revision* or *controlled copy* row proceeding under a now-stale document status read earlier in the method). Classify as `IMPLEMENTATION-GAP` candidate for the "two users acting concurrently" priority question — needs the Revision/Controlled-Copy side confirmed before finalizing severity.

## 8.4 Controlled Copy state machine — CONFIRMED (`service/ControlledCopyService.java`, `ControlledCopyExpiryScheduler.java`, `RevisionService.java`)

### Confirmed statusCode values (record level)
`READY_FOR_DISTRIBUTION`, `DISTRIBUTED`, `OBSOLETED`, `CLOSED_CANCELLED` — exactly the 4 states QF names (`QF-MATCH` on the state set). Human-readable `status` label field is kept in lockstep via a single shared helper `setControlledCopyStatus(copy, statusCode)` for every normal single-record transition — labels: `"Ready for Distribution"`, `"Distributed"`, `"Obsoleted"`, `"Closed - Cancelled"`. A parallel free-text `currentStage` field also exists and is not always updated by the same helper (see divergence note below).
`obsoleteReason` values: `EXPIRED`, `RECALLED`, `LOST`, `DAMAGED`, `DESTROYED`, `DOCUMENT_OBSOLETED` (from 8.3), `REVISION_OBSOLETED` (below). No `REQUESTED`/`APPROVED`/`PRINTED` statusCode exists — printing does not change status (8.4.4).

Batch entity (`ControlledCopyDistributionBatch`) mirrors the same 4 statusCode values, set as adjacent literal pairs at each call site (not via a shared helper) — `DISTRIBUTED`/`"Distributed"`, `OBSOLETED`/`"Obsoleted"`, `CLOSED_CANCELLED`/`"Closed - Cancelled"`.
Distribution **job/job-item** status is a **separate vocabulary**: `PENDING`, `PROCESSING`, `SUCCESS`, `FAILED`, `SKIPPED`, `COMPLETED`, `COMPLETED_WITH_ERRORS` — do not conflate with copy/batch statusCode.

### Transitions
**Request → Ready for Distribution** (`ControlledCopyService.requestControlledCopy`): guards — document not a template; revision must be Effective (`requireEffectiveRevision`); `ControlledCopyAuthorizationService.requireRequestControlledCopy`; signature token validated; email/external-recipient policy checks; quantity/recipient math; non-privileged users restricted to exactly 1 internal copy for self. Sets `READY_FOR_DISTRIBUTION`. Audit `"REQUEST"`. E-signature `"CONTROLLED_COPY_REQUESTED"` recorded once **per batch**, not per copy. Creates a `ControlledCopyDistributionBatch`.

**Ready for Distribution → Distributed** (`distributeBatch`/`distribute`): guards — `requireDistributeControlledCopy`; signature token; **comment is mandatory (non-blank)** — `QF-MATCH` ("system must require entry of comments"); `ensureControlledCopyNotExpired`. Sets `DISTRIBUTED` (batch + each copy). Audit `"DISTRIBUTE"` (copy + batch). E-signature `"CONTROLLED_COPY_DISTRIBUTED"`. Notifications: `notifyControlledCopyStakeholders`, `sendControlledCopyDistributionNotification` — `QF-MATCH`. **Async fan-out** (batch only): creates `ControlledCopyDistributionJob`, publishes `ControlledCopyBatchDistributedEvent` → consumed after commit by `ControlledCopyBatchDistributionAsyncService.onBatchDistributed` → per-copy `finalizeDistributedCopy`, which **re-fetches the copy fresh by id and checks `isTerminalControlledCopyStatus` before mutating**, returning `SKIPPED_TERMINAL` if a concurrent action already moved it to a terminal state — this is the concurrency guard for distribute (see 12-transaction-concurrency.md).

**Ready for Distribution → Closed-Cancelled** (`cancel`/`cancelBatch`): only legal while `READY_FOR_DISTRIBUTION` (`ensureCanCancel`) — **a Distributed copy can never be cancelled**; batch-cancel silently filters out already-Distributed copies as "ineligible" rather than failing the whole request (`IMPLEMENTATION-DISCOVERED`). E-signature `"CONTROLLED_COPY_DISTRIBUTION_CANCELLED"`. Async finalize (`finalizeCancelledCopy`) re-fetches and explicitly re-checks `STATUS_DISTRIBUTED` before mutating, returning `false` (not throwing) if the copy has since become Distributed.

**Distributed → Obsoleted (Recall)** (`recall`/`recallBatch`): only legal while Distributed (batch: Distributed or Obsoleted, per `ensureCanRecall`); recall reason mandatory (non-blank). Sets `obsoleteReason=RECALLED`, `recalledBy/At`. E-signature `"CONTROLLED_COPY_RECALLED"`. Async finalize `finalizeRecalledCopy` **re-fetches but has NO terminal-state guard before mutating** — `IMPLEMENTATION-GAP` / asymmetry vs. distribute and cancel's finalize methods (flagged explicitly by the tracing agent; comment in the async service notes "no roll back to prior state step on failure").

**Distributed → Obsoleted (Lost/Damaged/Destroyed)** (`destroy`/`reportLostDamaged`): must currently be Distributed (checked against both `statusCode` and `currentStage`); evidence file required if reason is "Damaged"; executor cannot equal witness (SoD-style control). Sets `obsoleteReason` accordingly, `destroyedBy/At`, `destructionMethod`, `destructionType`, `witnessedBy`. E-signature `"CONTROLLED_COPY_DESTROYED"`. Followed by `replaceLostDamaged` (creates a brand-new Controlled Copy + batch linked via `replacedControlledCopy`, e-signature `"CONTROLLED_COPY_REISSUED"`) — `IMPLEMENTATION-DISCOVERED` reissue workflow not in the QF reference.

**Distributed → Obsoleted (Expiry — scheduled)** (`ControlledCopyExpiryScheduler.autoObsoleteExpiredControlledCopies`, daily `@Scheduled(cron="0 0 2 * * *")`, guarded by a distributed Redis lease `"controlled-copy-expiry"` for 30 min): queries all Distributed copies with an expiry date ≤ now; sets `statusCode="OBSOLETED"`/`status="Obsoleted"` together, `obsoleteReason=EXPIRED`, `obsoletedBy/At`, and propagates to the parent batch. A separate reminder sub-job (`sendExpiryReminders`) emails 7 days before expiry, marking `expiryReminderSentAt` without any status change — partially `QF-MATCH` (QF's 8-hour download-link expiry is a different, unverified mechanism — see `21-known-unknowns-conflicts.md`).

**Distributed → Obsoleted (Document Obsolete cascade)**: see 8.3 — document-level cascade, `obsoleteReason=DOCUMENT_OBSOLETED`.

**Distributed/Ready-for-Distribution → Obsoleted (Revision Obsolete cascade)** — **CONFIRMED, direct answer to the priority question**: `RevisionService.obsoleteDistributedControlledCopies(...)` (private method), called synchronously (not via event/async) from two sites in `RevisionService`: (a) when a successor revision is published and supersedes prior Effective revisions (loop over `supersededRevisions`, after setting the old revision to OBSOLETED), and (b) from the manual revision workflow-action path when the target status is `OBSOLETED`. For every Controlled Copy on that revision whose status is `DISTRIBUTED` or `READY_FOR_DISTRIBUTION` (Closed/Cancelled copies explicitly left untouched, preserving the GMP trail), sets `status="Obsoleted"`, `statusCode="OBSOLETED"`, `currentStage="Obsoleted"`, `obsoleteReason="REVISION_OBSOLETED"`, then calls `controlledCopyBatchStatusService.synchronize(...)`. Audit action `"OBSOLETE"` with comment `"Controlled Copy Auto Obsoleted By Revision Obsolete; Reason: REVISION_OBSOLETED"`.
  - **Notable divergence**: this call site sets `status`/`statusCode` as two separate inline statements rather than via the shared `setControlledCopyStatus` helper used everywhere else in `ControlledCopyService` — functionally equivalent today but a duplicated code path outside the single source of truth (`IMPLEMENTATION-DISCOVERED`, latent-divergence risk).
  - **Performance/architecture note**: unlike distribute/cancel/recall (which are deliberately async via job+event), this revision-obsolete cascade to controlled copies runs **synchronously inline within the revision's own transaction** — a revision with many linked controlled copies obsoletes them all in the same transaction as the revision state change. Flag as a potential scaling/latency concern, not confirmed as a production issue.

### 8.4.1 Printing does not change lifecycle status
`markAsPrinted`: atomic conditional UPDATE (`controlledCopyRepository.consumePrint(copyId, printOnce)`, 0-rows-affected → `AccessDeniedException`) sets only `printedBy/At` and `currentStage="Ready for Distribution"` — **status/statusCode unchanged**. `consumePreviewPrint` (token/preview path) and `downloadControlledCopy`'s `consumeDownload` likewise use atomic bulk conditional updates rather than optimistic-lock-guarded Java-side mutation, for print/download quota enforcement specifically (see 12-transaction-concurrency.md).

### 8.4.2 Retry paths
`retryFailedDistribution`/`retryFailedRecall`/`retryFailedCancel` — read-only transactions that re-authorize then delegate to the matching async service's `retryFailedItems`, which re-queries job items with `status="FAILED"` on the most recent job only.

### 8.4.3 Discrepancy detection — explicitly non-self-healing
`ControlledCopyBatchDiscrepancyScanner` (hourly `@Scheduled`, Redis lease `"controlled-copy-batch-discrepancy"` for 15 min): compares each active batch's stored statusCode against an expected status derived from its member copies (`ControlledCopyBatchStatusService.peekExpectedStatus`). Explicit doc comment: it is "intentionally read-only ... it never rewrites a mismatched status itself" — only opens/resolves `ControlledCopyBatchStatusDiscrepancy` rows for manual review. This is a deliberate design choice to surface drift rather than silently auto-correct it — worth noting for `21-known-unknowns-conflicts.md` as a system-acknowledged imperfection, not a bug to "fix."

### 8.4.3b Additional confirmed details (second independent trace pass)
- **Controlled Copy status is NOT FK-enforced**, unlike Document/Revision status. `DocumentRecord.status`/`DocumentRevisionRecord.status` are `@ManyToOne` joins to their status-definition tables; `ControlledCopyRecord.status`/`statusCode` are plain `@Column(String)` with no join. The `controlled_copy_statuses` lookup table (migration `V74__add_controlled_copy_status_definitions.sql`) exists for label/UI purposes only — nothing in the schema prevents a free-text mismatch. This is the root architectural reason `ControlledCopyBatchStatusDiscrepancy`/the discrepancy scanner exist at all. `IMPLEMENTATION-DISCOVERED`, structurally significant.
- **Resolved (not a live mismatch)**: `V74__add_controlled_copy_status_definitions.sql` originally seeded the lookup code as `OBSOLETE`, which momentarily disagreed with `ControlledCopyService.STATUS_OBSOLETED="OBSOLETED"`. Confirmed by direct read of later migrations that this was fixed: `V120__rename_controlled_copy_obsolete_code_to_obsoleted.sql` renames the code to `OBSOLETED`, and `V121__controlled_copy_published_pdf_and_obsolete_reason.sql`/`V123__normalize_controlled_copy_stage_values.sql` normalize any remaining `'OBSOLETE'` rows to `'OBSOLETED'`. Current schema state: `OBSOLETED` is the sole live code. No open discrepancy here.
- **Exact confirmed endpoints** (`RevisionController`): `complete-editing, submit-review, review/complete, review/reject, approve/complete, approve/reject, training/complete, publish, upgrade, cancel, upload, office-online/*, working-notes`. **No `/obsolete` endpoint exists** — corroborates the dead-code finding in 8.4c: there is no manual, user-initiated "obsolete this revision" REST action.
- **Async concurrency gap, more precisely characterized**: `ControlledCopyBatchCancelAsyncService`/`ControlledCopyBatchRecallAsyncService` have **zero `OptimisticLockingFailureException`-specific handling** (confirmed by direct grep of both files — no catch clause for that exception exists), unlike the Distribution async service's `finalizeWithRetry`, which explicitly catches it and re-resolves via a fresh-transaction terminal-state check. This means a concurrent write racing a batch cancel/recall doesn't get the graceful "who won the race" resolution that distribute gets — it either silently overwrites (cancel, per 8.4) or throws unhandled (recall path, exact behavior on lock conflict not fully characterized — likely bubbles up as a generic async exception, retried by the generic retry loop rather than the terminal-state-aware one). Reinforces item #12 in `10-hidden-implementation-rules.md` with stronger evidence.
- **Scheduled jobs fail silently on lock-acquisition failure** (both `ControlledCopyExpiryScheduler` and `ControlledCopyBatchDiscrepancyScanner`): if the Redis distributed lease can't be acquired, the job logs a warning and returns — no retry, no alert. Acceptable for idempotent daily/hourly jobs but worth noting for `19-error-retry-recovery.md`.
- Migration citations for schema evidence: `V6__create_document_management_schema.sql` (Document), `V9__create_revision_management_schema.sql` (Revision), `V77__ensure_status_lookup_consistency.sql`, `V282__remove_pdf_comments_and_add_ready_for_publishing.sql`, `V74__add_controlled_copy_status_definitions.sql`.

### 8.4.4 Startup recovery
Each batch async service has `resumePendingJobs()` (`@Scheduled(fixedDelay=30000)`) that recovers jobs stuck in `PENDING` after a backend restart, using an atomic `claimPendingJob(jobId)` to avoid double-processing across instances — evidence of horizontal-scaling-aware idempotency design.

## 8.4b Document Revision state machine — CONFIRMED (`service/RevisionService.java`, `service/RevisionWorkflowAuthorizationService.java`)

### States (RevisionStatusDefinition codes)
`DRAFT`, `PENDING_REVIEW`, `PENDING_APPROVAL`, `PENDING_TRAINING`, `READY_FOR_PUBLISHING`, `EFFECTIVE`, `OBSOLETED`, `CLOSED_CANCELLED` — `QF-MATCH` with QF's named revision lifecycle list.

### Transition table (source of truth: `RevisionWorkflowAuthorizationService.validateWorkflowState`, a single hardcoded switch — confirms 8.0's "no declarative graph" finding)
| Action | Required current status | Extra precondition |
|---|---|---|
| COMPLETE_AUTHORING | DRAFT | editingStatus ≠ COMPLETED, sourceLocked=false |
| UPDATE_DRAFT_METADATA / UPLOAD_SOURCE | DRAFT | — |
| SUBMIT_FOR_REVIEW | DRAFT | editingStatus=COMPLETED, sourceLocked=true, has "PREPARED" e-signature |
| GENERATE_REVIEW_SNAPSHOT | DRAFT | — |
| OPEN_PUBLISHING_WORKSPACE | READY_FOR_PUBLISHING | — |
| REGENERATE_SNAPSHOT | DRAFT, EFFECTIVE, or OBSOLETED | — |
| COMPLETE_REVIEW / REJECT_REVIEW | PENDING_REVIEW | next-pending-in-sequence check (6.3) |
| COMPLETE_APPROVAL / REJECT_APPROVAL | PENDING_APPROVAL | next-pending-in-sequence check; same-person-as-reviewer block if `DocumentWorkflowSetting.reviewerNoApprove` enabled |
| COMPLETE_TRAINING | PENDING_TRAINING | `revision.requiresTraining==true`, completion date ≥ planned date |
| PUBLISH | READY_FOR_PUBLISHING | related documents must be Effective unless force-published with `documents.revision.force_publish` permission + mandatory reason |
| CANCEL | DRAFT | mandatory cancel reason |
| UPGRADE_REVISION | EFFECTIVE | no other revision of the same document already in progress (`ensureNoRevisionInProgress`) |
| OBSOLETE | EFFECTIVE | **dead code — action is fully defined here but has zero call sites anywhere in the codebase** |

Explicit `setStatus(...)` targets confirmed in `RevisionService`: `PENDING_REVIEW`/`PENDING_APPROVAL`/`PENDING_TRAINING`/`READY_FOR_PUBLISHING`/`DRAFT` (via `updateRevisionStatus`, target computed from reviewer/approver/training presence — `QF-MATCH` with "if there is a Reviewer or Approver ... state will change to Pending Review/Pending Approval"), `EFFECTIVE` (publish), `OBSOLETED` (supersede-on-publish and document-obsolete-cascade), `CLOSED_CANCELLED` (cancel). No transition ever moves a revision backward out of EFFECTIVE/OBSOLETED/CLOSED_CANCELLED — `UPGRADE_REVISION` instead creates a **new** DRAFT revision row (`parentRevision` link), leaving the EFFECTIVE row's status untouched until later superseded.

### Reject transitions (both Reviewer and Approver) — PENDING_REVIEW/PENDING_APPROVAL → DRAFT
`rejectReview`/`rejectApproval`: sets `rejectedBy/At`, `editingStatus="IN_PROGRESS"`, `sourceLocked=false`, clears the draft review snapshot, **resets both REVIEWER and APPROVER participant actions back to PENDING** (not just the rejecting role's), reopens the Office-Online working copy, logs a `SOURCE_UNLOCKED` audit entry, e-signature meaning `REJECTED`. `QF-MATCH` on "Reject ... record returns to Draft."

### Publish — READY_FOR_PUBLISHING → EFFECTIVE (`publishRevisionRecord`, private, called from `publishRevision`)
Confirms the priority question **"Revision becomes Effective → obsoletes older revisions"** directly:
```java
supersededRevisions = revisionRepository.findAllByDocument_IdAndStatus_Code(documentId, "EFFECTIVE")
    .stream().filter(r -> !r.getId().equals(revision.getId())).toList();
for (superseded : supersededRevisions) {
    superseded.setStatus(OBSOLETED); superseded.setObsoletedBy(currentUser); superseded.setObsoletedAt(publishedAt);
    save(superseded);
    obsoleteDistributedControlledCopies(superseded, currentUser, publishedAt, "NEW_REVISION_PUBLISHED", ..., signatureSessionId);
    recordRevisionHistory(superseded, "OBSOLETE", ..., "OBSOLETED", ...);
}
```
Queries by `document_id` + status `EFFECTIVE` excluding the one being published — code does **not** assume only one EFFECTIVE revision can exist; it loops over however many are found. `QF-MATCH` with BR_DOCR16/BR_DOCR02. E-signature `"PUBLISHED"`. Force-publish override audited as `WARNING_OVERRIDE`.

### 8.4c — Cascade/gap findings across Document ↔ Revision ↔ Controlled Copy (cross-referencing 8.3/8.4)
- **CONFIRMED**: Publishing a revision cascades to Controlled Copies of the **superseded sibling revision** via `obsoleteDistributedControlledCopies` (reason `NEW_REVISION_PUBLISHED`) — same private method as the manual-revision-obsolete and document-obsolete-triggered-revision-obsolete paths (reason varies: `NEW_REVISION_PUBLISHED` vs `REVISION_OBSOLETED` vs `DOCUMENT_OBSOLETED`, per call site).
- **CONFIRMED — asymmetry / IMPLEMENTATION-GAP candidate**: `DocumentService.obsoleteDocument()` obsoletes revisions via `RevisionService.obsoleteRevisionAsPartOfDocumentObsolete(...)`, but that specific method does **not** call `obsoleteDistributedControlledCopies` — instead, `DocumentService.obsoleteDocument()` runs its **own separate inline loop** directly over `ControlledCopyRecord`s of the document (see 8.3), independent of the revision-level helper. Net effect on data is the same (copies do get obsoleted, reason `DOCUMENT_OBSOLETED`), but it is a **second, parallel implementation of the same cascade logic** rather than reuse of `obsoleteDistributedControlledCopies` — `IMPLEMENTATION-DISCOVERED` code-duplication risk (two places must independently stay correct).
- **CONFIRMED — dead code**: `RevisionWorkflowAction.OBSOLETE` (a user-invoked "manually obsolete this revision" action) is fully specified in the authorization layer (requires EFFECTIVE status) but has **zero callers** anywhere in `com.eqms` — there is no way for a user to directly trigger a standalone revision-obsolete action; it only ever happens as a side effect of (a) publishing a successor, or (b) the parent Document being obsoleted. The `updateRevisionStatus` method also contains an `OBSOLETED`-target branch that itself calls `obsoleteDistributedControlledCopies`, but **no caller currently passes `"OBSOLETED"`** to `updateRevisionStatus` either — also unreachable. Both should be flagged to the team as either intentional (UI never exposes a direct revision-obsolete button) or a genuine gap.

### 8.4d Other Revision-level hidden rules
- **`RevisionSnapshotAsyncService` and `RevisionSnapshotEvent` are dead code** — the event type is referenced only by its own listener and record definition; `new RevisionSnapshotEvent(...)` has zero construction sites in the codebase, and the `setSnapshotRequestId`/`setSnapshotStatus` fields it would set are never touched elsewhere. The snapshot/preview-PDF regeneration actually used by every real transition (`submitForReview`, `completeReview`, `completeApproval`, `completeTraining`, `regenerateSnapshot`) goes through a **synchronous** in-request helper `regeneratePublishingSnapshotIfConfigured` → `PublishingPdfComposerService.composePreview`, which **swallows any exception with only `log.warn`** — a PDF composition failure during a workflow transition is silent to the user and not retried. `IMPLEMENTATION-GAP` (silent failure) + `IMPLEMENTATION-DISCOVERED` (dead async class whose own Javadoc describes stale-request protection that isn't wired up).
- **`uploadRevisionFile` bypasses the hybrid authorization engine** — uses legacy helpers (`requireCurrentUserCanUploadRevision`, `requireRevisionFileAccess`) instead of `RevisionWorkflowAuthorizationService.require(..., UPLOAD_SOURCE, ...)`, even though `UPLOAD_SOURCE` is a defined, DRAFT-gated action in that service. `IMPLEMENTATION-DISCOVERED` — possible authorization-engine cutover gap, not confirmed intentional.
- `cancelRevision` duplicates its DRAFT-only guard as a hardcoded check in addition to the authorization layer's own DRAFT check for `CANCEL` — redundant, not contradictory.
- Sequence-aware pending-participant re-check (`requirePendingParticipant`) is enforced at the moment of `completeReview`/`rejectReview`/`completeApproval`/`rejectApproval`, independent of (in addition to) the `@Version` optimistic lock — see `12-transaction-concurrency.md`.

## 8.5 Other confirmed Document-level hidden rules
- `updateDocumentDraft`: if a Sub-Type change request omits `reviewerUserIds`, the **existing** reviewer list is re-validated against the new Sub-Type's review requirement and the save fails outright on mismatch — prevents a silent Sub-Type/Reviewer-requirement inconsistency. `IMPLEMENTATION-DISCOVERED`.
- `updateActiveWorkflowConfiguration`: a document marked as a Template cannot have `requiresTraining` re-enabled even via direct request while ACTIVE — training fields are forcibly nulled/false for templates. `IMPLEMENTATION-DISCOVERED`.
- `updateActiveWorkflowConfiguration` also triggers `revisionService.syncDraftRevisionWithDocument(document)` when author/co-author/reviewer/approver/periodic-review/training fields change on the Document while an open Draft revision exists — keeps the Draft revision's participant/config snapshot in sync with the parent Document. Internals `UNKNOWN` (not yet read).
- `updateActiveWorkflowConfiguration` metadata changes run through a **parallel/shadow authorization path** (`AuthorizationEngineService` + `AuthorizationShadowEvaluationService`, cutover-flag gated) in addition to the normal `DocumentAuthorizationService`/`PermissionEvaluationService` check — evidence of an in-progress authorization-engine migration being run in shadow mode specifically for `UPDATE_METADATA`, not for Cancel/Obsolete.
