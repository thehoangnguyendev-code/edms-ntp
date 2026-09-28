# 13 — Async / Scheduler / Events (AS-IS)

Evidence: direct read of `config/AsyncConfig.java` and every `@Scheduled`/`@EventListener` class in `service/`.

## Thread pools (`config/AsyncConfig.java`)
Four dedicated `ThreadPoolTaskExecutor` beans (replacing one shared pool, deliberately isolating workloads):
| Bean | Core/Max/Queue | Purpose |
|---|---|---|
| `mfaEmailExecutor` | 2/4/50 | latency-sensitive OTP emails |
| `fileProcessingExecutor` | 2/4/50 | heavy PDF/DOCX jobs (Publishing Workspace preview/publish, revision snapshot) |
| `controlledCopyBatchExecutor` | 4/8/50 | Controlled Copy batch distribute/cancel/recall |
| `integrationExecutor` | 4/10/50 | SharePoint/MS Graph outbound calls |

No explicit `RejectedExecutionHandler` on any pool — Spring's default `AbortPolicy` applies (queue full → `RejectedExecutionException` back to the caller). No `AsyncUncaughtExceptionHandler` bean found either. **`IMPLEMENTATION-GAP`**: overflow/uncaught-async-exception handling is entirely default Spring behavior, not custom-hardened.

## Every `@Scheduled` method
| Class.method | Cadence | Purpose | Distributed lock? |
|---|---|---|---|
| `ControlledCopyExpiryScheduler.runDailyExpiryProcessing` | daily 02:00 | Expiry reminders + auto-obsolete expired copies (cascades batch) | Redis lease `"controlled-copy-expiry"`, 30 min |
| `ControlledCopyBatchDiscrepancyScanner.scanForDiscrepancies` | hourly | Read-only drift detection, never self-heals | Redis lease `"controlled-copy-batch-discrepancy"`, 15 min |
| `ControlledCopyBatchDistributionAsyncService.resumePendingJobs` | every 30s | Resume PENDING distribute jobs after restart | Atomic DB claim (`claimPendingJob`), no Redis lease |
| `ControlledCopyBatchCancelAsyncService.resumePendingJobs` | every 30s | Same, for CANCEL jobs — **confirmed present**, mirrors Distribution | Atomic DB claim |
| `ControlledCopyBatchRecallAsyncService.resumePendingJobs` | every 30s | Same, for RECALL jobs — **confirmed present**, mirrors Distribution | Atomic DB claim |
| `ExternalIdentityProvisioningService.reconcileDirectoryInBackground` | every 60s (30s initial delay) | Executes durable, previously-authorized MS Entra provisioning ops | Redis lease `"external-identity-reconciliation"`, 5 min |
| `NotificationEscalationScheduler.escalateOverdueUnread` | every 10 min | Re-dispatches unread notifications past `escalationAfterMinutes` to the escalation audience | Redis lease `"notification-escalation"`, 8 min |
| `NotificationDigestScheduler.sendDueDigests` | hourly | Sends grouped/batched emails for digest/quiet-hours-deferred queue rows | Redis lease `"notification-digest"`, 20 min |
| `AccessReviewNotificationScheduler.notifyCampaignsDueSoon` | daily 03:00 | Notifies reviewer 7 days before an Access Review campaign's `reviewPeriodEnd` | Redis lease `"access-review-campaign-due"`, 15 min |
| `NotificationRealtimeService.heartbeat` | every 25s | SSE keep-alive ping | None — correctly so (per-instance in-memory) |
| `RateLimiterService.cleanupExpiredLocalWindows` | every 60s (default) | Prunes expired in-memory rate-limit windows | None — correctly so (local fallback state) |
| `ReportJobWorker.consume` | every ~1.5s (default) | Recovers expired report leases, purges expired artifacts, processes due schedules/queued runs | Redis lease `"report-platform-worker"`, 2 min |

**Assessment**: none of the 12 scheduled methods run unprotected where multi-instance duplication would matter for a regulated outcome — the three lacking a Redis lease use an atomic DB claim instead, and the two others without any lock are deliberately node-local, non-regulated maintenance. Consistent, intentional pattern.

## `@EventListener`/`@TransactionalEventListener` catalog and publishers
| Listener | Async pool | Event | Publisher |
|---|---|---|---|
| `ControlledCopyBatchDistributionAsyncService.onBatchDistributed` | `controlledCopyBatchExecutor` | `ControlledCopyBatchDistributedEvent` (AFTER_COMMIT) | `ControlledCopyService` |
| `ControlledCopyBatchCancelAsyncService.onBatchCancelled` | `controlledCopyBatchExecutor` | `ControlledCopyBatchCancelledEvent` (AFTER_COMMIT) | `ControlledCopyService` |
| `ControlledCopyBatchRecallAsyncService.onBatchRecalled` | `controlledCopyBatchExecutor` | `ControlledCopyBatchRecalledEvent` (AFTER_COMMIT) | `ControlledCopyService` |
| `AsyncEmailDispatchService.dispatch` | none (`@TransactionalEventListener`, no `@Async` — runs synchronously on the committing thread if it ever fired) | `AsyncEmailRequestedEvent` | **NONE — dead code, confirmed** |
| `MfaOtpEmailDispatchService.dispatch` | same | `MfaOtpEmailRequestedEvent` | **NONE — dead code, confirmed** |
| `PublishingWorkspaceJobProcessorService.processOpenWorkspaceJob` | `fileProcessingExecutor` | `PublishingWorkspaceOpenedEvent` (AFTER_COMMIT) | `PublishingWorkspaceService.openWorkspace` — genuinely live |
| `RevisionSnapshotAsyncService.onRevisionSnapshotRequested` | (dead, per earlier baseline) | `RevisionSnapshotEvent` | none |

**`IMPLEMENTATION-DISCOVERED`, confirms and extends the prior dead-code finding**: `AsyncEmailRequestedEvent` and `MfaOtpEmailRequestedEvent` are **never constructed anywhere in the codebase** (zero hits for `new AsyncEmailRequestedEvent(`/`new MfaOtpEmailRequestedEvent(` outside their own record declarations). Their listener services exist and are wired as Spring beans but will never fire. This is now the **third** confirmed instance of the same pattern (alongside `RevisionSnapshotEvent`/`RevisionSnapshotAsyncService`) — three separate "async event" mechanisms built but never connected to a publisher. The real MFA-OTP/password-reset emails instead go through a direct synchronous-after-commit helper (`AuthService.runAfterCommit(() -> emailService.sendEmail(...))`) that bypasses the event classes entirely.

`PublishingWorkspaceOpenedEvent` is, by contrast, a genuinely live, correctly-wired async path: published once by `PublishingWorkspaceService.openWorkspace`, consumed by `PublishingWorkspaceJobProcessorService.processOpenWorkspaceJob`, which generates the preview and marks the job Completed/Failed with an audit entry (`PUBLISHING_PACKAGE_FAILED`) on failure.

## Cross-reference
See `19-error-retry-recovery.md` for the confirmed finding that Controlled Copy batch retry logic is the *only* retry-with-backoff pattern in the codebase, and `10-hidden-implementation-rules.md` #9 for the original `RevisionSnapshotEvent` dead-code finding this section extends to two more event types.
