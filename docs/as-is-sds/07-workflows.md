# 07 — Workflows (AS-IS)

Derived entirely from source evidence already confirmed in `06-role-authorization-model.md`, `08-state-machines.md`, `12-transaction-concurrency.md`, `13`–`19`, `20-ui-api-service-mapping.md`. No new code analysis was performed to build this file; it re-presents confirmed evidence in a workflow-narrative form readable without Java. Where a detail was not separately re-verified for this file, it is marked UNKNOWN and cross-references the section where that gap is already tracked.

Legend: **QF mapping** uses the scheme from `01-system-overview.md` (`QF-MATCH` / `QF-DEVIATION` / `IMPLEMENTATION-DISCOVERED` / `IMPLEMENTATION-GAP` / `QF-INTERNAL-CONFLICT` / `UNKNOWN`).

---

## DOCUMENT

### WF-DOC-01 — Create Document
- **Actor**: a user holding document-creation permission (`documents.document.create`; templates additionally require template-manage permission).
- **Trigger**: "New Document" action.
- **Preconditions**: none (creates a new record).
- **Authorization**: `DocumentAuthorizationService.requireCanCreateDocument`; `requireTemplateManage` if `isTemplate=true`.
- **Initial state**: none (new row).
- **Steps**: submit required fields → `DocumentService.createDocumentDraft` → `applyDraftFields(..., isNew=true)`.
- **Target state**: `DRAFT`.
- **State changes of related records**: none yet (no Revision exists until upload).
- **Validation**: field-level only (mandatory fields per `05-data-model.md`).
- **Electronic signature**: none.
- **Audit trail**: `auditTrailService.logAs(..., "CREATE", null, "DRAFT", ...)`.
- **Notifications**: none confirmed at creation itself (see WF-DOC-04 for author/co-author assignment notification gap).
- **Transaction behavior**: `@Transactional`, single insert.
- **Async behavior**: none.
- **Failure behavior**: standard validation error mapping (`19-error-retry-recovery.md`).
- **Cross-workflow side effects**: none.
- **QF mapping**: `QF-MATCH` (DCO creates Document Record; Draft start state).
- **Known UNKNOWNs**: exact mandatory-field enforcement point (frontend vs. backend) not independently re-verified for this file.
- **Source evidence**: `DocumentService.createDocumentDraft`, `08-state-machines.md` §8.1.

### WF-DOC-02 — Save/Update Document Draft
- **Actor**: any user authorized to edit the initial Document draft (Author/Co-Author/DCO-equivalent, permission-driven — `06-role-authorization-model.md`).
- **Trigger**: Save action while Document is `DRAFT`.
- **Preconditions**: Document status `DRAFT`.
- **Authorization**: `requireCanEditInitialDocumentDraft`; template-manage guard if template.
- **Initial state**: `DRAFT`.
- **Steps**: `DocumentService.updateDocumentDraft` — no-op short-circuit if unchanged; **hidden rule**: if a Sub-Type change omits `reviewerUserIds`, the existing reviewer list is re-validated against the new Sub-Type's review requirement and the save fails on mismatch (`08` §8.5).
- **Target state**: `DRAFT` (unchanged).
- **State changes of related records**: none.
- **Validation**: field diffing; Sub-Type/reviewer-requirement cross-check (see above).
- **Electronic signature**: none.
- **Audit trail**: `auditTrailService.logAs(..., "UPDATE", "DRAFT", "DRAFT", ..., buildDocumentDraftModificationChanges(...))`.
- **Notifications**: none confirmed.
- **Transaction behavior**: `@Transactional`.
- **Async behavior**: none.
- **Failure behavior**: standard.
- **Cross-workflow side effects**: none while still Draft (no Revision exists).
- **QF mapping**: `QF-MATCH` ("users will be able to edit record information only while in the Draft state").
- **Known UNKNOWNs**: none beyond what's in `21`.
- **Source evidence**: `DocumentService.updateDocumentDraft`, `08` §8.5.

