# Document Revision Lifecycle — AS-IS Deep Dive

Status: **AS-IS reconstruction from source code. READ/ANALYZE/DOCUMENT ONLY.**
No application code, tests, or migrations were modified to produce this document. No TO-BE
requirements are proposed here.

## 0. Source-of-Truth Rule

For this document, **current source code is the AS-IS truth**. `docs/as-is-sds/*`, the closed
Document Lifecycle TO-BE, and QF SDS/FRS were used only as navigation aids. Every FACT below is
anchored to a file/class/method. Evidence labels used throughout:

- **FACT** — directly observed in current source.
- **INFERENCE** — reasonable conclusion not directly proven by a single code line.
- **UNKNOWN** — could not be determined from the code read in this pass.
- **CONFLICT** — contradictory or inconsistent evidence found.
- **DEAD CODE / UNREACHABLE** — code exists but no reachable caller/endpoint was found.

Repos: backend `d:\edms-project\eqms-backend` (`com.eqms`), frontend `d:\edms-project\eqms`
(`src/features/documents`).

---

## 1. Scope & Methodology

Reconstructed via 6 parallel deep-read passes over `DocumentRevisionRecord`, `RevisionService.java`,
`RevisionController.java`, repositories, DTOs, `RevisionWorkflowAuthorizationService`,
`RevisionResourceAdapter`, `RevisionActionCapabilityService`, `ElectronicSignatureService`,
`AuditTrailService` call sites, `EmailNotificationService`/notification dispatch, Flyway migrations,
and the frontend Revision UI (`document-revisions/`, `document-list/document-creation/`). Every
claim below cites file/method; line numbers refer to the working tree at the time of this pass and
may drift slightly with future edits.

---

## 2. Revision Domain Model

**Entity**: `DocumentRevisionRecord` (`entity/DocumentRevisionRecord.java`), table `document_revisions`.

| Field | Type | Nullable | Notes |
|---|---|---|---|
| `id` | UUID | no | `@Id`, **no `@GeneratedValue`** — app-assigned (`revision.setId(UUID.randomUUID())` in `RevisionService`). |
| `lockVersion` | long | no | `@Version` — optimistic lock. |
| `document` | FK → DocumentRecord | no | `@ManyToOne(LAZY)`. |
| `parentRevision` | FK → self | yes | Lineage pointer; null for root/first revisions. |
| `status` | FK (natural key `code`) → RevisionStatusDefinition | no | Canonical lifecycle state. |
| `documentType`, `businessUnit`, `department` | FK | no | Snapshotted at revision level, not read live from Document. |
| `author`, `owner` | FK → UserAccount | no | |
| `openedBy`, `lastModifiedBy` | FK → UserAccount | yes | |
| `publishedBy/At`, `submittedBy/On`, `rejectedBy/At`, `obsoletedBy/At`, `cancelledBy/At` | FK+Instant pairs | yes | Per-transition attribution. |
| `revisionNumber` | String(40) | no | Free-form `A.0.B` string; format enforced by app code, not a DB CHECK. |
| `revisionName` | String(255) | no | **Not client-settable** — recomputed in `@PrePersist`/`@PreUpdate` (`syncRevisionName()`) as `documentName_revisionNumber`. |
| `editingStatus` | String(30), default `"IN_PROGRESS"` | no | Plain string, not FK'd/enum — independent of workflow `status` (Office-Online editing state). |
| `sourceLocked` | boolean, default false | no | Guards source-file editing during review/approval. |
| `completedByUserId`/`completedAt` | raw UUID/Instant | yes | **Not** a mapped `@ManyToOne` — inconsistent with other actor fields. |
| `effectiveDate`, `validUntil` | LocalDate | yes | Set at publish time. |
| `periodicReviewCycle`, `periodicReviewNotification` | Integer | yes | Falls back to Document's own value if unset. |
| `reviewRequirement` | enum (`NONE`/`REQUIRED`), default `REQUIRED` | no | **Snapshot** of the Sub-Type rule at creation time — comment: "never recompute for an in-flight revision." |
| `requiresTraining`, `trainingPeriodDays`, `reasonForSkippingTraining`, `trainingPlannedDate`, `trainingPeriodEndDate`, `trainingCompletionDate` | mixed | mixed | See §10. |
| `fileName`, `filePath`, `previewFilePath`, `fileType`, `fileSize` | mixed | yes | Source/working file. |
| `sourceStorageProvider/Bucket/ObjectKey/VersionId`, `sourceFileChecksum`, `sourceUploadedAt` | mixed | yes | Object-storage metadata for the working DOCX. |
| `storageProvider/SiteId/DriveId/ItemId/WebUrl/EditUrl/EditPermissionId/ViewUrl/ViewPermissionId/PdfUrl/SyncStatus/LastSyncedAt` | mixed | yes | SharePoint/Office-Online collaboration metadata. |
| `snapshotStatus`, `snapshotError`, `snapshotRequestId`, `snapshotSourceChecksum` | mixed | yes | Async PDF/preview snapshot pipeline state. |
| `impactAnalysisId` | UUID | yes | Links a revision created via Upgrade to an impact-analysis/upgrade session. |
| `createdAt`/`updatedAt` | Instant | no | Auto-managed. |

**`RevisionStatusDefinition`** (table `revision_statuses`): `code` (String(40), PK, natural key),
`label` (unique), `sortOrder`, `terminal` (boolean), timestamps.

**CONFLICT / governance note (FACT)**: class javadoc on `RevisionStatusDefinition` states the state
set is fixed by architecture ("Admin may NOT create/rename/delete states") but explicitly admits
*"there is currently no DB-level constraint stopping it"* — i.e. the invariant is convention-only,
not enforced in schema.

### Repository query methods (`DocumentRevisionRepository`)
Selected business-relevant methods: `existsByDocument_IdAndStatus_CodeIn` (in-progress check),
`existsByDocument_IdAndStatus_CodeInAndIdNot`, `findFirstByDocument_IdAndStatus_CodeOrderByCreatedAtDesc`
(latest-in-status lookup, e.g. current Effective), `countByDocument_Id` (drives auto-close-on-last-cancel,
see §11), `findMyPendingTasks(userId, statusCodes, participantTypes)` (personal task-queue query joining
`DocumentWorkflowParticipant`).

### Key DTOs (`dto/document/`)
`RevisionCreationRequest`, `RevisionWorkflowActionRequest` (generic action body: comment/reason/
signatureToken/forcePublish/training dates), `RevisionDetailResponse` (large, includes **pre-computed
boolean capability flags** — `canEditFileOnline`, `canReviewRevision`, `canApproveRevision`,
`canCompleteTraining`, `canPublishRevision`, etc. — server decides eligibility, not the client),
`RevisionListItemResponse`, `RevisionHistoryResponse`, `RevisionSignatureResponse`,
`RevisionWorkingNoteRequest/Response`, `RevisionOfficeOnlineLinkResponse`,
`RevisionWorkspaceSnapshotRequest/Response`, `RevisionWorkspaceBatchRequest/Response` (+ per-item
response with `errorCode`/`errorMessage`), `RevisionUpgradeSessionResponse`,
`RevisionUpgradeImpactItemResponse`, `RevisionUpgradeContinueRequest`.

---

## 3. Revision Status Dictionary

**FACT — 8 statuses, seeded in `V9__create_revision_management_schema.sql`, re-affirmed in
`V77__ensure_status_lookup_consistency.sql`, `sort_order` for `READY_FOR_PUBLISHING` later changed by
`V282__remove_pdf_comments_and_add_ready_for_publishing.sql`:**

| Code | Label | sort_order | terminal |
|---|---|---|---|
| DRAFT | Draft | 1 | false |
| PENDING_REVIEW | Pending Review | 2 | false |
| PENDING_APPROVAL | Pending Approval | 3 | false |
| PENDING_TRAINING | Pending Training | 4 | false |
| READY_FOR_PUBLISHING | Ready for Publishing | 45 (V282) | false |
| EFFECTIVE | Effective | 6 | false |
| OBSOLETED | Obsoleted | 7 | **true** |
| CLOSED_CANCELLED | Closed - Cancelled | 8 | **true** |

No 9th status literal was found across code/migrations. Document Master uses a separate, smaller
status set (`DRAFT`/`ACTIVE`/`OBSOLETED`/`CLOSED_CANCELLED`) — Document `ACTIVE` corresponds to
Revision `EFFECTIVE`.

**In-application "in-progress" set** — `RevisionService.IN_PROGRESS_REVISION_STATUS_CODES` =
`{DRAFT, PENDING_REVIEW, PENDING_APPROVAL, PENDING_TRAINING, READY_FOR_PUBLISHING}` — i.e. everything
except `EFFECTIVE` and the two terminal states.

**DB-level mirror (FACT)** — `V73__enforce_single_in_progress_revision.sql` creates:
- Partial unique index `ux_document_revisions_one_in_progress` on `(document_id)` WHERE status_code
  IN the same 5-value set — hard DB enforcement of "at most one in-progress revision per document,"
  independent of and in addition to the service-level `ensureNoRevisionInProgress` check.
- Full unique index `ux_document_revisions_document_revision_number` on `(document_id, revision_number)`.

---

## 4. State-Machine Diagram (textual)

```
DRAFT ──submitForReview──▶ PENDING_REVIEW ──(all reviewers REVIEWED)──▶ PENDING_APPROVAL
  ▲                              │                                          │
  │                         rejectReview                              (all approvers APPROVED)
  │                              ▼                                          │
  └────────────────────────── DRAFT                                        ▼
  ▲                                                                  PENDING_APPROVAL
  │                                                                         │
  │                                                                   rejectApproval
  └─────────────────────────── DRAFT ◀──────────────────────────────────────┘
                                  │
                    (no reviewers, no approvers, requiresTraining)
                                  ▼
                           PENDING_TRAINING ──completeTraining──▶ READY_FOR_PUBLISHING
                                  │                                       │
                    (no reviewers/approvers/training)                 publish
                                  ▼                                       ▼
                           READY_FOR_PUBLISHING                      EFFECTIVE
                                                                          │
                                                        (new sibling revision published)
                                                                          ▼
                                                                     OBSOLETED
DRAFT ──cancel──▶ CLOSED_CANCELLED   (Cancel is DRAFT-only; see §15)
any non-terminal ──(Document Obsolete cascade)──▶ OBSOLETED   (see §16)
```

`submitForReview`/`completeReview`/`completeApproval` all compute the **target status dynamically**
via the same ternary pattern (`RevisionService.java` ~976-984, ~1040-1044, ~1133-1135):
```java
hasReviewers ? "PENDING_REVIEW"
  : hasApprovers ? "PENDING_APPROVAL"
  : requiresTraining ? "PENDING_TRAINING"
  : "READY_FOR_PUBLISHING"
```
So a revision can legally skip PENDING_REVIEW and/or PENDING_APPROVAL and/or PENDING_TRAINING
entirely, depending on configured participants and `requiresTraining`.

### Transition table

