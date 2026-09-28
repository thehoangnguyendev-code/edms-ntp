# 11 — Cross-Workflow Dependencies (AS-IS)

Canonical map of confirmed cross-entity/cross-subsystem effects, consolidated from `07-workflows.md`, `08-state-machines.md`, `12`–`19`. Each row cites its confirming evidence; duplicated implementations are flagged as divergence-risk, never as a defect, unless behavioral inconsistency was actually observed (none was).

## Document → Revision

| Source event | Source entity | Target | Sync/Async | Transaction | Target effect | Failure propagation | Retry/recovery | Evidence |
|---|---|---|---|---|---|---|---|---|
| Document Obsolete (WF-DOC-05) | DocumentRecord | DocumentRevisionRecord (all non-terminal) | Synchronous | Same transaction | Every non-terminal Revision → `OBSOLETED`, via `RevisionService.obsoleteRevisionAsPartOfDocumentObsolete` (real per-revision history + audit, not a raw field flip) | If any per-revision call throws, the whole Document-obsolete transaction rolls back (no partial cascade) | None needed — synchronous, all-or-nothing | `08` §8.3, BR-DOC-008 |
| Update Active Workflow Configuration (WF-DOC-03) | DocumentRecord | open DRAFT DocumentRevisionRecord | Synchronous | Same transaction | `revisionService.syncDraftRevisionWithDocument` keeps an open Draft revision's author/co-author/reviewer/approver/periodic-review/training config in sync with the parent Document | Same-transaction rollback on failure | None | `08` §8.5; internals of `syncDraftRevisionWithDocument` `UNKNOWN` (`21`) |

## Revision → Document

| Source event | Source entity | Target | Sync/Async | Transaction | Target effect | Failure propagation | Retry/recovery | Evidence |
|---|---|---|---|---|---|---|---|---|
| Revision Upload / first Submit (WF-REV-01/03) | DocumentRevisionRecord | DocumentRecord | Synchronous | Same transaction | Parent Document progresses to (or is confirmed) `ACTIVE` | Same-transaction rollback | None | BR-REV-001; exact upload-vs-submit trigger point `UNKNOWN` (`21`) |
| Revision Publish (WF-REV-09) | DocumentRevisionRecord | DocumentRecord | Synchronous | Same transaction | Document set/confirmed `ACTIVE`, version/effectiveDate/validUntil/reviewDate updated | Same-transaction rollback | None | `08` §8.4b, BR-REV-013 |
| Revision Cancel (WF-REV-10) | DocumentRevisionRecord | DocumentRecord | Synchronous | Same transaction | `syncDocumentStatusAfterRevisionCancellation` may auto-close the parent Document if no revisions remain | Same-transaction rollback | None | `08` §8.4b, BR-REV-016 |

## Revision Publish → previous Revision (the headline confirmed cascade)

| Source event | Source entity | Target | Sync/Async | Transaction | Target effect | Failure propagation | Retry/recovery | Evidence |
|---|---|---|---|---|---|---|---|---|
| Revision Publish (WF-REV-09) | DocumentRevisionRecord (new EFFECTIVE) | DocumentRevisionRecord (prior EFFECTIVE sibling, if any) | Synchronous | Same transaction as the publish | Prior EFFECTIVE sibling(s) → `OBSOLETED`, `obsoletedBy`/`obsoletedAt` set, history recorded | Same-transaction rollback (the whole publish, including the cascade, is atomic) | None — no async involved at this step | `08` §8.4b–8.4c, BR-REV-014 |

Note: the query is `findAllByDocument_IdAndStatus_Code(documentId, "EFFECTIVE")` excluding the revision being published — it does not assume exactly one prior EFFECTIVE revision exists; it loops over however many match.

## Revision Obsolete → Controlled Copy