### WF-DOC-03 — Update Active Workflow Configuration (post-Active metadata edit)
- **Actor**: user with `documents.document.configure_next_metadata` or per-field configuration permissions.
- **Trigger**: editing Document metadata (reviewers/approvers/related docs/training/periodic review) while `ACTIVE`.
- **Preconditions**: Document `ACTIVE`; an EFFECTIVE revision must exist; `requireNoRevisionBeyondConfigurableStage`.
- **Authorization**: per-field permission checks, **plus a parallel shadow-authorization path** (`AuthorizationEngineService` + `AuthorizationShadowEvaluationService`, cutover-flag gated) run alongside the normal check — `08` §8.5.
- **Initial/Target state**: `ACTIVE` (unchanged).
- **Steps**: dirty-check each field independently; re-validate SoD (`validateCoAuthorRules`, `validateAuthorAndCoAuthorApprovalIndependence`, `validateReviewerRules`) defensively against existing values when not part of the request; if author/co-author/reviewer/approver/periodic/training changed, call `revisionService.syncDraftRevisionWithDocument(document)` to keep an open Draft revision's snapshot in sync.
- **Validation**: template documents cannot have `requiresTraining` re-enabled — forcibly nulled/false.
- **Electronic signature**: none.
- **Audit trail**: per-changed-field `AuditTrailChangeResponse` list logged.
- **Notifications**: none confirmed for this specific action.
- **Transaction behavior**: `@Transactional`.
- **Async behavior**: none (the Draft-revision sync is synchronous, in-transaction).
- **Cross-workflow side effects**: **WF-DOC-03 → WF-REV** (an open Draft revision's config is kept in sync — see `11-cross-workflow-dependencies.md`).
- **QF mapping**: `IMPLEMENTATION-DISCOVERED` (QF does not describe a distinct "reconfigure Active document, sync into open Draft" workflow at this granularity).
- **Known UNKNOWNs**: exact internals of `syncDraftRevisionWithDocument` (`21` item — see cross-reference).
- **Source evidence**: `DocumentService.updateActiveWorkflowConfiguration`, `08` §8.5.

### WF-DOC-04 — Cancel Document
- **Actor**: user with document-master-lifecycle CANCEL authority.
- **Trigger**: Cancel action.
- **Preconditions**: **the Document must have zero Revisions of any status** (hard guard — cancel is only for documents that "never started").
- **Authorization**: `requireDocumentMasterLifecycleAction(user, document, "CANCEL")`.
- **Initial state**: any pre-revision state (in practice `DRAFT`).
- **Steps**: single status flip, no cascade possible (guard makes revisions impossible to exist).
- **Target state**: `CLOSED_CANCELLED`.
- **State changes of related records**: none (no revisions exist).
- **Validation**: the "no revisions" guard itself.
- **Electronic signature**: **none required** — confirmed asymmetry vs. Obsolete (below).
- **Audit trail**: `"CANCEL"`, fromStatus→`CLOSED_CANCELLED`.
- **Notifications**: none confirmed.
- **Transaction behavior**: `@Transactional`, optimistic lock only (`@Version`).
- **Async behavior**: none.
- **Failure behavior**: `IllegalStateException` if a revision exists → 500 per current `GlobalExceptionHandler` mapping (`19`).
- **Cross-workflow side effects**: none.
- **QF mapping**: `QF-MATCH` ("Cancel activity progresses the Document record to Closed-Cancelled"); the "must have zero revisions" precondition is `IMPLEMENTATION-DISCOVERED` (not explicit in QF text, though consistent with QF's parallel guidance that Obsolete is the path once revisions exist).
- **Known UNKNOWNs**: none.
- **Source evidence**: `DocumentService.cancelDocument`, `08` §8.2.

### WF-DOC-05 — Obsolete Document
- **Actor**: user with document-master-lifecycle OBSOLETE authority.
- **Trigger**: Obsolete action + e-signature.
- **Preconditions**: Document `ACTIVE`; an `EFFECTIVE` revision must exist; **no revision may be in an in-progress status** (`DRAFT`/`PENDING_REVIEW`/`PENDING_APPROVAL`/`PENDING_TRAINING`/`READY_FOR_PUBLISHING`).
- **Authorization**: `requireDocumentMasterLifecycleAction(user, document, "OBSOLETE")` + valid signature token (required, consumed).
- **Initial state**: `ACTIVE`.
- **Steps**: 1) validate preconditions; 2) flip Document status; 3) persist e-signature; 4) cascade to every non-terminal Revision via `RevisionService.obsoleteRevisionAsPartOfDocumentObsolete`; 5) cascade to every `DISTRIBUTED`/`READY_FOR_DISTRIBUTION` Controlled Copy of the document via a **separate inline loop directly in `DocumentService`** (reason `DOCUMENT_OBSOLETED`); 6) `controlledCopyBatchStatusService.synchronize(...)`.
- **Target state**: `OBSOLETED`.
- **State changes of related records**: all non-terminal Revisions → `OBSOLETED`; all Distributed/Ready-for-Distribution Controlled Copies → `OBSOLETED` (reason `DOCUMENT_OBSOLETED`).
- **Validation**: the three preconditions above.
- **Electronic signature**: **required**, meaning `"OBSOLETED"`, persisted via `electronicSignatureService.createEntitySignature`.
- **Audit trail**: `"OBSOLETE"` fromStatus→`OBSOLETED` at Document level; per-revision and per-copy audit entries during cascade.
- **Notifications**: not independently confirmed for this exact action in this pass (cross-reference `14-notifications.md` — Controlled Copy obsolete notifications are confirmed for the Controlled-Copy-level actions, not specifically re-verified for this document-cascade path).
- **Transaction behavior**: entire cascade (Document + all Revisions + all Controlled Copies) runs in **one transaction**.
- **Async behavior**: none — fully synchronous.
- **Failure behavior**: precondition violations → `IllegalStateException` → 500 (`19`).
- **Concurrency**: `@Version` optimistic lock only on `DocumentRecord`; a TOCTOU window exists between the initial status check and the final save within the same transaction (`12-transaction-concurrency.md`).
- **Cross-workflow side effects**: **WF-DOC-05 → WF-REV (cascade obsolete) → WF-CC (cascade obsolete)** — see `11-cross-workflow-dependencies.md` for the full map, including the divergence-risk note that this cascade is implemented independently from the Revision-level `obsoleteDistributedControlledCopies` cascade used elsewhere.
- **Frontend gating (verified, targeted pass)**: **two independently-gated implementations exist.** `DetailDocumentView.tsx` (route `/documents/:id`) gates the Obsolete button purely on the server-computed capability `documentMasterCapabilities?.actions.obsolete?.allowed` (from `securityApi.getResourceCapabilities("DOCUMENT_MASTER", id)`) — defers entirely, does not import `documentLifecycleActions.ts`. `NewDocumentView.tsx` (route `/documents/all/edit/:id`) gates on **both** the same server capability **and** a client-side re-derivation via `documentLifecycleActions.ts`'s `canObsoleteDocumentWithRevisionHistory(status, revisions)`, which independently recomputes the identical three preconditions (ACTIVE, has EFFECTIVE revision, no revision in progress) client-side. This is a confirmed cross-view inconsistency, not a security gap (the backend remains authoritative either way). Neither view's error handler branches on HTTP status (403/409/410) specifically; both recover capability staleness only passively (`DetailDocumentView`: 10s poll + realtime `revision-workflow-updated` event; `NewDocumentView`: only on the next successful hydrate).
- **QF mapping**: `QF-MATCH` (BR_DOC02 — cascade to revisions).
- **Known UNKNOWNs**: notification trigger for this specific document-level cascade not independently confirmed. (Frontend gating source — previously UNKNOWN — is now resolved above.)
- **Source evidence**: `DocumentService.obsoleteDocument`, `08` §8.3; `DetailDocumentView.tsx`, `NewDocumentView.tsx`, `documentLifecycleActions.ts` (`canObsoleteDocumentStatus`, `hasEffectiveRevision`, `hasOpenRevisionInProgress`, `canObsoleteDocumentWithRevisionHistory`), `21-known-unknowns-conflicts.md` (Decision Log candidate #11).

---

## DOCUMENT REVISION

### WF-REV-01 — Create/Upload Revision
- **Actor**: the user set as Author (session-authenticated); permission `documents.revision.upload_source`.
- **Trigger**: Upload Revision action, only visible when no other active revision is in progress (per QF; backend guard: `ensureNoRevisionInProgress`).
- **Preconditions**: Document `ACTIVE`/editable; DRAFT-only for the new revision; source file passes full validation (`17-file-storage.md`: extension allowlist, ZIP-signature check, OOXML structural validation, macro/unsafe-content blocklist, XXE-hardened XML parsing, malware scan — fail-closed if scanner unavailable).
- **Authorization**: `requireDocumentAllowsRevisionFileUpload`, `requireCurrentUserCanUploadRevision`, `requireRevisionFileAccess(UPLOAD)` — **note**: this bypasses the hybrid `RevisionWorkflowAuthorizationService`/`UPLOAD_SOURCE` action entirely, using legacy permission helpers instead (`08` §8.4d, confirmed cutover-gap candidate).
- **Initial state**: none (new Revision row) or DRAFT (upload to an existing draft).
- **Steps**: validate file → store to MinIO (real WORM-locked bucket) at a revision-UUID-keyed object path, distinct from any published-PDF path → persist checksum → create/update `DocumentRevisionRecord` in `DRAFT`.
- **Target state**: `DRAFT`.
- **State changes of related records**: **first (non-upgrade) revision's source-file upload → Document auto-progresses `DRAFT`→`ACTIVE`** — **verified exact trigger** (targeted verification pass): `RevisionService.activateDocumentAfterInitialSourceStored`, called from both `uploadRevisionFile` and `createRevisionAndUploadFile` immediately after the source file is stored, guarded by `revision.parentRevision==null && document.status=="DRAFT"`. Idempotent by construction; no dedicated audit-log entry for this specific transition. This is the Upload action itself, not Complete Editing or Submit Revision.
- **Validation**: full file-validation pipeline (`17`); rejected uploads are separately, durably audited even if the calling transaction rolls back (`REQUIRES_NEW` transaction).
- **Electronic signature**: none at upload.
- **Audit trail**: upload success/rejection both logged (`RevisionUploadSecurityAuditService`).
- **Notifications**: none confirmed at upload itself.
- **Transaction behavior**: `@Transactional`.
- **Async behavior**: none for the upload itself; Office Online sync (if used later) is async (`RevisionSharePointSyncWorker`).
- **Failure behavior**: `RevisionUploadValidationException` (400, code-carrying) or `VirusScanUnavailableException` (503, fail-closed) — `19`.
- **Cross-workflow side effects**: none beyond the Document ACTIVE progression.
- **QF mapping**: `QF-MATCH` (revision record created, minor version, Document → Active).
- **Known UNKNOWNs**: none — trigger point verified (see State changes above).
- **Source evidence**: `RevisionService.uploadRevisionFile`, `RevisionService.createRevisionAndUploadFile`, `RevisionService.activateDocumentAfterInitialSourceStored`, `RevisionUploadFileValidator`, `DocumentController.createRevisionFromDocumentAndUpload`, `RevisionController.uploadRevisionFile`, `08` §8.4d, `17`.

### WF-REV-02 — Edit / Complete Editing
- **Actor**: Author (Complete Editing is Author-only, no Co-Author, per Javadoc); Author/Co-Author may edit online before completing.
- **Trigger**: Complete Editing action.
- **Preconditions**: status `DRAFT`; a source file must exist (`requireRevisionSourceFile`); valid signature token.
- **Authorization**: `COMPLETE_AUTHORING` workflow action.
- **Initial state**: `DRAFT`.
- **Steps**: sign with meaning `"PREPARED"` → set `editingStatus="COMPLETED"`, `sourceLocked=true`.
- **Target state**: `DRAFT` (unchanged status; `editingStatus` axis changes).
- **State changes of related records**: none.
- **Validation**: source file presence.
- **Electronic signature**: **required**, meaning `"PREPARED"`.
- **Audit trail**: history entry + explicit `"COMPLETE_EDITING"` log.
- **Notifications**: realtime WS event to workflow coordinators (after-commit) + email notifying DCO the revision is ready for submission.
- **Transaction behavior**: `@Transactional`.
- **Async behavior**: the realtime WS publish is after-commit; no `@Async` job.
- **Cross-workflow side effects**: none.
- **QF mapping**: `QF-MATCH` ("Author uploads to Office Online... Edit File Online... before proceeding").
- **Known UNKNOWNs**: none.
- **Source evidence**: `RevisionService.completeEditing`, `08` §8.4b.

### WF-REV-03 — Submit for Review
- **Actor**: Author/DCO (per QF; backend gate is permission/actor-scope based, not role-string).
- **Trigger**: Submit Revision action.
- **Preconditions**: status `DRAFT`; `editingStatus=COMPLETED` and `sourceLocked=true`; must already hold a `"PREPARED"` signature; if targeting `PENDING_APPROVAL` directly (no reviewers), `requirePdfPreviewReady`.
- **Authorization**: `SUBMIT_FOR_REVIEW` workflow action; SoD validation (`validateSoD`), reviewer-requirement validation.
- **Initial state**: `DRAFT`.
- **Steps**: sign `"SUBMITTED_FOR_REVIEW"` → compute target status from presence of reviewers/approvers/training → set `submittedBy`/`submittedOn` → `updateRevisionStatus(...)`.
- **Target state**: `PENDING_REVIEW` (if reviewers exist) → else `PENDING_APPROVAL` (if only approvers) → else onward per training presence.
- **State changes of related records**: none direct; participant action states reset for the new stage.
- **Validation**: PDF preview readiness if skipping straight to approval.
- **Electronic signature**: **required**, meaning `"SUBMITTED_FOR_REVIEW"`.
- **Audit trail**: `"REVIEW_PACKAGE_GENERATED"` + `"SUBMIT_FOR_REVIEW"`.
- **Notifications**: `dispatchRevisionNotification` — reviewer's-turn or approver's-turn email per target stage (`14-notifications.md`).
- **Transaction behavior**: `@Transactional`.
- **Async behavior**: publishing-preview PDF regeneration is called **synchronously in-request** (`regeneratePublishingSnapshotIfConfigured`), not via the confirmed-dead `RevisionSnapshotAsyncService`; failures here are swallowed (`log.warn` only) — `IMPLEMENTATION-GAP` (`08` §8.4d).
- **Cross-workflow side effects**: notification dispatch; PDF snapshot regeneration writes a new `RevisionSnapshotHistory` row and a new, never-overwritten object key per round.
- **QF mapping**: `QF-MATCH` ("if there is a Reviewer or Approver ... state will change to Pending Review/Pending Approval").
- **Known UNKNOWNs**: none beyond the snapshot-swallow gap already tracked.
- **Source evidence**: `RevisionService.submitForReview`, `08` §8.4b.

### WF-REV-04 — Review Complete
- **Actor**: the current FIFO-pending Reviewer (`sequenceOrder`-based; a later reviewer cannot act while an earlier one's action is `PENDING`).
- **Trigger**: Complete Review action.
- **Preconditions**: status `PENDING_REVIEW`; caller must be the current pending reviewer (`requirePendingParticipant`, sequence-aware, re-checked live at the moment of the call); `requirePdfPreviewReady` if advancing to `PENDING_APPROVAL`.
- **Authorization**: `COMPLETE_REVIEW` workflow action → `AuthorizationEngineService` policy check.
- **Initial state**: `PENDING_REVIEW`.
- **Steps**: sign `"REVIEWED"` → mark this participant `actionStatus="REVIEWED"` → `updateRevisionStatus(...)`.
- **Target state**: advances to next reviewer (stays `PENDING_REVIEW`) or → `PENDING_APPROVAL`/`PENDING_TRAINING`/`READY_FOR_PUBLISHING` once all reviewers done.
- **Validation**: FIFO sequence re-check at mutation time (independent of, in addition to, `@Version`).
- **Electronic signature**: **required**, meaning `"REVIEWED"`.
- **Audit trail**: history + status log.
- **Notifications**: dispatched via `updateRevisionStatus`/`dispatchRevisionNotification` for the next stage.
- **Transaction behavior**: `@Transactional`.
- **Async behavior**: synchronous snapshot regen, same swallow-on-failure pattern as WF-REV-03.
- **Cross-workflow side effects**: none beyond notification/audit.
- **QF mapping**: `QF-MATCH` ("Complete Review — Moves the record to Pending Approval").
- **Known UNKNOWNs**: none.
- **Source evidence**: `RevisionService.completeReview`, `06` §6.3, `08` §8.4b.

### WF-REV-05 — Review Reject
- **Actor**: the current FIFO-pending Reviewer.
- **Trigger**: Reject action.
- **Preconditions**: status `PENDING_REVIEW`; `requirePendingParticipant`.
- **Authorization**: `REJECT_REVIEW` workflow action.
- **Initial state**: `PENDING_REVIEW`.
- **Steps**: sign `"REJECTED"` → set `rejectedBy`/`rejectedAt` → `editingStatus="IN_PROGRESS"`, `sourceLocked=false` → clear draft review snapshot → **reset both REVIEWER and APPROVER participant actions back to PENDING** (not just the rejecting role's) → `reopenOfficeOnlineWorkingCopy` → log `"SOURCE_UNLOCKED"`.
- **Target state**: `DRAFT`.
- **Electronic signature**: **required**, meaning `"REJECTED"`.
- **Audit trail**: `"SOURCE_UNLOCKED"` + status transition history.
- **Notifications**: not independently re-confirmed for this exact rejection path in this file — cross-reference `14`.
- **Transaction behavior**: `@Transactional`.
- **Cross-workflow side effects**: reopens the Office Online working copy — see `11-cross-workflow-dependencies.md` (Office Online / SharePoint sync entry).
- **QF mapping**: `QF-MATCH` ("Reject ... record returns to Draft").
- **Known UNKNOWNs**: notification on reject not independently re-verified this pass.
- **Source evidence**: `RevisionService.rejectReview`, `08` §8.4b.

### WF-REV-06 — Approval Complete
- **Actor**: the current FIFO-pending Approver.
- **Trigger**: Complete Approval action.
- **Preconditions**: status `PENDING_APPROVAL`; if `DocumentWorkflowSetting.reviewerNoApprove` is enabled, the same person who reviewed cannot also approve; `requirePendingParticipant`.
- **Authorization**: `COMPLETE_APPROVAL` workflow action.
- **Initial state**: `PENDING_APPROVAL`.
- **Steps**: sign `"APPROVED"` → mark participant `APPROVED` → `updateRevisionStatus(...)`.
- **Target state**: `PENDING_TRAINING` if training required, else `READY_FOR_PUBLISHING`.
- **Electronic signature**: **required**, meaning `"APPROVED"`.
- **Audit trail**: history + status log.
- **Notifications**: `"training-notification"` to revision stakeholders if advancing to `PENDING_TRAINING`.
- **Transaction behavior**: `@Transactional`.
- **Async behavior**: synchronous snapshot regen (same pattern).
- **Cross-workflow side effects**: none beyond notification.
- **QF mapping**: `QF-MATCH` ("Approve — progresses ... to Pending Training ... or directly to Ready for Publishing").
- **Known UNKNOWNs**: none.
- **Source evidence**: `RevisionService.completeApproval`, `08` §8.4b.

### WF-REV-07 — Approval Reject
- **Actor**: the current FIFO-pending Approver.
- **Trigger**: Reject action.
- **Preconditions**: status `PENDING_APPROVAL`; `requirePendingParticipant`.
- **Authorization**: `REJECT_APPROVAL` workflow action.
- **Steps/Target state/Effects**: identical shape to WF-REV-05 (resets both participant roles, unlocks source, `SOURCE_UNLOCKED` audit, reopens Office Online copy) → `DRAFT`.
- **Electronic signature**: **required**, meaning `"REJECTED"`.
- **QF mapping**: `QF-MATCH`.
- **Source evidence**: `RevisionService.rejectApproval`, `08` §8.4b.

### WF-REV-08 — Training Complete
- **Actor**: DCO/coordinator (training authorization service).
- **Trigger**: Training Completed action.
- **Preconditions**: status `PENDING_TRAINING`; `revision.requiresTraining==true`; `trainingCompletionDate >= trainingPlannedDate`.
- **Authorization**: `trainingAuthorizationService.requireCanCompleteRevisionTraining`.
- **Initial state**: `PENDING_TRAINING`.
- **Steps**: sign `"TRAINING_CONFIRMED"` → set training date fields.
- **Target state**: `READY_FOR_PUBLISHING`.
- **Electronic signature**: **required**, meaning `"TRAINING_CONFIRMED"`.
- **Notifications**: per QF, training info is sent to the Distribution List when `Training Planned Date` is entered (this specific sub-step's notification trigger was not independently re-confirmed in this pass beyond the general "Pending Training" notification in `14`).
- **QF mapping**: `QF-MATCH` (BR_TRG07 — Training Completed transitions to Ready for Publishing).
- **Known UNKNOWNs**: exact trigger point for the "Planned Date entered → notify Distribution List" sub-notification not independently re-verified.
- **Source evidence**: `RevisionService.completeTraining`, `08` §8.4b, `14`.

### WF-REV-09 — Publish
- **Actor**: DCO/user holding Publish authority (`documents.workspace.manage`/policy-driven).
- **Trigger**: Publish action + e-signature.
- **Preconditions**: status `READY_FOR_PUBLISHING`; parent Document `ACTIVE`; all Related Documents `EFFECTIVE` **unless** force-published with `documents.revision.force_publish` permission + mandatory reason.
- **Authorization**: `PUBLISH` workflow action.
- **Initial state**: `READY_FOR_PUBLISHING`.
- **Steps**: 1) validate preconditions; 2) sign `"PUBLISHED"`; 3) set this revision `EFFECTIVE`, `publishedBy`/`publishedAt`, promote version (minor→major); 4) update parent Document → `ACTIVE`, version/effectiveDate/validUntil/reviewDate; 5) **query all OTHER revisions of the same document still `EFFECTIVE`** and, for each: set `OBSOLETED`, `obsoletedBy`/`obsoletedAt`, record history, and cascade-obsolete its `DISTRIBUTED`/`READY_FOR_DISTRIBUTION` Controlled Copies (reason `NEW_REVISION_PUBLISHED`).
- **Target state**: `EFFECTIVE` (this revision); `OBSOLETED` (any prior-EFFECTIVE sibling).
- **State changes of related records**: sibling revision → `OBSOLETED`; sibling's distributed/ready controlled copies → `OBSOLETED` (`NEW_REVISION_PUBLISHED`); parent Document → `ACTIVE` (confirmed, refreshed even if already Active).
- **Electronic signature**: **required**, meaning `"PUBLISHED"`; force-publish override separately audited as `"WARNING_OVERRIDE"`.
- **Audit trail**: `"PUBLISH"` (document + revision level); per-superseded-revision `"OBSOLETE"` history entries; per-cascaded-copy `"OBSOLETE"` entries.
- **Notifications**: not independently re-confirmed for the publish action itself in this pass (cross-reference `14`).
- **Transaction behavior**: entire cascade (this revision + all superseded siblings + their controlled copies) in **one transaction**.
- **Async behavior**: none — synchronous, in-transaction cascade (a deliberate contrast to the async Controlled Copy batch actions — see `11`).
- **Failure behavvior**: `RelatedDocumentsNotEffectiveException` (400) if blocked and not force-published.
- **Cross-workflow side effects**: **WF-REV-09 → sibling Revision (obsolete) → its Controlled Copies (obsolete)** — the headline confirmed cascade; see `11-cross-workflow-dependencies.md`.
- **QF mapping**: `QF-MATCH` (BR_DOCR02/BR_DOCR16 — obsolete older revisions/opened revisions on publish).
- **Known UNKNOWNs**: publish-time notification trigger not independently re-confirmed.
- **Source evidence**: `RevisionService.publishRevision`/`publishRevisionRecord`, `08` §8.4b–8.4c.