| From | To | Trigger | Method | Permission | Assignment | E-sig | Reason req.? | Audit | Notify | Txn |
|---|---|---|---|---|---|---|---|---|---|---|
| DRAFT | DRAFT (metadata edit) | Edit Draft | (edit endpoints, not deep-traced) | `documents.document.edit_metadata`-style | Author | no | no | UPDATE | — | @Transactional |
| DRAFT | DRAFT | Complete (Author) Editing | `completeEditing`/`COMPLETE_AUTHORING` | `documents.revision.complete_authoring` | Author | **yes** (`PREPARED`) | optional | — | `notifyDcoRevisionReadyForSubmission` | @Transactional |
| DRAFT | PENDING_REVIEW / PENDING_APPROVAL / PENDING_TRAINING / READY_FOR_PUBLISHING | Submit for Review | `submitForReview` | `documents.workspace.manage` (was `documents.revision.submit_review` before V290) | DCO/DOCUMENT_CONTROLLER access-profile | **yes** (`SUBMITTED_FOR_REVIEW`; requires prior `PREPARED` sig) | optional | `SUBMIT_FOR_REVIEW` | next reviewer/approver or stakeholders | @Transactional |
| PENDING_REVIEW | PENDING_REVIEW (non-final) / next status (final) | Reviewer Approve | `completeReview` | `documents.revision.review` | assigned (sequence-next) reviewer | **yes** (`REVIEWED`) | optional | `REVIEW_COMPLETE` | next reviewer/approver | @Transactional |
| PENDING_REVIEW | DRAFT | Reviewer Reject | `rejectReview` | `documents.revision.reject_review` | assigned reviewer | **yes** (`REJECTED`) | not enforced at method level | `SOURCE_UNLOCKED` + `REVIEW_REJECT` | workflow coordinators | @Transactional |
| PENDING_APPROVAL | PENDING_APPROVAL (non-final) / next status (final) | Approver Approve | `completeApproval` | `documents.revision.approve` | assigned approver | **yes** (`APPROVED`) | optional | `APPROVE_COMPLETE` | next approver / stakeholders / coordinators | @Transactional |
| PENDING_APPROVAL | DRAFT | Approver Reject | `rejectApproval` | `documents.revision.reject_approval` | assigned approver | **yes** (`REJECTED`) | not enforced | `SOURCE_UNLOCKED` + `APPROVE_REJECT` | **none — implementation asymmetry, see §6** | @Transactional |
| PENDING_TRAINING | READY_FOR_PUBLISHING | Complete Training | `completeTraining` | `documents.revision.complete_training` (DCO/DOCUMENT_ADMIN) | permission-based, not sequence | **yes** (`TRAINING_CONFIRMED`) | no | `TRAINING_COMPLETE` (via history helper) | via `updateRevisionStatus` | @Transactional |
| READY_FOR_PUBLISHING | EFFECTIVE | Publish | `publishRevision` (called from `PublishingWorkspaceService.completePublish`) | `documents.revision.publish` (DCO/DOCUMENT_ADMIN) | none beyond permission | **yes** (`PUBLISHED`) | optional (mandatory if force-publish) | `PUBLISH` (Document) + revision history | all stakeholders (`document-publish`) | @Transactional, **async job wrapper** |
| EFFECTIVE | OBSOLETED | new sibling published (supersede) | `publishRevisionRecord` internal loop | n/a (system cascade) | n/a | inherited signature session of the publishing action | n/a | `OBSOLETE` (per superseded revision) | — | same txn as Publish |
| any in-progress | OBSOLETED | Document Obsolete cascade | `obsoleteRevisionAsPartOfDocumentObsolete` | Document-level Obsolete permission | n/a | inherited | inherited (Document's Obsolete reason) | `OBSOLETE` | — | same txn as Document Obsolete |
| DRAFT | CLOSED_CANCELLED | Cancel Revision | `cancelRevision` | `documents.revision.cancel` (DCO/DOCUMENT_ADMIN) | none beyond permission | **yes** (`CANCELLED`) | **mandatory** | `CANCEL` (via history helper only) | `notifyAuthorRevisionCancelled` (Author + Co-authors) | @Transactional |
| EFFECTIVE | DRAFT (new revision) | Upgrade | `upgradeRevision`/`upgradeDocumentRevision` | `documents.revision.upgrade` (DCO/DOCUMENT_ADMIN) | none beyond permission | **no** (gap, see §9/§15) | no | `UPGRADE` (double-logged, see §16) | **none found** | @Transactional, PESSIMISTIC_WRITE lock |

---

## 5. Workflow Catalog

Confirmed vs. the candidate list in the request, using CONFIRMED / RENAMED / NOT-LIVE / DEAD labels:

| ID | Name | Status |
|---|---|---|
| R-WF-01 | Create / Upload initial Revision | **CONFIRMED** — `createRevisionAndUploadFile`/`uploadRevisionFile`; triggers Document DRAFT→ACTIVE (`activateDocumentAfterInitialSourceStored`) only for the parentless first revision. |
| R-WF-02 | Edit Draft Revision | **CONFIRMED, fully traced (Phase R1.1)** — see §6a for the complete Draft-editing model. The real edit gate is `editingStatus` (not the DRAFT `status` column, which stays DRAFT through Complete Editing). Working Notes are **not** part of Draft editing — they are Review/Approval-stage-only, corrected out of this workflow's scope. |
| R-WF-03 | Complete Editing | **CONFIRMED** — `completeEditing`/`COMPLETE_AUTHORING`, requires `PREPARED` e-signature. |
| R-WF-04 | Submit for Review | **CONFIRMED** — `submitForReview` (also covers "submit for approval" — see R-WF-07 rename). |
| R-WF-05 | Reviewer Approve / Complete Review | **CONFIRMED** — `completeReview`. |
| R-WF-06 | Reviewer Reject | **CONFIRMED** — `rejectReview`. |
| R-WF-07 | Submit for Approval | **RENAMED/MERGED into R-WF-04** — there is no distinct "submit for approval" action; `submitForReview`'s dynamic ternary can land directly on `PENDING_APPROVAL`, and `completeReview`'s final-reviewer branch can also land on `PENDING_APPROVAL`. No separate endpoint/method exists. |
| R-WF-08 | Approver Approve | **CONFIRMED** — `completeApproval`. |
| R-WF-09 | Approver Reject | **CONFIRMED** — `rejectApproval` (but produces no notification — see §6). |
| R-WF-10 | Submit / transition to Training | **RENAMED/MERGED into R-WF-04/05/08** — entry into `PENDING_TRAINING` is a branch of `submitForReview`/`completeReview`/`completeApproval`, not a separate action. |
| R-WF-11 | Training completion | **CONFIRMED, but PARTIAL/INCOMPLETE integration** — `completeTraining`; no real training-assignment/tracking subsystem found (see §10). |
| R-WF-12 | Ready for Publishing | **RENAMED/MERGED** — same as R-WF-10, a branch outcome, not a distinct action. |
| R-WF-13 | Publish / Effective | **CONFIRMED** — `publishRevision` / `PublishingWorkspaceService.completePublish`, async job. |
| R-WF-14 | Upgrade Revision / create next Revision | **CONFIRMED** — two parallel entry points, `upgradeRevision(revisionId)` and `upgradeDocumentRevision(documentId)`, with **divergent** next-number algorithms (see §9/§13/§17). |
| R-WF-15 | Cancel Revision | **CONFIRMED, DRAFT-only** — `cancelRevision`. |
| R-WF-16 | Obsolete Revision | **NOT A STANDALONE LIVE WORKFLOW** — `obsoleteRevisionAsPartOfDocumentObsolete` exists only as a cascade helper called from `DocumentService.obsoleteDocument`; no reachable controller endpoint sets a Revision to OBSOLETED directly. See §15. |
| R-WF-17 | Automatic supersede of previous Effective Revision | **CONFIRMED** — inline inside `publishRevisionRecord` (the same transaction as Publish). |
| R-WF-18 | Rework/resubmit loop | **CONFIRMED** — rejection (review or approval) resets ALL reviewer/approver decisions for that round and returns to DRAFT; resubmission restarts the full sequential chain. |
| R-WF-19 | Editing/Publishing workspace workflow | **CONFIRMED** — `PublishingWorkspaceService`/`PublishingWorkspaceController`/`PublishingWorkspaceJobProcessorService`, async, template-driven PDF composition. |
| R-WF-20 | Exceptional/admin transition | **PARTIALLY CONFIRMED / DEAD** — a "force publish" override exists (`documents.revision.force_publish`, granted to nobody by default) but the production async publish path (`PublishingWorkspaceService.completePublish`) **hardcodes `forcePublish=false`**, so this override is effectively unreachable from the primary UI/job path (DEAD CODE / UNREACHABLE from the normal flow — only reachable via a direct `RevisionService.publishRevision` call with `forcePublish=true`, which was not found to be wired to any controller). A separate, formally-modeled "Revision Upgrade Session" API (`createRevisionUpgradeSession`/`continueRevisionUpgradeSession`/`getRevisionUpgradeSession`, plus `RevisionUpgradeSessionResponse`) exists in `documents.ts` but is **called from zero frontend components** — DEAD/UNREACHABLE frontend API surface (see §19). |

**CORRECTED RECOUNT (Phase R1.1)** — the prior "12 confirmed" headline undercounted by conflating
"standalone/reachable" with an arbitrary target total. Recounting the 15 IDs actually enumerated in
the catalog (R-WF-01,02,03,04,05,06,08,09,11,13,14,15,17,18,19), classified independently as
LIVE (standalone, reachable action) / PARTIAL (live but functionally incomplete) / CASCADE-ONLY (no
standalone endpoint, only fires as a side effect) / BRANCH OUTCOME (not a distinct action, describes
composite behavior of other confirmed actions) / DEAD:

| ID | Classification | Evidence |
|---|---|---|
| R-WF-01 | LIVE | `createRevisionAndUploadFile`/`uploadRevisionFile` (Service L3565/3524), no dedicated single endpoint but reachable. |
| R-WF-02 | LIVE | `updateRevision` (Service L712, `@Transactional`) ← `PUT /revisions/{id}` (Controller L174-175). |
| R-WF-03 | LIVE | `completeEditing` (Service L741) ← `POST /revisions/{id}/complete-editing` (Controller L182-183). |
| R-WF-04 | LIVE | `submitForReview` (Service L915) ← `POST /revisions/{id}/submit-review` (Controller L190-191). |
| R-WF-05 | LIVE | `completeReview` (Service L1022) ← `POST /revisions/{id}/review/complete` (Controller L198-199). |
| R-WF-06 | LIVE | `rejectReview` (Service L1057) ← `POST /revisions/{id}/review/reject` (Controller L206-207). |
| R-WF-08 | LIVE | `completeApproval` (Service L1102) ← `POST /revisions/{id}/approve/complete` (Controller L214-215). |
| R-WF-09 | LIVE | `rejectApproval` (Service L1142) ← `POST /revisions/{id}/approve/reject` (Controller L222-223). |
| R-WF-11 | LIVE, PARTIAL | `completeTraining` (Service L1188) ← `POST /revisions/{id}/training/complete` (Controller L230-231); reachable/standalone, but backed by a thin attestation-only subsystem (§8). |
| R-WF-13 | LIVE | `publishRevision` (two overloads, Service L1259/1265) ← `POST /revisions/{id}/publish` (Controller L238-239), async via `PublishingWorkspaceService.completePublish`. |
| R-WF-14 | LIVE (two entry points) | `upgradeRevision` (Service L1486) ← `POST /revisions/{id}/upgrade` (Controller L247); `upgradeDocumentRevision` (Service L1410) ← `POST /documents/{id}/upgrade-revision` (DocumentController L133-136). Both standalone/reachable server-side (frontend reachability is a separate question, see §9/§22 update). |
| R-WF-15 | LIVE, DRAFT-only | `cancelRevision` (Service L1352) ← `POST /revisions/{id}/cancel` (Controller L319-320). |
| R-WF-17 | CASCADE-ONLY | Inline inside the Publish transaction (`publishRevisionRecord`'s supersede loop) — no standalone method/endpoint of its own. |
| R-WF-18 | BRANCH OUTCOME | Emergent behavior of R-WF-06/09 (reset+return-to-DRAFT) followed by re-running R-WF-04 — not a separately invocable action. |
| R-WF-19 | LIVE (distinct subsystem) | `PublishingWorkspaceController`/`PublishingWorkspaceService` — `GET/POST /revisions/workspaces`, `/workspaces/batch-save`, `/workspaces/batch-submit` (Controller L251-280). |

**Corrected count: 13 of the 15 enumerated IDs are live, standalone, reachable workflow actions**
(R-WF-01,02,03,04,05,06,08,09,11,13,14,15,19 — one of these, R-WF-11, is functionally partial but
still a genuine standalone action). **2 of the 15 (R-WF-17, R-WF-18) are not separate actions** —
they describe cascade/branch behavior of other confirmed actions and were miscounted as if standalone
in the prior pass. This does not force a predetermined total; it is the direct recount. Combined with
the previously-merged R-WF-07/10/12 (branch outcomes of R-WF-04/05/08, not separately counted here)
and the not-standalone R-WF-16 (cascade-only Revision Obsolete) and largely-dead R-WF-20
(force-publish override unreachable from the production path), the full picture across all 20
original candidate IDs is: **13 standalone/live actions, 3 branch-outcome/merged IDs (07,10,12) plus
1 more (18) = 4 branch-outcome IDs total, 2 cascade-only IDs (16,17), and 1 largely-dead ID (20).**

---

## 6a. Draft Editing (R-WF-02) — Complete Deep Trace (Phase R1.1)

**Metadata update** — `RevisionService.updateRevision(UUID, DocumentDraftCreateRequest)` (L712-739,
`@Transactional`) ← `PUT /revisions/{id}` (Controller L174-175). Authorization: permission
`documents.revision.update_draft_metadata` (a policy-based grant, not hardcoded to Author/Co-Author).
Guards: `requireRevisionStatus(revision, "DRAFT")` (L722) AND, critically,
`requireRevisionNotCompletedEditing(revision)` (L723) — **the real edit gate is `editingStatus`, not
the DRAFT `status` column**: a Draft revision whose Author already signed `completeEditing` has
`editingStatus == "COMPLETED"` while `status` is still nominally `DRAFT`, and this second guard blocks
further metadata mutation even though the status column alone would appear to still permit it. Audit:
`recordRevisionHistory(revision, "UPDATE", ...)` — a revision-history row only, a thinner footprint
than workflow-transition actions which also get a full `auditTrailService.logAs` entry.

**Author/Co-author edit permission** (a separate, narrower gate used elsewhere in the UI, not by the
`PUT` endpoint itself) — `DocumentAuthorizationService.canEditDraftRevision`: true only if
`status == DRAFT` AND (user is the Author OR a `CO_AUTHOR` participant). Backs
`canEditRevisionFileOnline` (Office Online eligibility) and UI capability checks, distinct from the
policy-permission gate that actually protects `PUT /revisions/{id}`.

**Source file upload/replace** — `uploadRevisionFile` (L3523-3562, `@Transactional`) ←
`POST /revisions/{id}/upload` (Controller L282-283). Guard chain: `requireCanUploadRevision`
(**Author-only**, stricter than the metadata permission gate — throws "Only the assigned Author can
upload the revision file"), `requireRevisionFileAccess(..., UPLOAD)`, `requireRevisionStatus(DRAFT)`,
`ensureNoRevisionInProgress`. **Gap noted**: no explicit `requireRevisionNotCompletedEditing` check in
this guard chain itself — whether the file-access layer independently consults `sourceLocked`/lock
state was not independently re-verified; flagged as unconfirmed, not a proven bug. Checksum/version
bookkeeping recorded via `revisionFileAuditChanges` fed into a `"REVISION_SOURCE_FILE_UPLOADED"`
history entry. `applyRevisionSnapshot` re-runs on upload too, re-syncing document-derived fields.

**Office Online edit integration**: open/edit-link (`GET /revisions/{id}/office-online/edit-link`)
gated by `canEditRevisionFileOnline` (DRAFT + `!sourceLocked` + Author/Co-Author). Sync-back
(`POST /revisions/{id}/office-online/sync-back`) → `syncEditedFileFromOfficeOnlineToMinio`. Lock on
Complete Editing via `lockOfficeOnlineEditing` (revokes Graph edit/write/review sharing permissions).
**Reopen after rejection** — `reopenOfficeOnlineWorkingCopy` (L4122-4132) explicitly preserves the
SharePoint file (not replaced) so Reviewer/Approver tracked changes/comments survive for the Author to
resolve; if a live Office item exists it calls `syncEditedFileFromOfficeOnlineToMinio` **then
re-locks** via `lockOfficeOnlineEditing` again (L4130-4131). **Observed tension, not resolved here**:
the revision-level `sourceLocked` flag is set `false` on rejection (reopening DRAFT metadata edit),
but the Office-Online-specific Graph lock is immediately reasserted by the same reopen flow — i.e.
`sourceLocked=false` at the DB level does not necessarily mean the live Office Online copy is
re-editable; this discrepancy is recorded as an observed FACT, not adjudicated as a bug.

**Working Notes are NOT part of Draft editing (correction from the prior pass)** — `addWorkingNote`/
`deleteWorkingNote`/`listWorkingNotes` (L579-644) are gated by `requireWorkingNoteWriteAccess` →
`resolveWorkingNoteStage`, which returns a writable stage **only** when status is `PENDING_REVIEW` or
`PENDING_APPROVAL`, restricted further to the specific currently-pending Reviewer/Approver. **There is
no code path permitting a working note while status is DRAFT.** The prior pass's framing of Working
Notes as a Draft-editing sub-feature is corrected here: Working Notes are exclusively a Review/
Approval-stage feature, never authored by Author/Co-Author, never during DRAFT.

**Training-field edits** (`trainingPlannedDate`, `trainingPeriodEndDate`, `trainingCompletionDate`) —
set via `applyTrainingSchedule` inside `updateRevision` itself (same DRAFT + `editingStatus != COMPLETED`
gate as metadata generally, not restricted further to Author/Co-Author beyond the permission grant).

**Related/correlated fields**: Revision only stores boolean has-flags snapshotted from the Document
(`hasRelatedDocuments`/`hasCorrelatedDocuments`); actual related/correlated document lists are
Document-owned and queried live, never independently Revision-edited.

**`reviewRequirement`/Sub-Type snapshot**: set once at creation/upload via `resolveReviewRequirement`,
and **confirmed never recomputed** for an open Draft — `syncDraftRevisionWithDocument` (the one method
that re-syncs stale Document-level config onto an open Draft) does not touch `reviewRequirement`/
`subType` in its resync list. If a DCO changes the Document's Sub-Type/Review-Requirement configuration
while a Draft is open, the Draft's snapshotted value goes stale and is never auto-corrected.

**`sourceLocked`/`editingStatus` transition summary**:

| Event | `editingStatus` | `sourceLocked` |
|---|---|---|
| Draft created/uploaded | → `"IN_PROGRESS"` (if unset) | untouched |
| Complete Editing | → `"COMPLETED"` | → `true` |
| Reviewer Reject | → `"IN_PROGRESS"` | → `false` |
| Approver Reject | → `"IN_PROGRESS"` | → `false` |

After Complete Editing, both flags lock down metadata edits (via `editingStatus`) and Office-Online
online-editing (via `sourceLocked`), even though the DB `status` column stays `"DRAFT"` until Submit
for Review. After a rejection, both flags reset, reopening Draft metadata edits (subject to the
Office-Online re-lock caveat above).

All mutating methods traced are individually `@Transactional`; `completeEditing` and `submitForReview`
additionally fire an after-commit realtime UI broadcast (`publishRevisionWorkflowUpdateAfterCommit`),
deliberately outside the transaction boundary so clients are never notified of a mutation that could
still roll back.

---

## 6. Review Workflow — Deep Trace

**Assignment storage**: `RevisionWorkflowParticipant` entity, table `revision_workflow_participants`:
`revision` FK, `participantType` (`"REVIEWER"`/`"APPROVER"`/`"CO_AUTHOR"`), `user`, `sequenceOrder`
(int), `actionStatus` (default `"PENDING"`), `actionComment`, `actedAt`, `signatureSessionId`.

**Sequential, ALL-must-act (FACT)**: `requirePendingParticipant` requires the acting user's row be
`actionStatus=="PENDING"` **and** be the lowest-`sequenceOrder` still-PENDING participant of that
type (`nextPendingParticipant`) — reviewers act strictly one at a time, in order. `completeReview`
advances the revision only once `countParticipantsByStatus(REVIEWER,"REVIEWED") ==
countParticipants(REVIEWER)` — i.e. ALL reviewers must individually approve; one rejection is not
"outvoted" by others, and conversely one approval does not resolve the round if others remain pending.

**No per-decision history entity (FACT)**: there is no `RevisionReviewComment`-style entity — an
individual reviewer's decision lives only on their own `RevisionWorkflowParticipant` row
(`actionStatus`, `actionComment`, `actedAt`), which is **overwritten/reset** on every
rejection/resubmission round (see below). Only `RevisionWorkflowHistory` (status-transition audit)
retains a durable trail across rounds.

**Rejection wipes the ENTIRE round for BOTH reviewers and approvers (FACT, important)**:
`rejectReview` calls `resetParticipantActions(revision,"REVIEWER")` **and**
`resetParticipantActions(revision,"APPROVER")` unconditionally — every reviewer's AND approver's
`actionStatus` is reset to `PENDING`, comments/timestamps cleared, for both roles, not just the
rejecting reviewer. Resulting status: hardcoded back to `DRAFT`. Side effects:
`editingStatus="IN_PROGRESS"`, `sourceLocked=false`, draft review snapshot cleared, Office Online
working copy reopened.

**E-signature / reason**: Reject requires an e-signature (meaning `REJECTED`) but the mandatory-reason
check is **not enforced at the method level** for either `rejectReview` or `rejectApproval` — the
comment field is optional at this layer (`firstNonBlank(comment, reason)` can be null).

**SoD / eligibility (`DocumentWorkflowSetting` flags, defaults in parens)**:
- `reviewerNoApprove` (false) — a Reviewer of this revision cannot also Approve it (checked live at
  approval time).
- `requireTwoReviewers` (false) — **CLOSED (UNKNOWN #2), Phase R1.1: CONFIG-ONLY, confirmed dead
  with respect to business-logic enforcement.** Full repo grep for `requireTwoReviewers`/
  `isRequireTwoReviewers`/`setRequireTwoReviewers`/`getRequireTwoReviewers` finds it fully wired
  end-to-end as UI↔API↔DB plumbing (entity field + getter/setter `DocumentWorkflowSetting.java:27,88-94`;
  bootstrap default `SettingsSeedBootstrap.java:271`; admin read/write + audit-diff logging in
  `UserManagementService.java:1199,1333,1342`; request/response DTOs
  `DocumentAdministrationRequest/Response.java`; frontend settings-screen toggle
  `useDocumentAdministration.ts:80`) — but it is **never read inside any `if`/validation call** in
  `RevisionService`, `DocumentService`, or `RevisionWorkflowAuthorizationService`. Reviewer cardinality
  is instead governed entirely by the Sub-Type's `ReviewRequirement` snapshot (explicit code comment,
  `RevisionService.java:3725-3728`: "a global toggle here could never fire without duplicating — or
  worse, contradicting — that source of truth"). Not DEAD in the sense of round-tripping through the
  UI/API/DB/audit trail, but inert with respect to actual reviewer-count enforcement.
- `authorCannotBeReviewerOrApprover` (false) — settings-gated for Author-vs-Reviewer, but
  Author-vs-Approver is **also** unconditionally enforced separately regardless of this flag (see §7)
  — redundant/overlapping rule.
- `coAuthorCannotBeReviewerOrApprover` (false) — same redundancy pattern for Co-author-vs-Approver.
- `sameUserCannotHoldMultipleWorkflowRoles` (false) — Co-author/Reviewer, Co-author/Approver,
  Reviewer/Approver overlap.
- `dcoCannotBeReviewerOrApprover` — **CLOSED (UNKNOWN #1), Phase R1.1**: `ensureNoWorkflowCoordinatorInRoles`
  (identical bodies in `RevisionService.java:3501-3509` and `DocumentService.java:3191-3204`) does
  implement this flag (exposed under a second alias getter/setter,
  `isWorkflowCoordinatorCannotBeReviewerOrApprover`, same underlying column). **"DCO"/workflow
  coordinator is resolved by permission code, not role name or an assignment field**:
  `permissionEvaluationService.hasPermission(candidate, "documents.workspace.manage")` — any account
  holding that permission, however granted (Access Profile membership, etc.), counts as coordinator
  (explicit javadoc: "the immutable workspace-management permission is the coordinator identifier,"
  not a tenant-editable role label). Forbids the coordinator from being **Reviewer or Approver only**
  (never checked against Co-author). **Enforced only at participant-assignment time** — called from
  `validateReviewerRules`/`validateApproverRules` at draft creation/participant-update/`submitForReview`
  re-validation (`RevisionService.java:950,3739,3760`) — **NOT re-checked live inside
  `completeReview`/`rejectReview`/`completeApproval`/`rejectApproval`**, all four read in full and
  confirmed to call only `require(...)` (authorization/policy) and `requirePendingParticipant`
  (assignment/sequence), never the SoD/coordinator check. So if a user's permissions change (granted
  `documents.workspace.manage` after being assigned Reviewer/Approver), the SoD violation is not
  re-detected until the participant list is next set/re-set.
- **Disabled/inactive user re-check at action time**: **CLOSED (UNKNOWN #9), Phase R1.1**. `AuthTokenFilter`
  re-resolves the `UserAccount` fresh from the DB on **every** request (not just login) and rejects
  any non-`Active` status before a `SecurityContext` is ever set — so **(A) is confirmed true: a
  disabled user cannot authenticate at all**, on any subsequent request, including the idle-reauthenticate
  path. Neither `RevisionWorkflowAuthorizationService`/`RevisionResourceAdapter` nor
  `requirePendingParticipant` independently re-check `UserAccount.status` — they trust the
  authentication-layer invariant and never re-verify it themselves (**(C) is also structurally true** —
  if the authentication gate were ever bypassed, nothing downstream would catch it). **This is a
  genuine gap, not just an academic one**: because the check happens only at authentication, a disabled
  user who was already the next-in-sequence PENDING reviewer/approver **blocks the workflow
  indefinitely** — **(D) confirmed true**. There is **no auto-reassignment/auto-skip mechanism**
  anywhere in the codebase **(E) confirmed false/absent** (full-repo search for "reassign"/"skip
  participant"/deactivation-cascade logic touching `RevisionWorkflowParticipant` returns nothing), and
  **no admin "reassign participant" endpoint exists** in `RevisionController`/`RevisionService`
  **(F) confirmed absent** — the only theoretically-adjacent recovery path (`rejectReview`/
  `rejectApproval`'s reset-all-to-PENDING) itself requires the disabled user (or another still-pending
  participant of that type) to be the one invoking it, so it does not solve the case where the disabled
  user is the sole blocker. **Net: a revision can become permanently stuck if its currently-required
  Reviewer/Approver is deactivated, with no supported unblock path short of a manual DB fix or
  reactivating the account.** This is recorded as FACT, not adjudicated as a defect-priority call (see
  §14 classification convention).

**Concurrency (Phase R1.1, closed/narrowed)**: `DocumentRevisionRecord.lockVersion` is a genuine
`@Version` column — every Revision-row UPDATE is optimistic-lock-protected, and
`GlobalExceptionHandler.handleOptimisticLock` maps a version conflict to **HTTP 409
`CONCURRENT_MODIFICATION`** (not 500) globally. **`RevisionWorkflowParticipant` has NO `@Version`
field and no narrower conditional WHERE-clause on its saves** (confirmed by full entity read) — its
row-level writes are unprotected last-writer-wins. Five concrete scenarios modeled:
- **(A) Same reviewer double-clicks Approve twice** — **PLAUSIBLE RACE on the participant row**
  (unprotected, could silently overwrite `actedAt`/comment), **partially backstopped at the revision
  level only** by `lockVersion` (whichever transaction's `revisionRepository.save(revision)` commits
  second throws `ObjectOptimisticLockingFailureException` → 409) — but this backstop does not protect
  the participant row itself.
- **(B) Approve races a concurrent Reject** — **DB-CONFLICT BACKSTOP on the revision's own status**
  (same `@Version` mechanism), but **PLAUSIBLE RACE on participant-table consistency**: `rejectReview`'s
  bulk `resetParticipantActions` (unversioned `saveAll`) could overwrite a concurrently-in-flight
  `completeReview`'s participant write with no exception raised, purely commit-order-dependent.
- **(C) Reviewer #2 acts "early" while Reviewer #1 is completing** — **PREVENTED by design**, not a DB
  accident: `requirePendingParticipant`'s sequence check and `isPendingReviewer`/`isPendingApprover`
  both re-read fresh state each time and never trust a stale "next" determination, so #2 is denied
  regardless of exact interleaving as long as #1's row is not yet committed as reviewed.
- **(D) Final Reviewer's `completeReview` races a concurrent Document Obsolete cascade** — **PREVENTED**:
  every possible `targetStatus` output of `completeReview` (`PENDING_REVIEW`/`PENDING_APPROVAL`/
  `PENDING_TRAINING`/`READY_FOR_PUBLISHING`) is itself a member of `obsoleteDocument`'s
  `requireNoRevisionInProgress` blocklist, so under READ_COMMITTED the Obsolete check will always see
  the revision as "in progress" (whichever value is currently committed) and reject the Obsolete
  attempt — the blocklist is exhaustive over this transition's codomain, not merely lucky timing.
- **(E) Final Approver's `completeApproval` races Document Obsolete** — **PREVENTED**, identical
  reasoning/citation as (D) (`completeApproval`'s codomain is likewise fully covered by the blocklist).

**Notifications**: `dispatchRevisionNotification` (called synchronously from `updateRevisionStatus`,
inside the same transaction, before commit — NOT `@Async`): SUBMIT_FOR_REVIEW→PENDING_REVIEW notifies
next reviewer (`document-review` template); →PENDING_APPROVAL notifies next approver
(`document-approval`); REVIEW_COMPLETE non-final notifies the next reviewer/approver in sequence;
REVIEW_REJECT notifies workflow coordinators.

**FACT**: `dispatchRevisionNotification`'s branch table has **no case matching actionType
`"APPROVE_REJECT"`** — `rejectApproval`'s notification call falls through with no matching template
and returns early. **No email is sent when an Approver rejects a revision.** (Reviewer rejection IS
notified via the `"REVIEW_REJECT"` branch; Approver rejection is not.)

**Classification: IMPLEMENTATION ASYMMETRY / HUMAN-DECISION CANDIDATE** (canonical wording, consistent
with §7 and §17 — not a confirmed defect absent a proven approved requirement mandating notification
on Approver Reject).

---

## 7. Approval Workflow — Deep Trace

Same `RevisionWorkflowParticipant`/sequence/all-must-act mechanism as Review (§6).

**Cardinality**: `DocumentWorkflowSetting.isRequireOneApprover()` default **true** —
`validateApproverRules` throws if `approverUserIds.size() != 1` when this flag is set. If disabled,
multiple approvers are allowed with the same sequential/all-must-approve semantics as reviewers.

**Approve — extra SoD re-check at action time (FACT)**: `completeApproval` additionally checks, if
`isReviewerNoApprove()` is true, whether the acting user already holds a REVIEWER participant row on
the SAME revision — throws `IllegalArgumentException("Reviewer cannot approve the same document")` —
i.e. this is re-verified live at the moment of approval, not only at assignment time.

**Author/Co-author vs Approver — unconditional, NOT settings-gated (FACT, important
asymmetry vs. Reviewer rule)**: `validateAuthorAndCoAuthorApprovalIndependence` unconditionally
forbids Author-as-Approver and Co-author-as-Approver, **regardless of** the
`authorCannotBeReviewerOrApprover`/`coAuthorCannotBeReviewerOrApprover` settings flags (those flags
only additionally gate the Reviewer side). So disabling those settings does NOT let an Author
approve their own revision — that prohibition is hard-coded for Approval specifically.

**Reject — see §6**: structurally identical reset-both-roles-to-DRAFT behavior. **FACT (reclassified,
Phase R1.1): no notification is dispatched for `APPROVE_REJECT`** — `dispatchRevisionNotification`'s
branch table has no matching case. Per the reconciliation instruction, this is recorded as **FACT /
IMPLEMENTATION ASYMMETRY / HUMAN-DECISION CANDIDATE**, not automatically a "confirmed defect" — no
existing approved local requirement was found in this pass explicitly mandating that Approver Reject
must notify; the asymmetry (Reviewer Reject notifies, Approver Reject does not) is real and
documented, but whether it violates an actual requirement is a question for the responsible party, not
an AS-IS conclusion.

**Department separation**: `reviewerAndApproverDifferentDepartments` (default false), enforced via
`ensureReviewerAndApproverDifferentDepartments` when reviewers are non-empty.

**Notifications on final approve**: →PENDING_TRAINING notifies stakeholders (`training-notification`);
→READY_FOR_PUBLISHING notifies workflow coordinators (`DOCUMENT_READY_FOR_PUBLISHING_NOTIFICATION`).

---

## 8. Training Workflow — Deep Trace

**Classification: (C) mostly fields/status flags with a manual single-signature attestation step —
NOT (A) a true multi-party lifecycle workflow, and NOT (B) integrated with a real Training module.**

- `requiresTraining` is a plain, manually-set boolean — **no automatic derivation** from document
  type/risk/Sub-Type was found (INFERENCE: operator-set).
- Fields: `trainingPlannedDate`, `trainingPeriodDays` (falls back to Document-level value if unset on
  the revision), `trainingPeriodEndDate` (computed as `plannedDate + trainingPeriodDays`),
  `trainingCompletionDate`, `reasonForSkippingTraining` (stored/audited as a field name but **no
  enforced rule requiring it be non-blank when `requiresTraining=false`** was found — CONFLICT with
  the analogous, enforced rule on Document Cancel's reason field from the closed Document Lifecycle
  work).
- Entry into `PENDING_TRAINING` is a branch outcome of `submitForReview`/`completeReview`/
  `completeApproval` (§4/§5), not a distinct transition method.
- **`completeTraining(UUID, RevisionWorkflowActionRequest)`** — the only method that completes
  training. Preconditions: `RevisionWorkflowAction.COMPLETE_TRAINING` authorization (permission
  `documents.revision.complete_training`, actors DCO/DOCUMENT_ADMIN — **not** the assigned reviewers
  or approvers, and **not** individual trainees); status must be `PENDING_TRAINING`; additionally
  `TrainingAuthorizationService.requireCanCompleteRevisionTraining` requires any of
  `documents.training.complete` / `documents.training.manage` / `training.material.manage`. Mandatory
  e-signature (meaning `TRAINING_CONFIRMED`). Sets planned/end/completion dates directly from the
  request (defaults completion date to today), with a sanity check that completion isn't before
  planned date.
- **No real Training-module integration found (FACT by absence)**: no `TrainingRecord`/
  `TrainingAssignment` entity, no per-trainee completion tracking, no query verifying that
  "all required learners completed training" before allowing `completeTraining` to fire. `Training
  AuthorizationService` only gates *who may operate this API call* (permission check), not *whether
  training actually happened for the required audience*. **This models training as a single
  administrative attestation (one signature, dates, done), not a genuine cross-module
  trainee-completion workflow.**
- Training completion does **not** feed the Effective Date calculation — `calculateEffectiveDate`
  uses only the publish timestamp, never any training date.
- Status after training: `READY_FOR_PUBLISHING`.
- No `@Async`/event/scheduler involvement found for training completion — synchronous, in the same
  transaction as the manual API call.

---

## 9. Ready-for-Publishing / Publishing Workflow — Deep Trace

**RESOLVED (Phase R1.1): exact statement-by-statement execution order.** The prior pass contained a
genuine internal contradiction (claiming both "PDF-then-DB" and "DB-then-PDF"). The real order,
traced end-to-end through the full call chain, is **DB cascade first, PDF composition/storage
second** — both inside one single physical transaction:

1. `PublishingWorkspaceController.publish` — permission check; `signatureTokenConsumptionService
   .requireValidWithoutConsuming(...)` (**validate only, no consumption**); creates a `PublishJob` row;
   calls `jobProcessorService.processPublishJob(...)` (`@Async`) and returns **HTTP 202** immediately
   without waiting.
2. `PublishingWorkspaceJobProcessorService.processPublishJob` (`@Async("fileProcessingExecutor")`,
   separate thread, rebuilt `SecurityContext`) — marks the job "Processing", then calls
   `publishingWorkspaceService.completePublish(...)`. **This is the actual transaction boundary
   entry point.**
3. `PublishingWorkspaceService.completePublish` (`@Transactional`) — precondition checks
   (`requireReadyRevision`, `hasRevisionSignatureMeaning("PREPARED")`, publishing-metadata/template
   resolution — all read-only/in-memory validation, no persistence yet), THEN **calls
   `revisionService.publishRevision(...)` — this happens BEFORE any PDF composition/storage call in
   this method.**
4. `RevisionService.publishRevision`/`publishRevisionRecord` (`@Transactional`, `REQUIRED` propagation
   — joins `completePublish`'s already-open transaction via the injected proxy, does not open a nested
   transaction) — runs entirely here, in order: authorization/policy check; plain (unlocked)
   `documentRepository.findById` read of the Document; `requireDocumentActiveForPublish`; **the real,
   once-only signature-token consumption** (`requireValidSignatureToken`, distinct from step 1's
   validate-only pre-check); Related-Documents/force-publish check (writes a `WARNING_OVERRIDE` audit
   entry if force-publish fires); then `publishRevisionRecord`: Revision status → `EFFECTIVE` (DB
   mutation, `revisionRepository.save`), Document status → `ACTIVE` (**unconditional** — sets
   `ACTIVE` without checking what the just-read status previously was), `PUBLISH` audit entry, the
   supersede cascade (prior Effective revisions → `OBSOLETED`, Controlled-Copy obsolescence cascade,
   `OBSOLETE` history rows), the primary revision's own `PUBLISH` history row, and finally the
   e-signature row persisted (`ElectronicSignatureService.createRevisionSignature`, meaning
   `PUBLISHED`).
5. Control returns to `completePublish`, which **only now** re-fetches the (now-EFFECTIVE) revision
   and calls `publishingPdfComposerService.composePreview(...)` — **PDF composition, confirmed to run
   after the DB cascade, not before.**
6. `fileStorageService.storeRevisionPublishedPdf(...)` — **external MinIO/filesystem write** of the
   published PDF (this is the step the doc's second, previously-contradictory claim referred to; it
   is confirmed to run after step 4's DB cascade, not before it).
7. `RevisionPublishingMetadata` updated with the PDF path/checksum/version-id (DB mutation, second
   table); `storagePdfUrl` set on the Revision row and saved (DB mutation).
8. A final `PUBLISH_TO_EFFECTIVE` audit entry is written for the composed/stored PDF itself, distinct
   from the audit entries already written inside step 4.

**Transaction-boundary consequence (FACT)**: because `completePublish` and `publishRevision` share one
physical transaction (`REQUIRED` propagation, no nesting), **everything in steps 4-7 commits or rolls
back together**. If PDF composition/storage throws (wrapped as `IllegalStateException("Failed to store
published PDF")`), the entire transaction rolls back — including the Revision→EFFECTIVE flip, the
Document→ACTIVE write, the supersede cascade, and the e-signature row that step 4 already executed
(none of it is durably committed to other readers until `completePublish` returns). The external
MinIO/filesystem write itself is **not** transactional/rollback-safe — if it succeeds but a later
step in the same transaction throws, **the physical file may remain in storage as an orphan even
though the DB transaction recording its path never committed**. This narrower, precise statement
supersedes the previous imprecise framing (see UNKNOWN #6 resolution below).

**PDF generation is real (FACT)**: template-driven via `publishingPdfComposerService.composePreview(...)`
(cover/body/header/footer, watermark, QR/barcode, e-sig block), stored via
`fileStorageService.storeRevisionPublishedPdf(...)` (returns checksum + version id — genuine
object-storage versioning).

**Publish vs. Document Obsolete shared lock — RESOLVED, was UNKNOWN #7 (Phase R1.1).**
**FACT: PUBLISH DOES NOT SHARE THE DOCUMENT PESSIMISTIC LOCK.** Grep-confirmed: the only two
`documentRepository.findByIdForUpdate(...)` call sites in `RevisionService.java` are inside
`upgradeDocumentRevision` and `upgradeRevision` (both explicitly commented as the "TBR-DOC-015"
mechanism shared with `DocumentService.obsoleteDocument`). Neither `publishRevision` nor
`publishRevisionRecord` acquire this lock or any `@Lock`/`PESSIMISTIC_WRITE` — both resolve the
Document via a plain, unlocked `requireDocument()`/`findById`. Compounding this, `publishRevisionRecord`'s
Document-status write is **unconditional** (sets `ACTIVE` without re-checking the previously-read
status), unlike `upgradeRevision`/`upgradeDocumentRevision`, which explicitly re-validate the locked/
refreshed row's status before writing.

Concrete interleaving analysis (Transaction A = Publish, Transaction B = Document Obsolete, same
Document D, Revision X starting at `READY_FOR_PUBLISHING`): under Postgres READ_COMMITTED, B's
`requireNoRevisionInProgress` check cannot see A's status changes until A commits (ordinary
read-committed visibility), so the straightforward "A running, B checks mid-flight" interleaving is
naturally blocked — B's check will still see X as `READY_FOR_PUBLISHING` (an in-progress status) for
as long as A hasn't committed, and B correctly throws. The genuinely open gap is the **reverse order**:
if B fully commits first (Document D → `OBSOLETED`, Revision X → `OBSOLETED` via B's own cascade,
since `READY_FOR_PUBLISHING` is not exempted from B's obsolete-cascade terminal-status exclusion
list), and only *afterward* does Transaction A's already-open, in-flight `publishRevision` call reach
its (earlier-read, now-stale) precondition check and its later unconditional Document-status write —
A holds no lock forcing it to re-validate Document D's status against a fresh/locked read at that
later point, unlike Upgrade's explicit `entityManager.refresh` re-check. This would produce Document D
silently reverted from `OBSOLETED` back to `ACTIVE`, with Revision X (already obsoleted by B, Controlled
Copies already cascaded) independently re-flipped to `EFFECTIVE` by A, with no corresponding
un-obsolete of the Controlled Copies.

**Classification: PLAUSIBLE RACE, not CONFIRMED.** What is source-confirmed: Publish takes no Document
lock; the Document-status write in `publishRevisionRecord` is unconditional; no re-validation against
a fresh/locked read occurs later in Publish's transaction. What remains genuinely unconfirmed (per the
instruction not to call a race CONFIRMED without proof it can actually commit): whether
`revisionWorkflowAuthorizationService.require(...)` (called early in `publishRevision`, not fully
traced for an independent Document-status re-check) or an undetected optimistic-lock (`@Version`) column
on `DocumentRecord` might independently intercept this interleaving before it commits — neither was
ruled out in this pass. A live concurrency reproduction (analogous to the existing Document-Obsolete
concurrency tests) would be needed to move this from PLAUSIBLE to CONFIRMED.

**Supersede cascade — the crux (FACT)**: inside `publishRevisionRecord`, after the new revision is set
`EFFECTIVE` and the Document forced to `ACTIVE`:
```java
List<DocumentRevisionRecord> supersededRevisions = revisionRepository
    .findAllByDocument_IdAndStatus_Code(document.getId(), "EFFECTIVE")
    .stream().filter(item -> !Objects.equals(item.getId(), revision.getId())).toList();
for (DocumentRevisionRecord supersededRevision : supersededRevisions) {
    supersededRevision.setStatus(OBSOLETED);
    supersededRevision.setObsoletedBy/At(...);
    revisionRepository.save(supersededRevision);
    controlledCopyLifecycleObsolescenceService.obsoleteControlledCopiesForRevision(
        supersededRevision, currentUser, publishedAt,
        REASON_NEW_REVISION_PUBLISHED, "...", signatureSessionId);
    recordRevisionHistory(supersededRevision, "OBSOLETE", ...);
}
```
This is the SAME canonical `ControlledCopyLifecycleObsolescenceService` introduced by the closed
Document Lifecycle work — confirmed reused here as current AS-IS truth for the Controlled-Copy cascade
(reason code `NEW_REVISION_PUBLISHED`).

**Effective Date / Valid Until**: `calculateEffectiveDate` = the publish `Instant` converted to
`LocalDate` (server clock at the moment of the async worker's execution) — NOT any pre-planned
effective date field. `calculateValidUntil` = `effectiveDate + periodicReviewCycle months` if a cycle
is configured, else a fallback value.

**Related/Correlated document dependency + force-publish override (FACT)**: `publishRevision` checks
all `RELATED`-type Document relations for an Effective revision; if any are not Effective, throws
`RelatedDocumentsNotEffectiveException` UNLESS `request.forcePublish()==true` AND the caller holds the
dedicated `documents.revision.force_publish` permission (granted to nobody by default) AND supplies a
mandatory non-blank reason (audited as `WARNING_OVERRIDE`). **However**: `PublishingWorkspaceService
.completePublish` (the actual production path) **hardcodes `forcePublish=false`** when constructing
the inner request — so this override path is unreachable from the standard async publish flow;
force-publish would require a different, not-found caller. Per the reconciliation instruction, this is
recorded as **FACT / HUMAN-DECISION CANDIDATE** (an implementation gap describing current behavior),
not automatically a "confirmed defect" — no existing approved requirement was found in this pass
mandating that force-publish be reachable from the production path.

---

## 10. Training Workflow — see §8 (kept as its own numbered section per requested structure; content
above under §8 applies).

---

## 11. Cancel/Obsolete Behavior — Revision-Level

**Cancel — LIVE WORKFLOW, DRAFT-only (FACT)**: `RevisionService.cancelRevision`, reachable via
`POST /revisions/{id}/cancel`. Explicit guard: `if (!"DRAFT".equalsIgnoreCase(currentStatus)) throw
new IllegalStateException("Only Draft revisions can be cancelled")` — a revision already in
review/approval/training/ready-for-publishing **cannot** be cancelled via this action, by deliberate
product decision per an inline code comment. Sets `CLOSED_CANCELLED`, `cancelledBy/At`, records a
genuine e-signature (`CANCELLED`), notifies Author + Co-authors, and calls
`syncDocumentStatusAfterRevisionCancellation` which can auto-close the parent Document if no
revisions remain (see §12).

`CLOSED_CANCELLED` is reachable **exactly one way** for a Revision: this manual Draft-only Cancel.

**Obsolete-of-Revision — STATUS EXISTS, NO REACHABLE STANDALONE ACTION (cascade-only) (FACT)**: the
only method setting a Revision to `OBSOLETED` besides the publish-supersede cascade (§9) is
`obsoleteRevisionAsPartOfDocumentObsolete(...)`, explicitly documented as public *only* so
`DocumentService.obsoleteDocument()` can call it. No `RevisionController` endpoint and no
`RevisionService` method named `obsoleteRevision` (standalone) exists. **Conclusion: DEAD/NO
REACHABLE STANDALONE ACTION for manual Revision Obsolete — it only ever happens as a side effect of
(a) Document Obsolete cascade, or (b) publish-supersede.**

---

## 12. Document ↔ Revision Dependencies

Cross-references confirmed by direct code inspection in both directions:

1. **First source upload → Document DRAFT→ACTIVE**: `activateDocumentAfterInitialSourceStored`
   (guard: `revision.getParentRevision()==null` — fires only for the very first, parentless
   revision).
2. **New Revision published → prior Effective revision(s) → OBSOLETED**: inline inside
   `publishRevisionRecord` (§9) — same transaction as the publish.
3. **Document Obsolete → open/non-terminal revisions → OBSOLETED**: `DocumentService.obsoleteDocument`
   loops all revisions not already `OBSOLETED`/`CLOSED_CANCELLED` and calls
   `obsoleteRevisionAsPartOfDocumentObsolete` for each — **including an `EFFECTIVE` revision**
   (explicitly not exempted, per an inline code comment).
4. **Revision in-progress → Document Obsolete denied**: `requireNoRevisionInProgress` throws
   `DocumentLifecycleConflictException("DOCUMENT_OBSOLETE_REVISION_IN_PROGRESS")`; called twice
   (before and after the PESSIMISTIC_WRITE lock) — the fix for the closed TC-DOC-051/052 race.
5. **Revision Upgrade requires Document ACTIVE**: `upgradeDocumentRevision` explicitly re-checks
   Document status against the freshly-locked entity after `findByIdForUpdate`. **`upgradeRevision`
   (the sibling entry point) does NOT re-check Document status post-lock at all** — it only
   re-validates the source Revision's `EFFECTIVE` status via `entityManager.refresh`. This is an
   **asymmetry** between the two upgrade entry points (see §17, risk #2).
6. `requireDocumentActiveForPublish` — Document-status read inside RevisionService gating Publish.
7. `DocumentService.obsoleteDocument` itself requires an `EFFECTIVE` revision to exist before
   allowing Obsolete (`DOCUMENT_OBSOLETE_NO_EFFECTIVE_REVISION`) — a Revision-status read inside
   DocumentService.

---

## 13. Revision ↔ Controlled Copy Dependencies

The canonical `ControlledCopyLifecycleObsolescenceService.obsoleteControlledCopiesForRevision(...)`
(introduced by the closed Document Lifecycle work) is confirmed as the **current, single AS-IS
mechanism** for both of the following call sites — no separate/duplicate Controlled-Copy mutation
logic was found for Revision-originated cascades:

1. **New Revision Effective → previous Effective revision's Controlled Copies**: called from
   `publishRevisionRecord`'s supersede loop with reason `NEW_REVISION_PUBLISHED`.
2. **Document Obsolete → Revision's Controlled Copies**: called from `DocumentService.obsoleteDocument`
   with reason `DOCUMENT_OBSOLETED` (per the closed Document Lifecycle work; not re-verified line-by-
   line in this pass but treated as current AS-IS truth per task instruction).
3. **Direct-canonical-op contract for `REVISION_OBSOLETED`** reason code exists (used/tested in the
   closed Document Lifecycle initiative) but, consistent with §11, has **no live third caller** — no
   manual Revision-Obsolete workflow invokes it with this reason code in production code.
4. **Request Controlled Copy eligibility → Revision EFFECTIVE**: the frontend reads a server-supplied
   `canRequestControlledCopy` boolean flag on the revision detail response (not independently
   re-derived client-side) — gating logic itself lives server-side, not traced further in this pass
   (UNKNOWN exact enforcement method name for this specific eligibility check).
5. **Revision Cancel** (DRAFT-only) has **no** Controlled-Copy interaction found — a DRAFT revision
   cannot have Controlled Copies yet (Controlled Copies are created against Effective/Distributed-
   stage revisions), so this is consistent by construction, not a gap.

---

## 14. Authorization / Capabilities

**Architecture (FACT)**: `RevisionWorkflowAuthorizationService` is **not** a standalone decision tree
— it supplies facts (assignment/state) to `RevisionResourceAdapter`, which is the actual caller of
`AuthorizationEngineService.authorize(...)` (the hybrid permission engine). Permission codes are
**DB-driven** via `workflow_action_policies` (module `DOCUMENT_CONTROL`, workflow key
`DOCUMENT_REVISION`), not a static Java map — resolved per-action/per-state/per-document-type at
runtime.

**Permission codes actually enforced per action** (current, per migrations up to `V345`):

| Action | Permission | Actor rule |
|---|---|---|
| COMPLETE_AUTHORING | `documents.revision.complete_authoring` | Author |
| OPEN_PUBLISHING_WORKSPACE | `documents.workspace.manage` (changed by V290 from an earlier code) | DCO/DOCUMENT_CONTROLLER access-profile |
| SUBMIT_FOR_REVIEW | `documents.workspace.manage` (changed by V290 from `documents.revision.submit_review`) | DCO/DOCUMENT_CONTROLLER access-profile |
| GENERATE/REGENERATE_REVIEW_SNAPSHOT | `documents.revision.submit_review` (changed by V208 from `documents.revision.generate_preview`) | Author |
| COMPLETE_REVIEW | `documents.revision.review` | assigned (sequence-next) reviewer |
| REJECT_REVIEW | `documents.revision.reject_review` | assigned reviewer |
| COMPLETE_APPROVAL | `documents.revision.approve` | assigned approver |
| REJECT_APPROVAL | `documents.revision.reject_approval` | assigned approver |
| COMPLETE_TRAINING | `documents.revision.complete_training` | DCO/DOCUMENT_ADMIN |
| PUBLISH | `documents.revision.publish` | DCO/DOCUMENT_ADMIN |
| CANCEL | `documents.revision.cancel` | DCO/DOCUMENT_ADMIN — **RESOLVED (Phase R1.1): active DB policy is already DRAFT-only, no live mismatch** (see below) |
| UPGRADE_REVISION | `documents.revision.upgrade` | DCO/DOCUMENT_ADMIN |
| Force-publish override | `documents.revision.force_publish` (dedicated, default: granted to nobody) | checked directly in `RevisionService`, bypassing the engine |

**RESOLVED (Phase R1.1) — Cancel policy/capability/service, was flagged as a CONFLICT: no live
mismatch exists.** Two generations of migrations exist: `V159__seed_workflow_action_policies.sql`
originally seeded CANCEL for five `from_status` values (DRAFT + the four in-progress states), but
`V273__harden_cancel_and_obsolete_revision_lifecycle.sql` explicitly **deactivates** (`active = FALSE`)
that broader row and inserts a single new **active** row with `from_status = 'DRAFT'` only (comment:
"Cancel is a Draft-only disposition, never a substitute for Reject"). The broader V159 row still
physically exists in the table but is retained only for audit-history/traceability, never evaluated.

Tracing all four layers for a Revision in `PENDING_REVIEW`:
- **DB policy (active row)**: DRAFT only.
- **Authorization layer**: `RevisionWorkflowAuthorizationService.validateWorkflowState`'s CANCEL case
  is a **hardcoded** Java switch (`if (!isDraft) yield stateError(...)`) — it does not even read the
  DB `from_status` column; it would enforce DRAFT-only even if the deactivated V159 rows were ever
  reactivated by mistake.
- **Capability endpoint**: `RevisionActionCapabilityService`'s `"cancel"` computation calls the
  **identical** `check()` → `authorizationEngineService.authorize()` → `RevisionResourceAdapter
  .checkPrecondition()` → `validateWorkflowState()` path as the real mutating action — not a separate/
  simplified check. For `PENDING_REVIEW`, this returns `canCancel = false`
  (`INVALID_WORKFLOW_STATE`).
- **Service layer**: `cancelRevision`'s own redundant guard (`IllegalStateException("Only Draft
  revisions can be cancelled")`) would in practice never even be reached for `PENDING_REVIEW`, because
  `require(...)` (calling the same authorization check above) throws first
  (`WorkflowAuthorizationDeniedException`, `INVALID_WORKFLOW_STATE`).

**Classification: "policy metadata mismatch only."** The stale/deactivated V159 rows are retained
purely for audit history and are never evaluated; the active DB policy, the hardcoded authorization
check, the capability endpoint, and the service guard all consistently agree on DRAFT-only. There is
**no live, user-visible inconsistency** — the prior pass's finding was based on the original V159 seed
without accounting for the later V273 hardening migration that superseded it.

**Assignment-based rule refinement (FACT, "F-06")**: `isPendingReviewer`/`isPendingApprover` require
the user be the **first PENDING participant in sequence order**, not merely "a participant of that
type." An inline code comment documents this as a **fix for a previously-real capability/enforcement
mismatch** (Reviewer #2 saw the action enabled by the capability API but was rejected at submit time
by the sequence check) — i.e. a confirmed historical bug, now fixed.

**State-check duplication with divergent outcomes (FACT, "F-07"-adjacent, see §20)**: the same
state precondition is checked in TWO places — the authorization layer (`validateWorkflowState` →
`INVALID_WORKFLOW_STATE` → 403) and the service layer (`requireRevisionStatus` →
`IllegalStateException` → 500). Under normal operation the authorization layer's check fires first
(since `require(...)` is always called before the service-layer redundant check), so the 500 path
is rarely hit in practice — but it remains reachable in edge cases/races.

**Capability endpoint**: `GET /revisions/{id}/action-capabilities` →
`RevisionActionCapabilityService`, a **dedicated Revision-specific capability contract**, separate
from the generic `securityApi.getResourceCapabilities("DOCUMENT_MASTER", ...)` used by the Document
Master UI. Per an inline comment ("F-07"), this was refactored specifically to read the required
permission code **live** from the same DB policy row used for enforcement, closing a previously-real
drift bug (V290 changed the DB policy but a hardcoded Java capability switch wasn't updated in sync).
Four capability keys (`saveWorkspace`, `batchSaveSubmit`, `addWorkingNote`, `deleteWorkingNote`) have
**no** corresponding `RevisionWorkflowAction`/policy row — they reuse ad hoc checks
(`documentAuthorizationService.canEditDraftRevision`, etc.), a deliberate but policy-bypassing
gap-fill.

**No dedicated `securityApi.getResourceCapabilities("REVISION"/"DOCUMENT_REVISION", ...)` call was
found anywhere in the frontend** — the string `"DOCUMENT_REVISION"` appears only as a TypeScript union
member for the Security-Admin diagnostic tool (`EffectiveAccessPanel`), unrelated to the runtime
capability-fetch path.

---

## 15. Electronic Signatures

| Action | Required? | Meaning | Token consumption vs. mutation order |
|---|---|---|---|
| completeEditing | yes | `PREPARED` | consume → mutate |
| submitForReview | yes (also requires a **prior** `PREPARED` signature to already exist) | `SUBMITTED_FOR_REVIEW` | consume → mutate |
| completeReview | yes | `REVIEWED` | consume → mutate |
| rejectReview | yes | `REJECTED` | consume → mutate |
| completeApproval | yes | `APPROVED` | consume → mutate |
| rejectApproval | yes | `REJECTED` | consume → mutate |
| completeTraining | yes | `TRAINING_CONFIRMED` | consume → mutate |
| publish | yes | `PUBLISHED` | consume **before** mutation, but signature **persistence** happens **after** the DB status mutation (opposite ordering from review/approval actions) |
| cancel | yes (**mandatory reason** too) | `CANCELLED` | consume before mutation, but signature **persistence** happens after `save`/history — code comment explicitly acknowledges this was a fix ("the signature TOKEN is validated above ... but that alone never persisted an e-signature row") |
| upgradeRevision / upgradeDocumentRevision | **NO signature call found anywhere** | n/a | **gap** — no `requireValidSignatureToken` in either upgrade method |

**Replay protection — confirmed SAME shared mechanism as Document Cancel/Obsolete (FACT)**:
`RevisionService` holds a `signatureTokenConsumptionService` field and calls
`signatureTokenConsumptionService.requireAndConsume(...)` — the shared `UsedSignatureToken`/
`used_signature_tokens` mechanism (introduced by the closed Document Lifecycle initiative,
`V393__create_used_signature_tokens.sql`) has been retrofitted onto Revision actions too; its own
javadoc explicitly states it replaced separate ad hoc copies previously in DocumentService,
RevisionService, ControlledCopyService, and ElectronicSignatureService, none of which had actually
recorded token usage before.

**Double-validation is intentional and safe (FACT)**: `recordElectronicSignature` re-passes the raw
signature token to `ElectronicSignatureService.createRevisionSignature`, which independently
re-validates it — the consumption service's javadoc documents this as deliberately idempotent
per-transaction (tracked via `TransactionSynchronizationManager`), not a double-spend risk.

**Upgrade has no e-signature at all — FACT / HUMAN-DECISION CANDIDATE (reclassified, Phase R1.1)**:
unlike every other lifecycle-mutating Revision action, creating a new Draft revision from an Effective
one requires neither a signature token nor a persisted signature record. Retained as the accurate
implementation FACT; per the reconciliation instruction this is not automatically labeled a "confirmed
defect" since AS-IS describes implementation truth, not a normative GMP conclusion — no existing
approved local requirement was found in this pass explicitly mandating an e-signature for Upgrade.

---

## 16. Audit Trail

Every observed transition produces at least one distinct audit entry, via either a direct
`auditTrailService.logAs(...)` call or the shared `recordRevisionHistory(...)` helper (which writes a
`RevisionWorkflowHistory` row AND then calls `logAs` itself):

- SUBMIT_FOR_REVIEW: `REVIEW_PACKAGE_GENERATED` + `SUBMIT_FOR_REVIEW`.
- COMPLETE_REVIEW → `REVIEW_COMPLETE`; REJECT_REVIEW → `SOURCE_UNLOCKED` + `REVIEW_REJECT`.
- COMPLETE_APPROVAL → `APPROVE_COMPLETE`; REJECT_APPROVAL → `SOURCE_UNLOCKED` + `APPROVE_REJECT`.
- PUBLISH: Document-level `PUBLISH` audit + revision-level history `PUBLISH` + conditional
  `WARNING_OVERRIDE` (force-publish) + per-superseded-revision `OBSOLETE`.
- CANCEL: `CANCEL` — **but produced ONLY via the `recordRevisionHistory` helper, with no direct
  `auditTrailService.logAs` call visible at the cancel call site itself** (flagged for completeness —
  functionally the row still lands, but the call-site pattern is inconsistent with every other action).
- UPGRADE: `UPGRADE` — logged via **both** the helper AND a separate direct `logAs` call in the same
  method (double-logged with the same actionType) — inconsistent vs. Cancel's single-path pattern;
  not a functional gap but a code-consistency oddity worth noting.
- Denied workflow actions: `WORKFLOW_ACCESS_DENIED` via `RevisionWorkflowAuthorizationService
  .logDeniedAudit`.

**No transition was found to produce zero audit entries** in this pass.

---

## 16a. Revision Numbering — Complete AS-IS Model (Phase R1.1, closes UNKNOWN #3)

**`incrementVersion(String)` — CONFIRMED DEAD.** Full backend+test grep for `incrementVersion(` finds
zero call sites anywhere outside its own declaration (`RevisionService.java:5371-5386`) — not even in
test code. It is a generic "increment last dotted segment" helper, superseded by the `A.0.B`-format-
aware `incrementPatchVersion`.

**`incrementPatchVersion`** (`RevisionService.java:5396-5403`): parses `major` (index 0) and `patch`
(index 2) of the normalized `A.0.B` version, always forces the middle segment to `0`, increments patch
by 1 — `"%d.0.%d"`.

**`resolveNextDraftRevisionNumber(UUID documentId)`** (L5152-5161) — used by
`createRevisionAndUploadFile` and by the by-**ID** upgrade entry point `upgradeRevision`: loads **ALL**
revisions ever created for the document (no status filter — includes CANCELLED/OBSOLETED/DRAFT/
EFFECTIVE), normalizes each, takes the **max** by (major, patch), then `incrementPatchVersion`s that
max. Empty history → defaults to `"0.0.1"` (**confirmed: the first Revision of a new Document is
always `0.0.1`**).

**`resolveNextDraftRevisionNumberFromEffective(String effectiveRevisionNumber)`** (L5163-5168) — used
by the by-**Document**/source-revision-object upgrade entry point `upgradeDocumentRevision`: does
**not** query the repository at all — derives the next number purely from the single source Effective
revision's own number string (parse major/patch, increment patch by 1). No scan of history.

**Confirmed exactly as hypothesized**: these are two genuinely different algorithms that usually agree
but are **not provably equivalent** — e.g. if a later cancelled/obsoleted revision happens to have a
higher patch number than the current Effective revision, `resolveNextDraftRevisionNumber` would jump
higher than `resolveNextDraftRevisionNumberFromEffective` would, for the same document, depending only
on which Upgrade entry point is invoked.

**Numbering across reject/resubmit cycles**: `rejectReview`/`rejectApproval` never touch
`revisionNumber`/`revisionName` — the same Draft revision row keeps the same number through as many
review→reject→resubmit cycles as needed; resubmission just re-runs `submitForReview` on the same
entity.

**Numbering when a Revision is cancelled**: the DB unique index
`ux_document_revisions_document_revision_number` (`V73`) is a **plain (non-partial) unique index** —
no status predicate (unlike its sibling `ux_document_revisions_one_in_progress`, which is
partial/status-filtered). Because a cancelled revision row is never deleted and the index has no
status filter, **a cancelled revision's number is permanently retired for that document — it can
never be reused.** This is also why `resolveNextDraftRevisionNumber` deliberately includes cancelled/
obsoleted revisions in its max-scan.

**Concurrent numbering collision — CLOSED (Phase R1.1b).** No `try/catch` around the relevant `save()`
calls in `createRevisionAndUploadFile`/`upgradeRevision`/`upgradeDocumentRevision` translates a
unique-index violation into a Revision-specific exception, but this is **not a gap**: the single
`@RestControllerAdvice` in the backend, `GlobalExceptionHandler.java:213-222`
(`handleDataIntegrity`), handles `DataIntegrityViolationException` **generically** for the whole
application (there are no other `@ControllerAdvice` classes — confirmed by full-repo grep). A real
collision on `ux_document_revisions_document_revision_number` propagates uncaught by any
Revision-specific code, reaches this handler, and produces **HTTP 409 CONFLICT**, code
`DATA_INTEGRITY_ERROR`. The message-resolution helper (`resolveDataIntegrityMessage`, L322-333)
special-cases only two other constraint names (`uq_document_workflow_participant`,
`uq_document_relation`); the revision-number constraint isn't among them, so the response falls
through to the generic safe string `"Unable to save data because it violates database constraints"` —
**no raw SQL/constraint-name leakage**, but also **no revision-numbering-specific guidance** (contrast
with the more informative `ObjectOptimisticLockingFailureException` handler, which explicitly tells the
client to "reload and try again"). Net: safe and generic (409, no leak), but uninformative for this
specific collision type — recorded as FACT, not an open UNKNOWN.

---

## 16b. Upgrade Entry-Point Reachability — RESOLVED (Phase R1.1, closes UNKNOWN #4)

Full call-chain trace (backend + frontend) for both service methods:

- **`upgradeRevision` (`RevisionService.java:1486`)** ← `POST /revisions/{id}/upgrade`
  (`RevisionController.java:247`) — **no frontend caller targets this route at all**; no function in
  `documents.ts` builds a URL of this form. This method is, however, **also** reached indirectly via
  `RevisionWorkspaceBatchService.java:404` (`revisionService.upgradeRevision(item.sourceRevisionId())`),
  wired to the batch-save/batch-submit workspace endpoints (`RevisionController.java:266-279`) — a
  real, separate, structurally live route (frontend usage of that specific batch flow was not
  re-verified in this pass).
- **`upgradeDocumentRevision` (`RevisionService.java:1410`)** ← `POST /documents/{id}/upgrade-revision`
  (`DocumentController.java:133-136`) — frontend function `documentApi.upgradeDocumentRevision`
  exists (`documents.ts:582`) but **is called from zero components** anywhere in `eqms/src` (confirmed
  by full-repo grep, matches only at the function's own definition site).
- **The "Revision Upgrade Session" trio** (`createRevisionUpgradeSession`/`getRevisionUpgradeSession`/
  `continueRevisionUpgradeSession`, backed by `DocumentController.createUpgradeSession/getUpgradeSession/
  continueUpgradeSession` → `RevisionUpgradeSessionService`, which itself calls
  `revisionService.upgradeDocumentRevision(documentId, sessionId)` internally at
  `RevisionUpgradeSessionService.java:193,195`) — **confirmed dead on the frontend**: each
  `documentApi.*` function is defined in `documents.ts` but has zero call sites anywhere else in
  `eqms/src`. This is not a "missed in a prior pass" situation — a full-repository grep for each exact
  function name returns matches only at the definition site. **Note**: the JSDoc comment directly above
  `createRevisionUpgradeSession` (`documents.ts:1160`) is itself stale/incorrect — it claims the
  function calls `POST /revisions/:revisionId/upgrade`, but it actually calls
  `POST /documents/{id}/upgrade-sessions`; this stale comment could mislead a future reader into
  believing the direct `/revisions/{id}/upgrade` route has frontend coverage when it does not.
- The only live UI surface touching "upgrade" semantics today is (a) an audit-trail label formatter
  (`DetailRevisionView.tsx:145`, renders a friendly string for a history record whose action type
  contains "upgrade") and (b) capability/permission plumbing
  (`revisionActionCapabilities.ts`/`RevisionActionCapabilityService.java:88`) that could gate a button
  — but no handler wired to that capability actually calls any of the dead API functions above.

**Conclusion**: confirms and sharpens the prior finding — `upgradeDocumentRevision` and the entire
upgrade-session trio are dead frontend surfaces; `upgradeRevision` (the direct `/revisions/{id}/upgrade`
route) is also frontend-dead but has a real, separate backend caller via the workspace batch flow. The
actual "Upgrade" UX in production is the simpler in-place edit-mode toggle already documented in §19,
gated by unrelated Document Master capability flags rather than any of these backend upgrade methods'
own capability.

---

## 17. Notifications / Events

Two distinct dispatch code paths, both **synchronous** (no `@Async` found on
`EmailNotificationService.sendDocumentWorkflowNotification`/`sendToRecipients`), both firing **inside**
the transaction (before commit, since Spring commits after the enclosing `@Transactional` method
returns):

1. **`dispatchRevisionNotification`** — called from inside `updateRevisionStatus`, routes by
   `(actionType, targetStatus)` to next-reviewer/next-approver/stakeholders/workflow-coordinators, per
   the mapping table already given in §6/§7. **FACT: no branch exists for `APPROVE_REJECT`** — no
   notification is sent on Approval rejection. Classification: IMPLEMENTATION ASYMMETRY /
   HUMAN-DECISION CANDIDATE (see §6/§7 — not a confirmed defect).
2. **Dedicated handover notifications** via `sendRevisionHandoverNotification`:
   - `notifyDcoRevisionReadyForSubmission` — fired from `completeEditing`, recipients resolved live
     from the SUBMIT_FOR_REVIEW policy's actors (DCO/DOCUMENT_CONTROLLER access-profile holders).
   - `notifyAuthorRevisionCancelled` — fired from `cancelRevision`, notifies Author + all Co-authors,
     carrying the mandatory cancel reason.
3. `notifyRevisionEditParticipants` — a separate helper for Office-Online-editing-lifecycle
   notifications (not a core workflow transition).

**RESOLVED (Phase R1.1, closes UNKNOWN #5) — corrects the prior pass's assumption.** All four Revision
notification call sites (`dispatchRevisionNotification`, `notifyDcoRevisionReadyForSubmission`,
`notifyAuthorRevisionCancelled`, `notifyRevisionEditParticipants`) funnel into the **same shared**
`EmailNotificationService.sendDocumentWorkflowNotification` → `sendToRecipients` →
`sendTemplateEmailWithRetry` → `recordDeliveryFailure` pipeline used by other domains (Controlled
Copy, preferences, etc.) — **not** a bespoke or absent Revision-only path as previously assumed.
Specifically: `sendTemplateEmailWithRetry` retries the send up to 3 times with backoff; only after all
3 attempts fail does `sendToRecipients`'s catch/if-block call `recordDeliveryFailure`, which persists a
`NotificationDeliveryFailure` row (recipient, notificationType, eventDomain, sanitized error/payload).
**The exception never propagates back to `RevisionService`** — it is fully absorbed inside
`sendToRecipients`, so a notification failure can never roll back the enclosing workflow transaction.

**Dispatch timing, verified independently (not assumed identical to the Document Obsolete fix)**: all
four Revision call sites dispatch **synchronously, inside the enclosing `@Transactional` method,
before commit** — no `@Async`, no `@TransactionalEventListener`, no
`TransactionSynchronizationManager.registerSynchronization` wraps any of them or their shared helpers.
This is a **distinct** finding from an after-commit pattern: Revision notifications are
**synchronous-but-tracked** (retry + durable-failure-record safety net), not deferred-until-commit —
this nuance should not be conflated with the previously-fixed Document Obsolete after-commit pattern,
which is a different mechanism entirely.

---

## 18. File/Publishing/Storage Interactions

- **Source file** (pre-publish, DOCX): stored via `FileStorageService`, with checksum + object-storage
  version id tracked on the revision (`sourceFileChecksum`, `sourceStorageVersionId`).
- **Office Online collaboration**: SharePoint-style site/drive/item ids, edit/view URLs + permission
  ids, sync status/timestamp — consistent with Microsoft Graph integration.
- **Published PDF**: template-driven composition (`publishingPdfComposerService.composePreview`),
  stored via `fileStorageService.storeRevisionPublishedPdf`, checksum + version id captured into
  `RevisionPublishingMetadata`, and `storagePdfUrl` persisted on the revision.
- **Snapshot pipeline**: `snapshotStatus`/`snapshotError`/`snapshotRequestId`/`snapshotSourceChecksum`
  fields track an async preview/PDF-snapshot job, request-id/checksum-tagged for idempotency —
  consistent with the async job architecture in §9.
- **DB/PDF-storage ordering — FACT, fully known (corrected, was previously stated as unresolved)**:
  the exact execution order is confirmed in §9 — DB lifecycle cascade (status→EFFECTIVE, supersede,
  Controlled-Copy obsolescence, e-signature) → PDF composition → external PDF storage → publishing
  metadata persistence, all inside **one physical Spring transaction** (`completePublish`/
  `publishRevision` share one transaction via `REQUIRED` propagation). The ordering itself is not
  UNKNOWN. **UNKNOWN, narrow and genuinely unresolvable by source reading**: whether a successfully-
  written external MinIO/filesystem object (from the PDF-storage step) survives as an orphan if a
  later DB operation in the same transaction throws and the transaction rolls back — this requires a
  live fault-injection test or infrastructure-level inspection, not further code reading (see §9, §30).
  No storage compensation/staging redesign is proposed here (out of scope).

---

## 19. Frontend Behavior

**Views**:
- `DetailRevisionView.tsx` — read-only workflow summary; tabs General/WorkingNotes/InfoFromDocument/
  Training/Reviewers/Approvers/Document/Signatures/Audit + a non-interactive Document-Master sub-tab.
  Buttons: Back, Cancel (`revisionActionCapabilities.can("cancel")`), "Open Publishing Template"
  (`isReadyForPublishing && (can("openPublishingWorkspace")||can("publish"))`), Request Controlled
  Copy (server-supplied flag). **Publish itself is NOT triggered from this view** — despite an
  `ESignatureModal` wired for meaning `PUBLISHED` existing in the file, no code path sets
  `showESignModal(true)` here (CONFLICT/gap: dead trigger in this specific file; Publish is actually
  initiated from the separate Publishing Workspace navigated to via "Open Publishing Template").
- `RevisionCreateView.tsx` — the authoring workspace: Complete Editing, Submit for Review.
- `RevisionReviewView.tsx` — Reviewer Approve/Reject, both behind `ESignatureModal` (Reject preceded
  by an `AlertModal` warning).
- `RevisionApprovalView.tsx` — Approver Approve/Reject, same pattern, plus an "open comments" warning
  gate on Approve.
- `DocumentRevisionsTab.tsx` (under Document Detail) — revision history table; row click routes to
  either the authoring workspace (`canOpenAuthoringWorkspace`) or the read-only detail view.
- `UploadRevisionModal.tsx` — pure presentational; delegates the actual create/upload API call to its
  parent; client-side validates `.docx` extension only (not true MIME sniffing) and a 25MB default
  max size.

**Capability fetching**: Revision actions use a **dedicated** `documentApi.getRevisionActionCapabilities
(revisionId)` endpoint via the `useRevisionActionCapabilities` hook — entirely separate from
`securityApi.getResourceCapabilities("DOCUMENT_MASTER", ...)` used by the Document Master UI. Code
comments explicitly state: *"The server capability is the workflow authority. Do not add a stale
detail-payload flag as a second gate after navigation/preloading."*

**Upgrade UI (CONFLICT/gap, important)**: the visible "Edit Revision for Upgrade" button
(`DetailDocumentView.tsx`) is gated by generic `DOCUMENT_MASTER` capability flags (reviewer/approver/
related/correlated/review-cycle configure permissions), **not** any Revision-specific
`upgradeRevision` capability. Clicking it makes **no API call** — it only flips a local
`isEditModeActive` flag unlocking in-place edit fields, followed by a separate `Save` action. Meanwhile
a fuller, formally-named "Revision Upgrade Session" API surface
(`createRevisionUpgradeSession`/`continueRevisionUpgradeSession`/`getRevisionUpgradeSession`,
`RevisionUpgradeSessionResponse`/`RevisionUpgradeImpactItemResponse` types) exists in `documents.ts`
but **is called from zero React components** — a confirmed DEAD/UNREACHABLE frontend API surface for
a formally-modeled workflow that the backend supports (`RevisionUpgradeSessionService` — inferred from
DTO/table names) but the UI does not actually use.

**Polling/SSE**: Document Master has a 10-second capability poll + realtime subscription
(`"revision-workflow-updated"` events) in `DetailDocumentView.tsx`. `RevisionCreateView.tsx` has an
analogous 10-second poll + realtime subscription + `visibilitychange` re-check, but **only while the
authoring workspace is editable** — this poll is **absent** from `DetailRevisionView.tsx`,
`RevisionReviewView.tsx`, and `RevisionApprovalView.tsx`.

**CONFIRMED DEFECT / GAP — stale-state (403/409/410) recovery is Document-Master-only**: the
`[403,409,410]` → `getHttpStatus`/`refreshLifecycleState` pattern (tagged `TBR-DOC-018` in code
comments) exists **only** in `DetailDocumentView.tsx` for Document Cancel/Obsolete. A repo-wide search
(`grep -rn "403|409|410" src/features/documents/document-revisions`) returns **zero matches** — every
Revision workflow action (`submitRevisionForReview`, `completeRevisionEditing`,
`completeRevisionReview`/`rejectRevisionReview`, `completeRevisionApproval`/`rejectRevisionApproval`,
`publishRevision`, `cancelRevision`) catches errors generically and shows a toast with no
status-code branching or forced capability/detail resync. **The Document Lifecycle initiative's
stale-state resilience pattern was never extended to the Revision lifecycle.**

---

## 20. Error Semantics

| Exception type | HTTP | Code | Used for (Revision context) |
|---|---|---|---|
| `WorkflowAuthorizationDeniedException` | 403 | `WORKFLOW_ACCESS_DENIED` | authorization-layer state/permission denial (fixed in a past remediation pass — comment confirms it previously fell through to a generic 500). |
| `AccessDeniedException`/`AuthorizationDeniedException` | 403 | `FORBIDDEN` | general access denial. |
| `DocumentLifecycleConflictException` | 409 | (specific codes) | **Document**-level Cancel/Obsolete only — **not used for any Revision conflict**. |
| **`IllegalStateException`** (fallback path only, see below) | **500** | **`INTERNAL_ERROR`**, `log.error`-logged | Service-layer redundant checks: `requireRevisionStatus` (wrong-status on any action), `cancelRevision`'s non-DRAFT guard, `requirePendingParticipant`'s already-completed/out-of-sequence guards, `submitForReview`'s "editing must be completed" guard. |
| `IllegalArgumentException` | 400 | `BAD_REQUEST` | missing signature token, missing cancel reason, force-publish permission/reason, reviewer-cannot-approve-own-doc. |
| `UnauthorizedException` (via `SignatureTokenConsumptionService`) | (separate handler, not fully re-verified this pass) | — | invalid/expired/already-used/wrong-owner signature token. |

**Corrected, precise error-semantics finding (Phase R1.1b — supersedes the prior "every...surfaces
HTTP 500" wording)**: every action method (`completeReview`, `completeApproval`, `cancelRevision`,
etc.) calls `revisionWorkflowAuthorizationService.require(...)` **before** its own redundant
service-layer state guard (`requireRevisionStatus`/`requirePendingParticipant`/etc.). This produces two
distinct, non-overlapping reachability paths:

- **(A) Normal controller/service user request path**: for a wrong-state action attempted through the
  ordinary API (e.g., trying to approve a revision that isn't `PENDING_APPROVAL`), the authorization
  layer's `validateWorkflowState` precondition check runs first and rejects with
  `WorkflowAuthorizationDeniedException` → **HTTP 403 `WORKFLOW_ACCESS_DENIED`**. This is the actual,
  reachable outcome for the overwhelming majority of real wrong-state user requests.
- **(B) Service-layer fallback/direct-call/race path**: the redundant `IllegalStateException`-throwing
  guards inside `RevisionService` (`requireRevisionStatus`, `requirePendingParticipant`, etc.) are only
  reached when the authorization-layer check is bypassed, stricter/looser in a way that lets a call
  through inconsistently, or in a genuine race window (e.g., state changes between the authorization
  check and the service-layer re-check within the same request, or a caller that invokes the service
  method directly without going through the authorization gate). When reached, this path surfaces
  **HTTP 500 `INTERNAL_ERROR`**, logged as a server error, instead of a stable 4xx conflict code.

**Do not state that every normal wrong-state user request returns 500 — it does not; §A is the
common-case outcome.** The real, precisely-scoped risk is that path (B) exists at all as an
inconsistent fallback: it is a real error-contract gap (a genuine wrong-state rejection reachable only
in edge cases/races surfaces as an opaque 500 instead of a 409-style conflict), but it is **not** the
primary/normal-path behavior. Severity recalculated in §29 accordingly — reduced from "every request"
framing to "edge-case/race-reachable fallback path."

---

## 21. Hidden Implementation Rules

1. `RevisionStatusDefinition`'s fixed-state-set invariant is enforced by convention/code comment only
   — no DB trigger prevents an Admin CRUD screen from mutating it (§2).
2. `submitForReview` requires a pre-existing `PREPARED` signature (from a prior `completeEditing`
   call) as an implicit precondition, not just the current-transition signature (§6/§15).
3. Rejection (review OR approval) resets **both** reviewer and approver participant rounds
   simultaneously, even though only one role's decision was rejected (§6/§7).
4. `reviewerNoApprove` is re-checked LIVE at approval time in addition to assignment-time validation
   (§7) — a genuine runtime re-verification, not just a one-time gate.
5. Author/Co-author-cannot-be-Approver is unconditionally enforced regardless of the corresponding
   settings flags, unlike the equivalent Reviewer-side rule which IS settings-gated (§7) — an
   intentional asymmetry, not a bug per se, but easy to misread the settings UI as controlling both.
6. `upgradeRevision` and `upgradeDocumentRevision` use **two different algorithms** to compute the
   next Draft revision number (§9/§13/§17) — one scans all sibling revisions' historical max
   (including cancelled/obsoleted), the other derives purely from the source Effective revision's own
   number.
7. `PublishingWorkspaceService.completePublish` hardcodes `forcePublish=false`, silently disabling the
   force-publish-over-non-effective-related-documents override from the only production-reachable
   Publish path (§9/§5 R-WF-20).
8. **HISTORICAL / SUPERSEDED BY V273 — not a current AS-IS rule, retained only for historical
   context.** The original `V159` seed listed a broader CANCEL `from_status` set (DRAFT + four
   in-progress states); `V273__harden_cancel_and_obsolete_revision_lifecycle.sql` deactivated those
   rows and inserted a single active DRAFT-only row. The active DB policy, the authorization layer, the
   capability endpoint, and the service guard are all DRAFT-only today, with **no live mismatch** (§14).
   The deactivated V159 rows exist in the table only for audit-history traceability and are never
   evaluated — not counted as a current AS-IS risk or mismatch.

---

## 22. Dead/Unreachable/Legacy Paths

1. **Standalone manual Revision Obsolete** — status exists, cascade helper exists, no reachable
   controller endpoint (§5 R-WF-16, §11).
2. **Force-publish override in the production async publish path** — permission and logic exist but
   are unreachable because the caller hardcodes `forcePublish=false` (§9, §21.7).
3. **Revision Upgrade Session frontend API surface** (`createRevisionUpgradeSession`,
   `continueRevisionUpgradeSession`, `getRevisionUpgradeSession`, and the `upgradeRevision` capability
   key) — defined in `documents.ts` and the capability-key enum, called from **zero** React components
   (§19). The actual "Upgrade" UX is a simpler in-place edit-mode toggle gated by unrelated Document
   Master capability flags.
4. **`incrementVersion(String)`** — **CONFIRMED DEAD (Phase R1.1)**: full backend+test grep for
   `incrementVersion(` finds zero callers anywhere outside its own declaration
   (`RevisionService.java:5371`); superseded by `incrementPatchVersion` (§16a).
5. **`requireTwoReviewers`** setting flag — **CONFIRMED CONFIG-ONLY (Phase R1.1)**, not dead in the
   UI/API/DB-plumbing sense (fully wired end-to-end including audit-diff logging) but never consulted
   in any business-logic `if`/validation call; reviewer cardinality is governed solely by the Sub-Type's
   `ReviewRequirement` snapshot (§6).
6. **`POST /revisions/{id}/upgrade` (direct route)** — **CONFIRMED frontend-dead (Phase R1.1)**: no
   frontend function targets this route; the service method (`upgradeRevision`) is reached in
   production only via the separate workspace batch-save/batch-submit flow (§16b).
7. **`upgradeDocumentRevision` + the entire "Revision Upgrade Session" trio** —
   **CONFIRMED frontend-dead (Phase R1.1)**: zero call sites anywhere in `eqms/src` outside their own
   definitions in `documents.ts`; a stale JSDoc comment on `createRevisionUpgradeSession` incorrectly
   claims it hits the `/revisions/{id}/upgrade` route, which could mislead future readers (§16b).

---

## 23. Transactions / Concurrency

| Transition | `@Transactional`? | Lock/version | Fresh-read guarantee | Async? |
|---|---|---|---|---|
| submitForReview / completeReview / rejectReview / completeApproval / rejectApproval / completeTraining / cancel | yes | `@Version` (`lockVersion`) on `DocumentRevisionRecord`; **confirmed NO `@Version` on `RevisionWorkflowParticipant`** (full entity read, Phase R1.1) | default READ_COMMITTED, no explicit refresh | no |
| publish (`publishRevision` / `completePublish`) | yes (one physical transaction, `REQUIRED` propagation nests `publishRevision` into `completePublish`'s tx — confirmed Phase R1.1) | **confirmed NO pessimistic lock** on the Document row, but `DocumentRecord` DOES carry `@Version lockVersion` (`DocumentRecord.java:34-36`, confirmed Phase R1.1b) — this optimistic-lock column IS checked at flush/commit against the live DB row regardless of in-transaction read staleness, providing a genuine (if incidental) DB-CONFLICT BACKSTOP against Publish silently overwriting a concurrently-Obsoleted Document (§9) | n/a | **yes** — controller enqueues a job; `@Async("fileProcessingExecutor")` worker does the real work minutes later, including signature consumption |
| upgradeRevision / upgradeDocumentRevision | yes | **PESSIMISTIC_WRITE** via `documentRepository.findByIdForUpdate` (shared with Document Obsolete) | `entityManager.refresh(lockedSource)` explicitly forces a real re-read of the source Revision past Hibernate's first-level cache | no |
| Document Obsolete (cascade into Revision) | yes | same PESSIMISTIC_WRITE lock, shared with Upgrade | `requireNoRevisionInProgress` re-run after lock acquisition | no |

**Confirmed/plausible races (Phase R1.1 reconciliation — supersedes the prior list)**:
1. **FIXED, confirmed by code + comments**: concurrent Upgrade vs. Document Obsolete — closed via the
   shared PESSIMISTIC_WRITE lock + post-lock re-validation on both sides + the DB partial unique index
   backstop (`ux_document_revisions_one_in_progress`).
2. **PLAUSIBLE RACE, unresolved**: `upgradeRevision`'s asymmetric lack of a post-lock Document-ACTIVE
   re-check (§12) — a narrower, not-fully-confirmed variant of race #1 specific to this one entry point.
3. **PLAUSIBLE RACE, structurally backstopped, CLOSED (Phase R1.1b)**: divergent revision-number
   algorithms between the two upgrade entry points (§16a) could compute different candidate numbers for
   the same document; a genuine collision cannot corrupt data — the DB's full unique index on
   `(document_id, revision_number)` prevents that. Confirmed outcome (§16a): the collision surfaces as
   `DataIntegrityViolationException`, handled generically by `GlobalExceptionHandler.handleDataIntegrity`
   → **HTTP 409 `DATA_INTEGRITY_ERROR`** with a safe (non-leaking) but uninformative generic message —
   not an unhandled 500. No remaining UNKNOWN.
4. **RESOLVED to DB-CONFLICT BACKSTOP (Phase R1.1b, closes UNKNOWN #7/prior "plausible race")**: Publish
   vs. Document Obsolete. **FACT: Publish does not share the Document PESSIMISTIC_WRITE lock**, and
   `publishRevisionRecord`'s Document-status write reads the Document only once early in the
   transaction (a second in-transaction "read" is a Hibernate session-cache hit, not a fresh query) with
   no explicit re-validation before the write. **However**, `DocumentRecord` DOES carry a genuine
   `@Version lockVersion` column (`DocumentRecord.java:34-36`), and Hibernate's optimistic-lock check on
   `documentRepository.save(document)` is validated against the **live, currently-committed** DB row at
   flush/commit time — regardless of how stale the in-transaction read was. Concrete interleaving: if a
   concurrent Document Obsolete transaction commits (bumping `lock_version`) before Publish's own
   `save(document)` flushes, Publish's `UPDATE ... WHERE lock_version = <stale>` matches zero rows,
   Hibernate throws `ObjectOptimisticLockingFailureException`, Publish's **entire transaction rolls
   back** (including the Revision's `EFFECTIVE` promotion), and `GlobalExceptionHandler
   .handleOptimisticLock` returns **HTTP 409 `CONCURRENT_MODIFICATION`** to the caller — not a silent
   bad-state commit. Confirmed: neither `RevisionWorkflowAuthorizationService`/`RevisionResourceAdapter`
   perform any Document-status check for PUBLISH (Revision-status-only), so this backstop is the ONLY
   mechanism preventing the bad outcome — it is incidental (a side effect of both transactions writing
   the same versioned row), not a deliberate authorization control, which is why it is labeled a
   BACKSTOP rather than PREVENTED. No live concurrency test is needed to elevate this further — the
   `@Version` semantics are deterministic per JPA/Hibernate's documented behavior, given both
   transactions write the same Document row.
5. **PLAUSIBLE RACE (narrowed and confirmed structurally, Phase R1.1)**: same-reviewer double-action
   and Approve-vs-Reject races on the **participant** row — `RevisionWorkflowParticipant` has **no**
   `@Version` and no narrower conditional WHERE clause (confirmed by full entity read), so its writes
   are unprotected last-writer-wins; **the revision's own status transition IS backstopped** by
   `lockVersion` (→ 409 `CONCURRENT_MODIFICATION` via `GlobalExceptionHandler.handleOptimisticLock`,
   confirmed Phase R1.1), but the participant row's `actedAt`/comment fields are not. Full scenario
   breakdown in §6.
6. **PREVENTED (reclassified from "plausible," Phase R1.1)**: final Reviewer's `completeReview` /
   final Approver's `completeApproval` racing a concurrent Document Obsolete cascade — every possible
   target status of either transition is a member of `obsoleteDocument`'s in-progress blocklist, so the
   blocklist is exhaustive over both transitions' codomains and the race is prevented by design, not
   merely by luck of timing. Reviewer-#2-acts-early is likewise **PREVENTED** by the sequence check's
   fresh-read design, not just a DB backstop. See §6 for full scenario-by-scenario detail.
7. **DB-level backstop for revision-number collisions**: `ux_document_revisions_document_revision_number`
   unique index guarantees no duplicate `(document_id, revision_number)` ever persists, regardless of
   any service-level race.

---

## 24. Frontend Behavior — see §19 (kept as its own numbered section per requested structure).

---

## 25. Error Semantics — see §20 (kept as its own numbered section per requested structure).

---

## 26. Hidden Implementation Rules — see §21 (kept as its own numbered section per requested structure).

---

## 27. Dead/Unreachable/Legacy Paths — see §22 (kept as its own numbered section per requested structure).

---

## 28. QF Comparison

**Critical rule applied**: QF SDS/FRS is a reference baseline only; nothing below was copied into the
AS-IS sections above unless independently confirmed by source code. This section is a *limited*,
separate comparison pass only — it does not re-litigate any AS-IS finding.

| Area | Tag | Note |
|---|---|---|
| 8-status Revision lifecycle (Draft/Pending Review/Pending Approval/Pending Training/Ready for Publishing/Effective/Obsoleted/Closed-Cancelled) | **QF-MATCH** | Matches the general shape of a standard QMS document-revision lifecycle terminology; exact status set confirmed independently from migrations (§3), not inferred from QF. |
| Sequential, all-must-act Reviewer/Approver rounds | **LOCAL-EXTENSION / UNKNOWN vs QF** | Whether QF specifies sequential-vs-parallel review was not cross-checked against the QF document text in this pass — recorded as UNKNOWN pending an actual side-by-side read of the QF SDS/FRS revision-workflow section. |
| Rejection wipes the entire round (both roles) | **UNKNOWN vs QF** | Not cross-checked against QF text this pass. |
| Training as a single administrative attestation, no per-trainee tracking | **IMPLEMENTATION-GAP (if QF specifies real training-assignment tracking)** | Flagged as a gap candidate; whether QF actually requires per-trainee completion tracking was not verified against QF text in this pass — recorded as UNKNOWN pending that comparison. |
| Approve-reject producing no notification | **LOCAL-EXTENSION / HUMAN-DECISION CANDIDATE, not a QF question** | An implementation asymmetry regardless of what QF specifies — not meaningfully comparable to a QF baseline (see §6/§7/§17 for the canonical classification). |
| Revision invalid-state fallback path → HTTP 500 | **LOCAL-EXTENSION / DEFECT (edge-case/race-reachable path only), not a QF question** | An HTTP-contract implementation detail confined to the fallback path (§20) — not a QF business-rule question. |
| Two divergent revision-numbering algorithms for Upgrade | **LOCAL-EXTENSION / DEFECT, not a QF question** | Implementation-internal inconsistency. |
| Standalone Revision Obsolete not implemented as a live action | **UNKNOWN vs QF** | Whether QF expects a manual Revision-level Obsolete distinct from Document Obsolete cascade was not verified against QF text in this pass. |

**Overall**: a genuine, thorough QF-vs-AS-IS comparison for the Revision lifecycle was **not**
performed to completion in this pass beyond the spot-checks above — doing so properly requires a
dedicated read of the QF SDS/FRS Revision-workflow sections side-by-side with this document, which was
outside the time budget for this reconstruction pass. Recorded as an explicit follow-up, not silently
skipped.

---

## 29. Confirmed Defects / Risks (Phase R1.1 reconciliation — supersedes the prior list)

Item #8 (Cancel policy mismatch) is **removed** — resolved as no live mismatch (§14). Items previously
labeled "CONFIRMED DEFECT" for Upgrade e-signature and Approver-Reject-notification are **reclassified**
below as FACT/HUMAN-DECISION CANDIDATE per the reconciliation instruction (AS-IS describes
implementation truth, not a normative violation, absent a proven approved requirement). Risk counts
and severities below reflect only what remains after reconciliation.

1. **MEDIUM (severity recalculated, Phase R1.1b)** — The service-layer redundant fallback checks
   (`requireRevisionStatus`, `requirePendingParticipant`, etc.) surface HTTP 500 `INTERNAL_ERROR`
   instead of a stable 4xx conflict code when reached — but they are reached only via the
   edge-case/direct-call/race fallback path (§20 path B), not the normal user-request path, which
   correctly returns 403 `WORKFLOW_ACCESS_DENIED` via the already-fixed authorization layer (§20 path
   A). Downgraded from "HIGH — every request" to "MEDIUM — edge-case-reachable fallback only," since
   source does not support the claim that ordinary wrong-state user requests return 500. (§20)
2. **HIGH** — No stale-state (403/409/410) recovery pattern exists for ANY Revision workflow action in
   the frontend — the Document Lifecycle initiative's `refreshLifecycleState` pattern was never
   extended to Revision actions. (§19)
3. **MEDIUM-HIGH** — A disabled/deactivated Reviewer or Approver who is the current next-in-sequence
   participant **permanently blocks the workflow** with no auto-skip, auto-reassignment, or admin
   "reassign participant" action anywhere in the codebase (§6, closed UNKNOWN #9). Recovery would
   require a manual DB fix or reactivating the account.
4. **MEDIUM** — Publish does not share the Document-level pessimistic lock used by Upgrade/Obsolete,
   and `publishRevisionRecord`'s Document-status write is unconditional (no re-check against a fresh/
   locked read) — a PLAUSIBLE (not confirmed) race between Publish and Document Obsolete producing an
   inconsistent Document/Revision state combination. (§9, resolved from UNKNOWN #7)
5. **MEDIUM** — Two divergent, independently-maintained next-revision-number algorithms
   (`resolveNextDraftRevisionNumber` vs `resolveNextDraftRevisionNumberFromEffective`) exist for the
   two Upgrade entry points, relying on a DB unique-index backstop rather than a single shared
   algorithm to prevent inconsistency. (§16a)
6. **MEDIUM** — `upgradeRevision` does not re-check Document `ACTIVE` status after acquiring the
   PESSIMISTIC_WRITE lock (only `upgradeDocumentRevision` does), an asymmetry in an otherwise
   carefully-fixed concurrency-hardening pass. (§12)
7. **MEDIUM** — `RevisionWorkflowParticipant` has no `@Version`/optimistic-lock protection at all,
   unlike `DocumentRevisionRecord` — same-participant double-action and Approve-vs-Reject races on the
   participant row are unprotected last-writer-wins, even though the revision's own status transition
   IS backstopped. (§6, §23)
8. **MEDIUM** — `PublishingWorkspaceService.completePublish` runs the DB status cascade (EFFECTIVE +
   supersede + Controlled-Copy obsolescence) BEFORE composing/storing the actual published PDF, inside
   one physical transaction — a plausible orphaned-object risk if PDF storage fails after the DB
   portion's writes have already executed in-transaction (exact statement order now confirmed, §9);
   the external-storage-survives-a-rollback question itself remains UNKNOWN (§18, narrowed UNKNOWN #6).
9. **LOW-MEDIUM** — The formally-modeled "Revision Upgrade Session" backend API, `upgradeDocumentRevision`,
   and the direct `/revisions/{id}/upgrade` route are all confirmed unreachable from the frontend
   (dead API surfaces, §16b); the actual Upgrade UX is a simpler, less formally-gated in-place edit-mode
   toggle. A stale JSDoc comment on `createRevisionUpgradeSession` could mislead future readers into
   believing otherwise.
10. **FACT / HUMAN-DECISION CANDIDATE (reclassified, no longer ranked as a "defect")** — Revision
    Upgrade requires no electronic signature (§15); Approver Reject produces no notification (§6/§7);
    Training is administrative-attestation-only with no per-trainee tracking (§8); force-publish is
    unreachable from the production Publish path (§9). Each is an accurate implementation FACT; none
    is elevated to defect status absent a proven approved requirement it violates.

---

## 30. UNKNOWN / Questions Requiring Human Decision (Phase R1.1 — 8 of the original 9 CLOSED)

**CLOSED in this pass** (retained here only as a pointer to where the resolution now lives, per
instruction to update counts):
- ~~#1 DCO SoD~~ — CLOSED, §6 (`ensureNoWorkflowCoordinatorInRoles` confirmed to implement
  `dcoCannotBeReviewerOrApprover` via permission-code resolution, assignment-time only).
- ~~#2 requireTwoReviewers~~ — CLOSED, §6 (CONFIG-ONLY, confirmed dead w.r.t. business logic).
- ~~#3 incrementVersion~~ — CLOSED, §16a (CONFIRMED DEAD, zero callers).
- ~~#4 Upgrade entry points~~ — CLOSED, §16b (full reachability chain traced for both entry points and
  the upgrade-session trio).
- ~~#5 Notification failure tracking~~ — CLOSED, §17 (confirmed: same shared retry+
  `NotificationDeliveryFailure` pipeline as other domains; dispatch is synchronous-but-tracked, not
  after-commit).
- ~~#7 Publish/Obsolete shared lock~~ — CLOSED to a PLAUSIBLE RACE with full interleaving analysis,
  §9/§23 (was UNKNOWN, now a bounded, cited risk — not fully CONFIRMED, see remaining item below).
- ~~#9 Disabled reviewer/approver~~ — CLOSED, §6 (authentication-layer gate confirmed; workflow can be
  permanently blocked with no recovery path — recorded as risk #3 in §29).

**REMAINING (narrowed, not closed)**:
1. (was #6) **Narrowed external-storage-survives-rollback question**: the exact execution order inside
   Publish is now fully confirmed (§9) — DB cascade, then PDF compose, then PDF store, all one physical
   transaction. What remains genuinely unresolvable by static reading alone is narrower than before:
   specifically, whether a MinIO/filesystem object written successfully during step 6 of §9's trace
   truly persists as an orphan if a later step in the same transaction throws and rolls back the DB
   portion — this requires either a live fault-injection test or infrastructure-level inspection, not
   further code reading.
2. (was #8) A genuine, complete QF-SDS/FRS-vs-AS-IS side-by-side comparison for the Revision lifecycle
   was intentionally **not** performed in this pass (explicitly deferred per Phase R1.1 instructions —
   "Do NOT compare against QF yet except where explicitly requested later") — remains an explicit,
   un-silenced gap for the next phase, not a defect of this pass.
3. **New, narrow item surfaced during reconciliation**: whether a concurrent revision-number collision
   (`ux_document_revisions_document_revision_number` violation) is caught and translated to a clean
   business error anywhere in a global exception handler, or surfaces as a raw 500 — the relevant
   `RevisionService.java` methods were confirmed to have no local catch, but the global exception-
   handling package was not searched in this pass. (§16a/§23)
4. **New, narrow item surfaced during reconciliation**: whether `RevisionWorkflowAuthorizationService
   .require(...)` (called early in `publishRevision`) or an as-yet-unconfirmed optimistic-lock
   (`@Version`) column on `DocumentRecord` independently intercepts the Publish-vs-Obsolete interleaving
   described in §9 before it could commit — neither was ruled out, and ruling this out is what would
   move risk §29.4 from PLAUSIBLE to CONFIRMED (or clear it entirely). (§9/§23)

**Net UNKNOWN count: 4** (down from 9), all either newly narrowed sub-questions or explicitly
out-of-scope-by-instruction (the QF comparison).

---

## 31. Source-Code Evidence Index (key files referenced throughout)

**Backend**:
- `eqms-backend/src/main/java/com/eqms/entity/DocumentRevisionRecord.java`
- `eqms-backend/src/main/java/com/eqms/entity/RevisionStatusDefinition.java`
- `eqms-backend/src/main/java/com/eqms/entity/RevisionWorkflowParticipant.java`
- `eqms-backend/src/main/java/com/eqms/entity/DocumentWorkflowSetting.java`
- `eqms-backend/src/main/java/com/eqms/repository/DocumentRevisionRepository.java`
- `eqms-backend/src/main/java/com/eqms/service/RevisionService.java` (primary, ~5000+ lines)
- `eqms-backend/src/main/java/com/eqms/service/RevisionWorkflowAuthorizationService.java`
- `eqms-backend/src/main/java/com/eqms/service/RevisionResourceAdapter.java`
- `eqms-backend/src/main/java/com/eqms/service/RevisionActionCapabilityService.java`
- `eqms-backend/src/main/java/com/eqms/service/TrainingAuthorizationService.java`
- `eqms-backend/src/main/java/com/eqms/service/PublishingWorkspaceService.java`
- `eqms-backend/src/main/java/com/eqms/service/PublishingWorkspaceJobProcessorService.java`
- `eqms-backend/src/main/java/com/eqms/service/ControlledCopyLifecycleObsolescenceService.java`
- `eqms-backend/src/main/java/com/eqms/service/SignatureTokenConsumptionService.java`
- `eqms-backend/src/main/java/com/eqms/service/ElectronicSignatureService.java`
- `eqms-backend/src/main/java/com/eqms/service/DocumentService.java`
- `eqms-backend/src/main/java/com/eqms/controller/RevisionController.java`
- `eqms-backend/src/main/java/com/eqms/controller/PublishingWorkspaceController.java`
- `eqms-backend/src/main/java/com/eqms/exception/GlobalExceptionHandler.java`
- `eqms-backend/src/main/resources/db/migration/V9__create_revision_management_schema.sql`
- `eqms-backend/src/main/resources/db/migration/V73__enforce_single_in_progress_revision.sql`
- `eqms-backend/src/main/resources/db/migration/V77__ensure_status_lookup_consistency.sql`
- `eqms-backend/src/main/resources/db/migration/V282__remove_pdf_comments_and_add_ready_for_publishing.sql`
- `eqms-backend/src/main/resources/db/migration/V159__seed_workflow_action_policies.sql`
- `eqms-backend/src/main/resources/db/migration/V208__align_draft_snapshot_with_author_submit_permission.sql`
- `eqms-backend/src/main/resources/db/migration/V290__align_workspace_managed_revision_actions.sql`
- `eqms-backend/src/main/resources/db/migration/V393__create_used_signature_tokens.sql`
- `eqms-backend/src/main/resources/db/migration/V273__harden_cancel_and_obsolete_revision_lifecycle.sql` (Phase R1.1: resolves Cancel policy)
- `eqms-backend/src/main/java/com/eqms/auth/AuthTokenFilter.java` (Phase R1.1: disabled-user authentication gate)
- `eqms-backend/src/main/java/com/eqms/service/RevisionUpgradeSessionService.java` (Phase R1.1: upgrade-session reachability)
- `eqms-backend/src/main/java/com/eqms/service/RevisionWorkspaceBatchService.java` (Phase R1.1: real caller of `upgradeRevision`)
- `eqms-backend/src/main/java/com/eqms/service/EmailNotificationService.java` (Phase R1.1: notification retry/failure pipeline)
- `eqms-backend/src/main/java/com/eqms/entity/NotificationDeliveryFailure.java` (Phase R1.1)
- `eqms-backend/src/main/java/com/eqms/controller/DocumentController.java` (Phase R1.1: `upgradeDocumentRevision`/upgrade-session endpoints)
- `eqms-backend/src/main/java/com/eqms/bootstrap/SettingsSeedBootstrap.java` (Phase R1.1: `requireTwoReviewers` default)
- `eqms-backend/src/main/java/com/eqms/service/UserManagementService.java` (Phase R1.1: settings admin read/write)

**Frontend**:
- `eqms/src/features/documents/document-revisions/detail-revision/DetailRevisionView.tsx`
- `eqms/src/features/documents/document-revisions/views/RevisionCreateView.tsx`
- `eqms/src/features/documents/document-revisions/views/RevisionReviewView.tsx` (approximate name)
- `eqms/src/features/documents/document-revisions/views/RevisionApprovalView.tsx` (approximate name)
- `eqms/src/features/documents/document-list/document-creation/new-tabs/subtabs/DocumentRevisionsTab.tsx`
- `eqms/src/features/documents/document-list/document-creation/UploadRevisionModal.tsx`
- `eqms/src/features/documents/document-detail/DetailDocumentView.tsx`
- `eqms/src/services/api/documents.ts`
- `eqms/src/services/api/security.ts`
- `eqms/src/hooks/useRevisionActionCapabilities.ts`

STOP. No TO-BE Revision requirements are proposed by this document.
