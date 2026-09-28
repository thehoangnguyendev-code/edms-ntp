# 22 — Traceability Index (AS-IS)

Connects QF concept → AS-IS Workflow ID (`07`) → Business Rule ID (`09`) → state transition (`08`) → backend implementation → frontend implementation (where applicable) → gap classification. Focused on business-significant behavior; low-level helper methods are omitted (see the class→section index at the bottom for those).

## QF concept → Workflow → Rule → Transition → Implementation → Classification

| QF concept | Workflow ID | Business Rule(s) | State transition (`08`) | Backend implementation | Frontend implementation | Classification |
|---|---|---|---|---|---|---|
| New Document Record creation | WF-DOC-01 | BR-DOC-001 | (none) → `DRAFT` | `DocumentService.createDocumentDraft` | documents create form (not independently re-traced) | `QF-MATCH` |
| Edit record while Draft | WF-DOC-02 | BR-DOC-002 | `DRAFT` → `DRAFT` | `DocumentService.updateDocumentDraft` | — | `QF-MATCH` + `IMPLEMENTATION-DISCOVERED` (Sub-Type/reviewer cross-check) |
| Cancel Document | WF-DOC-04 | BR-DOC-004, BR-DOC-005 | pre-revision → `CLOSED_CANCELLED` | `DocumentService.cancelDocument` | `documentApi.cancelDocument`(?) — not independently re-traced beyond obsolete | `QF-MATCH` + `IMPLEMENTATION-DISCOVERED` (zero-revision guard) |
| Obsolete Document | WF-DOC-05 | BR-DOC-006/007/008/009/010 | `ACTIVE` → `OBSOLETED` | `DocumentService.obsoleteDocument` | **Verified**: `DetailDocumentView.tsx` defers purely to server capability (`documentMasterCapabilities?.actions.obsolete?.allowed`); `NewDocumentView.tsx` combines the same server capability **with** a client-side re-derivation via `documentLifecycleActions.ts.canObsoleteDocumentWithRevisionHistory` — two independently-gated views, confirmed cross-view inconsistency (Decision Log candidate #11, `21`) | `QF-MATCH` on outcome |
| Upload Revision / Document Revision creation (incl. Document DRAFT→ACTIVE trigger) | WF-REV-01 | BR-REV-001/002/003/004 | (none) → `DRAFT`; **Document DRAFT→ACTIVE verified trigger** | `RevisionService.uploadRevisionFile`/`createRevisionAndUploadFile` → `activateDocumentAfterInitialSourceStored` (guard: `parentRevision==null && document.status=="DRAFT"`, idempotent), `RevisionUploadFileValidator` | upload UI (not independently re-traced) | `QF-MATCH` + `IMPLEMENTATION-DISCOVERED` (validation depth, Co-Author source-upload denial) |
| Upload to MS Office Online / Edit File Online | WF-REV-02 | BR-REV-005 | `DRAFT` (editingStatus axis) | `RevisionService.completeEditing`, `RevisionSharePointSyncWorker` | — | `QF-MATCH` |
| Submit Revision | WF-REV-03 | BR-REV-006 | `DRAFT` → `PENDING_REVIEW`/`PENDING_APPROVAL`/onward | `RevisionService.submitForReview` | `documentApi` submit call (not independently re-traced) | `QF-MATCH` |
| Reviewer review (multiple reviewers) | WF-REV-04 | BR-REV-007, BR-AUTH-002 | `PENDING_REVIEW` → next stage | `RevisionService.completeReview`, `RevisionWorkflowAuthorizationService.isPendingReviewer` | `RevisionReviewView.tsx` (defers to server capability, confirmed) | `QF-DEVIATION`/possibly `QF-MATCH` — **unresolved**, QF diagrams were images |
| Reviewer reject | WF-REV-05 | BR-REV-009/010 | `PENDING_REVIEW` → `DRAFT` | `RevisionService.rejectReview` | — | `QF-MATCH` |
| Approver approval | WF-REV-06 | BR-REV-011/012 | `PENDING_APPROVAL` → `PENDING_TRAINING`/`READY_FOR_PUBLISHING` | `RevisionService.completeApproval` | — | `QF-MATCH` |
| Approver reject | WF-REV-07 | BR-REV-009/010 | `PENDING_APPROVAL` → `DRAFT` | `RevisionService.rejectApproval` | — | `QF-MATCH` |
| Training Completed | WF-REV-08 | BR-REV-012 | `PENDING_TRAINING` → `READY_FOR_PUBLISHING` | `RevisionService.completeTraining` | — | `QF-MATCH` (BR_TRG07) |
| Publish (BR_DOCR02/16, BR_DOCR06, BR_DOCR11) | WF-REV-09 | BR-REV-013/014/015 | `READY_FOR_PUBLISHING` → `EFFECTIVE` (+ sibling → `OBSOLETED`) | `RevisionService.publishRevision`/`publishRevisionRecord` | `documentApi.publishRevision`, gated via `useRevisionActionCapabilities` (confirmed deferred) | `QF-MATCH` |
| Cancel Revision | WF-REV-10 | BR-REV-016 | `DRAFT` → `CLOSED_CANCELLED` | `RevisionService.cancelRevision` | — | `QF-MATCH` |
| Upgrade Revision (new version from Effective) | WF-REV-11 | BR-REV-017/018 | `EFFECTIVE` (unchanged) + new `DRAFT` created | `RevisionService.upgradeRevision`/`upgradeDocumentRevision` | — | `QF-MATCH` |
| BR_DOC02/BR_DOCR02/BR_DOCR16 (automatic obsolescence) | WF-REV-12 | BR-REV-014/019 | `EFFECTIVE` → `OBSOLETED` (cascade only) | `RevisionService.publishRevisionRecord` (cascade); **no standalone action exists** | confirmed absent in UI too (`20` item 2) | `QF-MATCH` (cascade outcome); manual-obsolete absence is `UNKNOWN` intent |
| Request Controlled Copy | WF-CC-01 | BR-CC-001/003, BR-CC-017 | (none) → `READY_FOR_DISTRIBUTION` | `ControlledCopyService.requestControlledCopy` | `ControlledCopiesView.tsx` request flow (not independently re-traced beyond distribute/cancel/recall) | `QF-MATCH` on mechanics; `IMPLEMENTATION-GAP` on coordinator notification |
| Distribute Controlled Copy | WF-CC-02 | BR-CC-004, BR-CC-014/015 | `READY_FOR_DISTRIBUTION` → `DISTRIBUTED` | `ControlledCopyService.distribute`/`distributeBatch`, `ControlledCopyBatchDistributionAsyncService` | `ControlledCopiesView.tsx` (confirmed: server-decision-gated, polls for async completion) | `QF-MATCH` |
| Cancel Distribution | WF-CC-03 | BR-CC-005 | `READY_FOR_DISTRIBUTION` → `CLOSED_CANCELLED` | `ControlledCopyService.cancel`/`cancelBatch` | `ControlledCopiesView.tsx` (confirmed) | `IMPLEMENTATION-DISCOVERED` (Distributed-never-cancellable rule) |
| Recall | WF-CC-04 | BR-CC-006/007 | `DISTRIBUTED` → `OBSOLETED` | `ControlledCopyService.recall`/`recallBatch`, `ControlledCopyBatchRecallAsyncService.finalizeRecalledCopy` (no terminal-state guard) | `ControlledCopiesView.tsx` (confirmed: gap not compensated for) | `QF-MATCH` on mechanics; concurrency-gap is `IMPLEMENTATION-DISCOVERED`, confirmed at both layers |
| Report Lost/Damaged, Destroy | WF-CC-05 | BR-CC-008/009 | `DISTRIBUTED` → `OBSOLETED` | `ControlledCopyService.destroy`/`reportLostDamaged` | — | `IMPLEMENTATION-DISCOVERED` |
| Reissue | WF-CC-06 | BR-CC-010 | `OBSOLETED` (original unchanged) + new `READY_FOR_DISTRIBUTION` | `ControlledCopyService.replaceLostDamaged` | — | `IMPLEMENTATION-DISCOVERED` |
| 8-hour download link (QF text) / Expiry auto-obsolete | WF-CC-07 | BR-CC-011/012 | `DISTRIBUTED` → `OBSOLETED` | `ControlledCopyExpiryScheduler` | — | `UNKNOWN` re: 8h link; `QF-MATCH` on auto-obsolete-on-expiry outcome |
| BR_CON02 (Revision Obsoleted → Controlled Copy Obsoleted) | WF-CC via WF-REV-09/12, WF-DOC-05 | BR-CC-013 | `DISTRIBUTED`/`READY_FOR_DISTRIBUTION` → `OBSOLETED` | **Two independent paths**: `RevisionService.obsoleteDistributedControlledCopies` vs. `DocumentService.obsoleteDocument`'s inline loop | — | `QF-MATCH` on outcome; divergence-risk documented, not a defect |
| Batch distribution/cancel/recall (system-specific, not in QF) | WF-CC-08 | BR-CC-014/015/016 | (per above) | `ControlledCopyBatch{Distribution,Cancel,Recall}AsyncService` | `ControlledCopiesView.tsx` (confirmed polling/retry UX) | `IMPLEMENTATION-DISCOVERED` (architecture beyond QF's scope) |
| Fixed 7-role authorization matrix | (all workflows) | BR-AUTH-001 | n/a | Permission-code + policy-engine model (`AuthorizationEngineService`, `WorkflowRole` as metadata) | `useRevisionActionCapabilities`, per-action decision objects | `QF-DEVIATION` (architecture) |
| E-signature required for approval/publish/etc. | (all e-signed workflows) | BR-SIG-001/002/003/005 | n/a | `ElectronicSignatureService`, `SignatureTokenConsumptionService` | e-sign modal / SignatureFields.tsx | `QF-MATCH` on requirement; `UNKNOWN` on 11.200(a) component-count interpretation |
| Audit Trail (always-on, immutable) | (all workflows) | BR-AUD-001/002/003/004 | n/a | `AuditTrailService` | AuditTrailTab.tsx (referenced) | `QF-MATCH` at application level; DB-level guarantee weaker than QF's framing |
| Notifications (assignment, review/approval, training, expiry) | (various) | BR-NOTIF-001/002/003/004 | n/a | `NotificationDispatcher`, `EmailNotificationService`, `ControlledCopyExpiryScheduler` | — | Mixed: several `QF-MATCH`, several `IMPLEMENTATION-GAP` (see `14`) |
| "System shouldn't enable deletion of records from any state" | (all workflows) | (data-model finding, no BR-id — see `05`) | n/a | No delete call sites found in service layer; MinIO deletion unconditionally disabled; one FK hardened `CASCADE`→`RESTRICT` for evidence integrity | — | `QF-MATCH` at application level; some early-migration FKs still carry `CASCADE` structurally (`05`) |

## Backend classes → SDS sections (unchanged from prior pass, retained for lookup)
| Class/Entity | Sections |
|---|---|
| `DocumentRecord` | 04, 05, 06, 07 (WF-DOC-*), 08 §8.2–8.3, 09 (BR-DOC-*), 10, 11, 12 |
| `DocumentRevisionRecord` | 04, 05, 06, 07 (WF-REV-*), 08 §8.4b–8.4d, 09 (BR-REV-*), 10, 11, 12, 17 |
| `ControlledCopyRecord` | 04, 05, 06 §6.3, 07 (WF-CC-*), 08 §8.4, 09 (BR-CC-*), 10, 11, 12, 17 |
| `ControlledCopyDistributionBatch/Job/JobItem` | 04, 05, 07 (WF-CC-08), 08 §8.4, 09 (BR-CC-014/015/016), 11, 12, 13, 19 |
| `DocumentService` | 07 (WF-DOC-*), 08 §8.2–8.3/8.5, 09, 11, 12, 20 item 3 |
| `RevisionService` | 07 (WF-REV-*), 08 §8.4b–8.4d, 09, 11, 12, 14, 16, 17 |
| `ControlledCopyService` | 07 (WF-CC-*), 08 §8.4, 09, 11, 12, 14, 16 |
| `ControlledCopyExpiryScheduler` | 07 (WF-CC-07), 08 §8.4, 09 (BR-CC-011/012), 11, 12, 13, 14 |
| `ControlledCopyBatchDiscrepancyScanner` | 08 §8.4.3, 09, 12, 13, 21 |
| `ControlledCopyBatch{Distribution,Cancel,Recall}AsyncService` | 07 (WF-CC-08), 08 §8.4, 09, 11, 12, 13, 19 |
| `RevisionWorkflowAuthorizationService` | 06 §6.3, 07, 08 §8.4b, 09 (BR-AUTH-002), 11, 20 item 5 |
| `DocumentAuthorizationService` | 06 §6.3–6.4, 09 (BR-REV-004), 11, 15 |
| `ControlledCopyAuthorizationService` | 06 §6.3, 09 (BR-AUTH-003/004) |
| `AuthorizationEngineService` | 06 §6.0/6.3, 08 §8.0, 09 (BR-AUTH-001), 11 |
| `WorkflowRole`/`WorkflowRoleService`/`WorkflowRoleCatalogService` | 06 §6.0/6.2, 09 |
| `Permission`/`RoleDefinition`/`RolePermission`/`PermissionSet` | 06 §6.0/6.3 |
| `SodConstraint`/`SodConstraintService` | 06 §6.6, 09 (BR-AUTH-005) |
| `LifecycleStatePolicyEvaluator`/`Service`, `WorkflowActionPolicyService`/`Registry` | 08 §8.0, 02 §2.4 |
| `AccessEffectiveService` | 06 §6.5, 21 |
| `AuditTrailService`/`AuditLogRepository` | 15, 09 (BR-AUD-*), 11, 17, 19 |
| `ElectronicSignatureService`/`SignatureTokenConsumptionService`/`TokenService` | 16, 09 (BR-SIG-*), 08, 11, 15 |
| `AuthService` | 16, 14, 21 |
| `FileStorageService`/`MinioObjectStorageService` | 17, 09 (BR-STORAGE-*), 18 |
| `RevisionUploadFileValidator`/`RevisionUploadSecurityAuditService` | 17, 09 (BR-REV-003), 11 |
| `RevisionOfficeWorkspaceAccess`/`RevisionSharePointSyncWorker`/`MicrosoftGraphStorageService`/`MicrosoftGraphOfficeOnlineService` | 17, 18, 09 (BR-STORAGE-004), 11 |
| `NotificationDispatcher`/`EmailNotificationService`/`NotificationEventCatalogBootstrap` | 14, 09 (BR-NOTIF-*), 11 |
| `GlobalExceptionHandler` | 19 |
| `AsyncConfig` | 13, 02 §2.5 |
| `DistributedSchedulerLockService` | 12, 13, 18, 09 (BR-CONC-003) |
| `eqms/src/services/api/client.ts`, `documents.ts` | 20, 02 §2.2 |
| `eqms/src/hooks/useRevisionActionCapabilities.ts` | 20 items 1/5 |
| `eqms/src/features/documents/controlled-copies/ControlledCopiesView.tsx` | 20 items 4/6 |

## Coverage map (final, this reconciliation pass)
**Fully source-verified and cross-linked across 07/08/09/11/22**: Document lifecycle (create/save/reconfigure/cancel/obsolete), Document Revision lifecycle (all 12 requested transitions), Controlled Copy lifecycle (all 9 requested transitions incl. batch mechanics), role/authorization model, domain/data model, UI-API cross-check for the 5 flagged workflows, async/scheduler/events, notifications, audit trail, electronic signature, file storage, external integrations, error/retry/recovery.

**Not yet covered** (unchanged from `21-known-unknowns-conflicts.md`): Publishing Workspace/Template internals beyond the confirmed async-open-workspace and synchronous-preview-compose paths; Dashboards/Reports modules; Settings/Admin controllers beyond incidental coverage; full permission-catalog/Access-Profile data enumeration; frontend coverage outside the 5 flagged workflows and their shared API/service layer; `DocumentWorkflowSetting` SoD-flag enforcement call sites; legacy `DocumentWorkflowPoolMember` live-path status.

## Contradiction check for this file
No entry in this index conflicts with the workflow/rule/dependency detail in `07`/`08`/`09`/`11`. The two-independent-implementation Controlled-Copy-obsolete cascade is represented once here (not duplicated as a contradiction) with a single consistent classification (`QF-MATCH` on outcome, divergence-risk documented, not a defect).