| Source event | Source entity | Target | Sync/Async | Transaction | Target effect | Failure propagation | Retry/recovery | Evidence |
|---|---|---|---|---|---|---|---|---|
| Revision Obsolete via publish-supersede (WF-REV-09/12) | DocumentRevisionRecord (superseded) | ControlledCopyRecord | Synchronous | Same transaction as the publish | `DISTRIBUTED`/`READY_FOR_DISTRIBUTION` copies → `OBSOLETED`, reason `NEW_REVISION_PUBLISHED`, via `RevisionService.obsoleteDistributedControlledCopies` | Same-transaction rollback | None | `08` §8.4c, BR-REV-014, BR-CC-013 |

**Divergence-risk note**: `obsoleteDistributedControlledCopies` sets `status`/`statusCode` as two separate inline statements rather than via `ControlledCopyService`'s shared `setControlledCopyStatus` helper (used everywhere else for single-record transitions). Functionally equivalent today; flagged as a latent-divergence risk (a future change to the status/label mapping in one place would not automatically apply to the other) — not a demonstrated behavioral inconsistency.

## Document Obsolete → Revision → Controlled Copy

| Source event | Source entity | Target | Sync/Async | Transaction | Target effect | Failure propagation | Retry/recovery | Evidence |
|---|---|---|---|---|---|---|---|---|
| Document Obsolete (WF-DOC-05) | DocumentRecord | DocumentRevisionRecord (all non-terminal) | Synchronous | Same transaction | → `OBSOLETED` via `RevisionService.obsoleteRevisionAsPartOfDocumentObsolete` | Same-transaction rollback | None | BR-DOC-008 |
| Document Obsolete (WF-DOC-05) | DocumentRecord | ControlledCopyRecord (all Distributed/Ready) | Synchronous | Same transaction (same as above, **not delegated through the Revision-level helper**) | → `OBSOLETED`, reason `DOCUMENT_OBSOLETED`, via a **separate inline loop directly in `DocumentService.obsoleteDocument`** | Same-transaction rollback | None | BR-DOC-009, BR-CC-013 |