### WF-REV-10 — Cancel Revision
- **Actor**: Author (per QF); backend gate is a hardcoded `DRAFT`-only check plus the `CANCEL` workflow action (both independently enforce the same DRAFT precondition — redundant, not contradictory).
- **Trigger**: Cancel action + mandatory reason.
- **Preconditions**: status `DRAFT` only — **not permitted from any other stage** ("Only Draft revisions can be cancelled," explicit product decision per code comment).
- **Authorization**: `CANCEL` workflow action.
- **Initial state**: `DRAFT`.
- **Steps**: sign `"CANCELLED"` → set `cancelledBy`/`cancelledAt` → `syncDocumentStatusAfterRevisionCancellation` (may auto-close the parent Document if no revisions remain) → notify Author.
- **Target state**: `CLOSED_CANCELLED`.
- **State changes of related records**: **may auto-close the parent Document** if this was the only/last revision.
- **Electronic signature**: **required**, meaning `"CANCELLED"` (a previously-fixed gap per code comment — cancellation used to leave no e-signature record).
- **Audit trail**: cancellation logged.
- **Notifications**: `notifyAuthorRevisionCancelled`.
- **Transaction behavior**: `@Transactional`.
- **Cross-workflow side effects**: **WF-REV-10 → Document** (possible auto-close) — see `11`.
- **QF mapping**: `QF-MATCH` ("Cancel — the system requires the Activity Summary field... record then moves to Closed – Cancelled").
- **Known UNKNOWNs**: none.
- **Source evidence**: `RevisionService.cancelRevision`, `08` §8.4b.