**Confirmed divergence-risk (Decision Log candidate #1, `21`)**: this is the **second independent implementation** of "obsolete this document's/revision's distributed controlled copies" alongside `RevisionService.obsoleteDistributedControlledCopies` used for the publish-supersede case above. Both apply the same net effect (Distributed/Ready-for-Distribution → Obsoleted) with a different `obsoleteReason` value (`DOCUMENT_OBSOLETED` vs. `NEW_REVISION_PUBLISHED`/`REVISION_OBSOLETED`), but they are two separate code paths — a change to one would not automatically propagate to the other. **No evidence of actually inconsistent behavior between the two paths was found in this pass** — this is documented strictly as a maintainability/divergence risk, not a confirmed defect.

## Revision → Publishing Workspace / PDF

| Source event | Source entity | Target | Sync/Async | Transaction | Target effect | Failure propagation | Retry/recovery | Evidence |
|---|---|---|---|---|---|---|---|---|
| Submit for Review / Review Complete / Approval Complete / Training Complete / Regenerate Snapshot | DocumentRevisionRecord | Publishing preview PDF (`RevisionPublishingMetadata`, `RevisionSnapshotHistory`) | **Synchronous, in-request** | Same transaction | `regeneratePublishingSnapshotIfConfigured` → `PublishingPdfComposerService.composePreview`; new object key per review round, new `RevisionSnapshotHistory` row | **Exception is caught and logged (`log.warn`) only — the workflow transition itself still succeeds** | None (no retry, no async fallback despite a dead async alternative existing) | `08` §8.4d, BR-REV-020, `21` (Decision Log candidate #3) |
| Publishing Workspace "open" action | (separate feature) | `PublishingWorkspaceOpenedEvent` | **Asynchronous** (`@Async fileProcessingExecutor`, AFTER_COMMIT) | Separate transaction (the async listener's own) | `PublishingWorkspaceJobProcessorService.processOpenWorkspaceJob` generates the preview, marks the job Completed/Failed with an audit entry (`PUBLISHING_PACKAGE_FAILED`) on failure | Failure is recorded on the job + audit trail, does not roll back the original open-workspace request | None confirmed beyond the one attempt | `13-async-scheduler-events.md` |

**Note**: these are two distinct PDF-generation paths in the system — the per-workflow-transition snapshot regen (synchronous, swallow-on-failure) and the Publishing Workspace's own open-workspace preview generation (asynchronous, failure-tracked). They are not the same mechanism and should not be conflated.

## Workflow actions → Authorization

| Source event | Source entity | Target | Sync/Async | Transaction | Target effect | Failure propagation | Evidence |
|---|---|---|---|---|---|---|---|
| Every Document/Revision master-lifecycle action | DocumentService/RevisionService | `AuthorizationEngineService` (policy engine) | Synchronous, in-request | Same transaction (check precedes mutation) | Allow/deny decision from `workflow_action_policies` + actor scope + permission code | **Fails closed on engine error** — an engine exception denies the action, never falls back to allow | `06` §6.3, BR-AUTH-001 |
| Reviewer/Approver actions specifically | RevisionWorkflowAuthorizationService | same engine + FIFO sequence check | Synchronous | Same transaction | Additional gate: must be the current pending participant in sequence | Denial surfaces as `WorkflowAuthorizationDeniedException` → 403 | `06` §6.3, BR-REV-007, `19` |

## Workflow actions → Electronic Signature

| Source event | Target | Sync/Async | Transaction | Target effect | Evidence |
|---|---|---|---|---|---|
| Every signature-required transition (see `16` for the full meaning list) | `ElectronicSignatureService` + `SignatureTokenConsumptionService` | Synchronous, in-request | Same transaction | Token validated + single-use-consumed; `ElectronicSignature` row persisted with meaning, printed identity snapshot, checksums (Revision signatures) | `16-electronic-signature.md`, BR-SIG-001/003/005 |

## Workflow actions → Audit Trail

| Source event | Target | Sync/Async | Transaction | Target effect | Evidence |
|---|---|---|---|---|---|
| Every confirmed lifecycle transition in `07`/`08` | `AuditTrailService.logAs`/`persistAudit` | Synchronous, in-request | Same transaction (except rejected-upload audit, see below) | New `AuditLog` (+ `AuditLogChange` rows) with actor snapshot | `15-audit-trail.md`, BR-AUD-001 |
| Rejected Revision source-file upload | `RevisionUploadSecurityAuditService.recordRejected` | Synchronous | **Independent `REQUIRES_NEW` transaction** — deliberately survives even if the calling transaction rolls back | Audit row for the rejection reason/filename/content-type/size | `17-file-storage.md` |

## Workflow actions → Notification

| Source event | Target | Sync/Async | Transaction | Target effect | Evidence |
|---|---|---|---|---|---|
| Reviewer's-turn, Approver's-turn, Pending-Training transitions | `NotificationDispatcher`/`EmailNotificationService` | Synchronous within the transaction commit boundary (policy path) or direct send (legacy path) | Same transaction for the dispatch call; actual email send may defer to an hourly digest queue row for non-mandatory events | Email + in-app notification per policy | `14-notifications.md`, BR-NOTIF-004 |
| Controlled Copy distribute/recall/destroy | `ControlledCopyService` → `NotificationDispatcher` | Synchronous | Same transaction | Policy-driven notification (`controlled_copy.distributed`/`recalled`/`destroyed`) | `14`, `08` §8.4 |
| Controlled Copy 7-day expiry reminder | `ControlledCopyExpiryScheduler` → `EmailNotificationService` directly | Synchronous (within the scheduled job's transaction) | Same transaction | Email sent, **bypassing** `NotificationDispatcher`'s policy engine entirely | BR-CC-012, `14` |

## Controlled Copy batch → Async jobs → Copy states → Batch state

| Source event | Target | Sync/Async | Transaction | Target effect | Failure propagation | Retry/recovery | Evidence |
|---|---|---|---|---|---|---|---|
| Distribute/Cancel/Recall Batch | `ControlledCopyDistributionJob`/`JobItem` created; batch + copies flip status | Synchronous | Same transaction (status flip) | Batch and all member copies transition immediately | N/A (synchronous step) | N/A | `08` §8.4, BR-CC-014 |
| (same) | `ControlledCopyBatchDistributedEvent`/`CancelledEvent`/`RecalledEvent` → async finalize per copy | **Asynchronous**, `@TransactionalEventListener(AFTER_COMMIT)`, `controlledCopyBatchExecutor` pool | Each finalize call is its own transaction, re-fetching the copy fresh | Per-copy finalization (PDF/notification work); Distribute and Cancel re-check terminal state before mutating, **Recall does not** | On `OptimisticLockingFailureException`: re-resolve via a brand-new read-only transaction, retry up to 3×, linear backoff | `resumePendingJobs()` (all three services) resumes jobs stuck `PENDING` after a restart, via atomic DB claim | `08` §8.4, `12`, `13`, `19`, BR-CC-007/014/015/016 |
| Async finalize failure exhausted | `ControlledCopyDistributionJobItem.status=FAILED` | — | — | Job status becomes `COMPLETED_WITH_ERRORS`; manual retry endpoint (`POST .../retry-failed`) reprocesses only `FAILED` items | Discoverable via failed-items GET + SSE progress event; **no push alert on permanent failure** | Manual, pull-based retry only | `19-error-retry-recovery.md` |

## Controlled Copy Expiry → Copy status → Batch synchronization → Notification

| Source event | Target | Sync/Async | Transaction | Target effect | Evidence |
|---|---|---|---|---|---|
| Daily expiry scheduler (02:00, Redis-lease-guarded) | ControlledCopyRecord | Synchronous within the scheduled job | `@Transactional` sub-methods | Expired Distributed copies → `OBSOLETED`, reason `EXPIRED` | BR-CC-011, `08` §8.4, `13` |
| (same) | ControlledCopyDistributionBatch | Synchronous | Same job | Parent batch synchronized to Obsoleted if not already | `08` §8.4 |
| 7 days prior | Reminder email | Synchronous | Same job | Sent **outside** the policy engine (see above) | BR-CC-012 |

## Office Online / SharePoint → Revision storage/sync state

| Source event | Target | Sync/Async | Transaction | Target effect | Failure propagation | Retry/recovery | Evidence |
|---|---|---|---|---|---|---|---|
| Upload to Office Online / periodic sync | `DocumentRevisionRecord` storage fields (`storageItemId`, URLs, `storageSyncStatus`, `storageLastSyncedAt`) | **Asynchronous** (`@Async integrationExecutor`) | Its own transaction | Metadata written back unconditionally, no version/etag check against the Graph item | On any exception: `storageSyncStatus="FAILED"`, exception swallowed (`log.warn` only) | **No retry, no scheduled re-sync sweep found** for `FAILED` status | `17-file-storage.md`, `18-external-integrations.md`, BR-STORAGE-004, `21` item 12 |
| Reject Review/Approval | `reopenOfficeOnlineWorkingCopy` | Synchronous | Same transaction as the reject | Working copy reopened for further editing | Same-transaction rollback on failure | None | `07` WF-REV-05/07 |

## Cross-file consistency check performed for this section
No two SDS files were found asserting incompatible facts about any dependency listed above. The Document-Obsolete-vs-Revision-Obsolete Controlled-Copy-cascade duplication (flagged repeatedly above) is the one place where two *code paths* diverge structurally — this is documented as a divergence-risk in every section that touches it (`08`, `09`, `10`, `11`, `21`) with consistent wording, not as a contradiction between SDS files.