### WF-REV-11 — Upgrade Revision
- **Actor**: Author/DCO.
- **Trigger**: Upgrade action on an `EFFECTIVE` revision.
- **Preconditions**: source revision `EFFECTIVE`; parent Document `ACTIVE`; no other revision of the same document already in progress (`ensureNoRevisionInProgress`).
- **Authorization**: `UPGRADE_REVISION` workflow action.
- **Steps**: creates a **brand-new** `DocumentRevisionRecord` with `parentRevision` = source; copies workflow participants and training config from the parent Document.
- **Target state**: new revision starts `DRAFT`; **the source EFFECTIVE revision is NOT touched** — it stays `EFFECTIVE` until the new draft is eventually published (WF-REV-09 handles the obsolete-on-publish cascade at that point).
- **Electronic signature**: none confirmed for the upgrade action itself.
- **QF mapping**: `QF-MATCH` (new revision creation from an Effective document).
- **Known UNKNOWNs**: none beyond what's tracked.
- **Source evidence**: `RevisionService.upgradeRevision`/`upgradeDocumentRevision`, `08` §8.4b.

### WF-REV-12 — Automatic previous-revision obsolescence
This is not a separately user-triggered workflow — it is the confirmed cascade **embedded inside WF-REV-09 (Publish)**, documented here as its own entry per the task's explicit checklist. See WF-REV-09 steps 5 and `11-cross-workflow-dependencies.md` for the full dependency map. **Manual/standalone revision obsolescence (a user directly clicking "Obsolete" on one revision) is confirmed dead code on the backend** (`RevisionWorkflowAction.OBSOLETE` and the `OBSOLETED` branch of `updateRevisionStatus` have zero callers; `RevisionController` has no `/obsolete` route) **and confirmed absent from the frontend too** (`20-ui-api-service-mapping.md` item 2) — this is a consistent, not contradictory, finding across both layers.

---

## CONTROLLED COPY

### WF-CC-01 — Request Controlled Copy
- **Actor**: Document Author (per QF) or any user matching `matchesDocumentViewer`/holding the request permission.
- **Trigger**: "Request Controlled Copy" action while the source revision is `EFFECTIVE`.
- **Preconditions**: source revision `EFFECTIVE` and has a rendered PDF (`requirePublishedPdfBytes`); document not a template; non-privileged users limited to exactly 1 internal copy for self.
- **Authorization**: `requireRequestControlledCopy`.
- **Steps**: validate signature token → quantity/recipient math → policy checks (email-distribution, external-recipient) → create `ControlledCopyDistributionBatch` → create copy/copies at `READY_FOR_DISTRIBUTION` (via the shared `setControlledCopyStatus` helper, keeping `status`/`statusCode` in lockstep).
- **Target state**: `READY_FOR_DISTRIBUTION`.
- **Electronic signature**: **required**, meaning `"CONTROLLED_COPY_REQUESTED"` — recorded **once per batch**, not per copy.
- **Audit trail**: `"REQUEST"` per copy.
- **Notifications**: **no confirmed live trigger** for "Controlled Copy Request → Document coordinator" (QF's stated rule) — `14-notifications.md` IMPLEMENTATION-GAP/UNKNOWN.
- **Transaction behavior**: `@Transactional`.
- **Async behavior**: none at request time (batch job creation happens at Distribute, not Request).
- **Cross-workflow side effects**: none yet.
- **QF mapping**: `QF-MATCH` on mechanics; `IMPLEMENTATION-GAP` on the missing coordinator notification.
- **Known UNKNOWNs**: the QF "8-hour download link" mechanism vs. the confirmed token+password mechanism (`21` item).
- **Source evidence**: `ControlledCopyService.requestControlledCopy`, `08` §8.4.

### WF-CC-02 — Distribute (single or batch)
- **Actor**: DCO/user with distribute permission.
- **Trigger**: Distribute action; **mandatory non-blank comment** (`QF-MATCH`).
- **Preconditions**: current status `READY_FOR_DISTRIBUTION`; `ensureControlledCopyNotExpired`.
- **Authorization**: `requireDistributeControlledCopy`.
- **Steps**: sign `"CONTROLLED_COPY_DISTRIBUTED"` → flip status → notify stakeholders → **batch path only**: create `ControlledCopyDistributionJob`, publish `ControlledCopyBatchDistributedEvent` (AFTER_COMMIT) → async worker `finalizeDistributedCopy` re-fetches fresh and checks terminal state before mutating (`SKIPPED_TERMINAL` if a concurrent action already won).
- **Target state**: `DISTRIBUTED`.
- **Electronic signature**: **required**, meaning `"CONTROLLED_COPY_DISTRIBUTED"`.
- **Notifications**: `notifyControlledCopyStakeholders`, `sendControlledCopyDistributionNotification` — confirmed live, policy-dispatched (`controlled_copy.distributed`).
- **Transaction behavior**: status flip is synchronous/in-transaction; per-copy finalize work is async, after-commit.
- **Async behavior**: `controlledCopyBatchExecutor` pool; retry on `OptimisticLockingFailureException` — 3 attempts, linear backoff 250/500ms — the **only retry-with-backoff pattern in the codebase** (`19`).
- **Failure behavior**: exhausted retries → job item `FAILED`, copy rolled back to Ready-for-Distribution, manual retry endpoint available (`19`).
- **Cross-workflow side effects**: none beyond batch/job state.
- **QF mapping**: `QF-MATCH`.
- **Known UNKNOWNs**: none.
- **Source evidence**: `ControlledCopyService.distribute`/`distributeBatch`, `08` §8.4, `12`, `19`.

### WF-CC-03 — Cancel Distribution (single or batch)
- **Actor**: DCO/user with cancel permission.
- **Trigger**: Cancel action.
- **Preconditions**: status `READY_FOR_DISTRIBUTION` only — **a Distributed copy can never be cancelled**; batch-cancel silently filters out already-Distributed copies as ineligible rather than failing the whole request.
- **Authorization**: `requireCancelControlledCopy`.
- **Steps**: sign `"CONTROLLED_COPY_DISTRIBUTION_CANCELLED"` → flip status → **batch path**: job + `ControlledCopyBatchCancelledEvent` → async `finalizeCancelledCopy` (re-fetches, explicitly re-checks `STATUS_DISTRIBUTED` before mutating, returns `false` not an exception if state changed).
- **Target state**: `CLOSED_CANCELLED`.
- **Electronic signature**: **required**, meaning `"CONTROLLED_COPY_DISTRIBUTION_CANCELLED"`.
- **Transaction behavior/Async behavior**: same shape as Distribute.
- **Cross-workflow side effects**: none.
- **QF mapping**: `IMPLEMENTATION-DISCOVERED` (QF does not explicitly state Distributed copies can never be cancelled, though it's consistent with QF's overall state model).
- **Known UNKNOWNs**: none.
- **Source evidence**: `ControlledCopyService.cancel`/`cancelBatch`, `08` §8.4.

### WF-CC-04 — Recall (single or batch)
- **Actor**: DCO/user with recall permission.
- **Trigger**: Recall action + mandatory reason.
- **Preconditions**: status `DISTRIBUTED` (batch: `DISTRIBUTED` or `OBSOLETED`).
- **Authorization**: `requireRecallControlledCopy`.
- **Steps**: sign `"CONTROLLED_COPY_RECALLED"` → set `obsoleteReason=RECALLED`, `recalledBy`/`recalledAt` → **batch path**: job + `ControlledCopyBatchRecalledEvent` → async `finalizeRecalledCopy` — **CONFIRMED: no terminal-state guard here**, unlike Distribute/Cancel's finalize methods (`08` §8.4, `12`) — and **confirmed unmitigated by the frontend too** (`20` item 6).
- **Target state**: `OBSOLETED`.
- **Electronic signature**: **required**, meaning `"CONTROLLED_COPY_RECALLED"`.
- **Cross-workflow side effects**: none beyond batch/job state.
- **QF mapping**: `QF-MATCH` on mechanics; the concurrency-guard asymmetry is `IMPLEMENTATION-DISCOVERED`, not addressed by QF at all.
- **Known UNKNOWNs**: none — this is a confirmed, cross-verified gap (both backend and frontend traced independently and agree).
- **Source evidence**: `ControlledCopyService.recall`/`recallBatch`, `08` §8.4, `12`, `20` item 6.

### WF-CC-05 — Destroy / Report Lost or Damaged
- **Actor**: DCO/user with report-lost-damaged permission.
- **Trigger**: Destroy/Report action.
- **Preconditions**: status `DISTRIBUTED` (checked against both `statusCode` and `currentStage`); evidence file required if reason is "Damaged"; executor ≠ witness (SoD-style control).
- **Authorization**: `requireReportLostDamaged`.
- **Steps**: sign `"CONTROLLED_COPY_DESTROYED"` → set `obsoleteReason` (LOST/DAMAGED/DESTROYED), `destroyedBy`/`At`, `destructionMethod`/`Type`, `witnessedBy` → `controlledCopyBatchStatusService.synchronize(copy)`.
- **Target state**: `OBSOLETED`.
- **Electronic signature**: **required**, meaning `"CONTROLLED_COPY_DESTROYED"`.
- **Cross-workflow side effects**: evidence file stored to a WORM-locked MinIO path, FK hardened to `ON DELETE RESTRICT` (`05`, `17`).
- **QF mapping**: `IMPLEMENTATION-DISCOVERED` (not explicit in QF's process text, though consistent with regulated destruction practice).
- **Known UNKNOWNs**: none.
- **Source evidence**: `ControlledCopyService.destroy`/`reportLostDamaged`, `08` §8.4, `17`.

### WF-CC-06 — Reissue / Replace Lost or Damaged
- **Actor**: DCO.
- **Trigger**: Replace action, following WF-CC-05.
- **Preconditions**: original must be `OBSOLETED` with reason Lost/Damaged (`requireReplaceLostDamaged`).
- **Steps**: creates a **brand-new** `ControlledCopyRecord` + new batch, linked via `replacedControlledCopy` (self-FK on the new record; reverse lookup is a repository query, not a mapped field) → new copy set to `READY_FOR_DISTRIBUTION`.
- **Target state**: new copy `READY_FOR_DISTRIBUTION`; original untouched (stays `OBSOLETED`).
- **Electronic signature**: **required**, meaning `"CONTROLLED_COPY_REISSUED"`.
- **QF mapping**: `IMPLEMENTATION-DISCOVERED`.
- **Known UNKNOWNs**: none.
- **Source evidence**: `ControlledCopyService.replaceLostDamaged`, `08` §8.4.

### WF-CC-07 — Expiry / Auto-obsolete (scheduled)
- **Actor**: system (no human actor).
- **Trigger**: `ControlledCopyExpiryScheduler.runDailyExpiryProcessing`, daily 02:00, Redis-lease-guarded (30 min).
- **Preconditions**: status `DISTRIBUTED`, `hasExpiryDate=true`, `expiryDate <= now`.
- **Steps**: `sendExpiryReminders()` first (7-day-out reminder, marks `expiryReminderSentAt`, no status change — **confirmed to bypass `NotificationDispatcher` entirely**, unlike every other notification in the system) → `autoObsoleteExpiredControlledCopies()` sets `statusCode="OBSOLETED"`/`status="Obsoleted"` together, `obsoleteReason=EXPIRED`, `obsoletedBy=` system account → propagates to parent batch.
- **Target state**: `OBSOLETED`.
- **Electronic signature**: none (system action, no human signer).
- **Transaction behavior**: `@Transactional` sub-methods within the scheduled job.
- **Async behavior**: scheduled, not event-driven; distributed-lock-protected against multi-instance duplication.
- **Cross-workflow side effects**: parent `ControlledCopyDistributionBatch` synchronized.
- **QF mapping**: `QF-MATCH` on outcome; the reminder-notification bypass of the policy engine is `IMPLEMENTATION-DISCOVERED` (architecturally inconsistent, not itself proven wrong).
- **Known UNKNOWNs**: whether this matches QF's separately-described "8-hour download link" concept — likely a different mechanism entirely (`21`).
- **Source evidence**: `ControlledCopyExpiryScheduler`, `08` §8.4, `13`, `14`.

### WF-CC-08 — Batch Distribution / Cancel / Recall (async mechanics, cross-cutting)
This is the shared infrastructure underlying WF-CC-02/03/04 for the batch case, documented once here per the task's explicit checklist item.
- **Mechanism**: status flips synchronously for the batch + all member copies at request time; a `ControlledCopyDistributionJob` + per-copy `ControlledCopyDistributionJobItem` rows are created; an application event (`ControlledCopyBatchDistributedEvent`/`CancelledEvent`/`RecalledEvent`) is published AFTER_COMMIT; a dedicated async worker (`controlledCopyBatchExecutor` pool) consumes the event and performs per-copy finalization (PDF/notification work), re-fetching each copy fresh from the DB (never operating on a cached snapshot).
- **Failure/retry**: up to 3 attempts per copy, linear backoff (250ms, 500ms); Distribute and Cancel finalize methods explicitly re-check terminal state before mutating (Distribute via `isTerminalControlledCopyStatus`, Cancel via an explicit `STATUS_DISTRIBUTED` re-check); **Recall's finalize has neither** — confirmed gap. Exhausted retries mark the job item `FAILED`; a manual retry endpoint (`POST .../retry-failed?action=...`) reprocesses only `FAILED` items.
- **Restart resilience**: all three batch async services have an identical `resumePendingJobs()` (`@Scheduled(fixedDelay=30000)`) that atomically claims and resumes jobs left `PENDING` after a backend restart — confirmed present on all three (Distribution, Cancel, Recall), not just Distribution.
- **Frontend**: polls/listens (SSE + polling fallback) for async completion on all three actions; shows a batch-result modal with failed-item detail and a retry affordance; does **not** compensate for the Recall terminal-state gap.
- **QF mapping**: `IMPLEMENTATION-DISCOVERED` (async batch architecture is not described in QF at this level of detail).
- **Source evidence**: `08` §8.4, `12`, `13`, `19`, `20` item 6.

---

## Coverage note
This file covers every workflow item enumerated in the request. Deeper per-field validation rules and the full business-rule catalog derived from these workflows are in `09-business-rules.md`; the full cross-entity dependency map (including the two independently-implemented Controlled-Copy-obsolete cascades) is in `11-cross-workflow-dependencies.md`.
