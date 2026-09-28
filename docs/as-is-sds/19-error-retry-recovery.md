# 19 — Error, Retry & Recovery Behavior (AS-IS)

Evidence: direct read of `exception/GlobalExceptionHandler.java` and the three `ControlledCopyBatch*AsyncService` classes; cross-referenced against `08-state-machines.md`/`12-transaction-concurrency.md`.

## GlobalExceptionHandler — exception → HTTP status mapping
| Exception | Status | Error code | Note |
|---|---|---|---|
| `MethodArgumentNotValidException` | 422 | `VALIDATION_ERROR` | |
| `HttpMessageNotReadableException` | 400 | `BAD_REQUEST` | |
| `UnauthorizedException` | 401 | `UNAUTHORIZED` | |
| `EntityNotFoundException` / `ResponseStatusException` | 404 (or wrapped status) | `RESOURCE_NOT_FOUND` | |
| `IllegalArgumentException` | 400 | `BAD_REQUEST` | |
| `RevisionUploadValidationException` | 400 | exception's own code (e.g. `MALWARE_DETECTED`, `INVALID_DOCX_SIGNATURE`) | |
| `OfficeOnlineShareException` | 400 | own code | |
| **`IllegalStateException`** | **500** | `INTERNAL_ERROR` | logged at `log.error` — treated as a genuine server bug, not a client condition |
| `ClamAvScanService.VirusScanUnavailableException` | 503 | `VIRUS_SCAN_UNAVAILABLE` | fail-closed on AV outage |
| `RevisionWorkspaceBatchValidationException` | 422 | `WORKSPACE_BATCH_VALIDATION_ERROR` | per-item details |
| `RelatedDocumentsNotEffectiveException` | 400 | `RELATED_DOCUMENTS_NOT_EFFECTIVE` | force-publish override path, `08-state-machines.md` §8.4b |
| **`ObjectOptimisticLockingFailureException`** | **409** | `CONCURRENT_MODIFICATION` | code comment: "expected, recoverable concurrency conflict... client should reload and retry, not treat as a server fault" |
| `DataIntegrityViolationException` | 409 | `DATA_INTEGRITY_ERROR` | hand-mapped friendly messages for known unique-constraint names, else generic |
| `MissingServletRequestPartException`/`MultipartException` | 400 | `BAD_REQUEST` ("File is required") | |
| `MaxUploadSizeExceededException` | 413 | `PAYLOAD_TOO_LARGE` | |
| `ConstraintViolationException` | 422 | `VALIDATION_ERROR` | |
| `MethodArgumentTypeMismatchException` | 400 | `BAD_REQUEST` | |
| `MissingServletRequestParameterException` | 400 | `BAD_REQUEST` | |
| `HttpRequestMethodNotSupportedException` | 405 | `METHOD_NOT_ALLOWED` | |
| `HttpMediaTypeNotSupportedException` | 415 | `UNSUPPORTED_MEDIA_TYPE` | |
| **`AccessDeniedException`** | **403** | `FORBIDDEN` | |
| `WorkflowAuthorizationDeniedException` | 403 | `WORKFLOW_ACCESS_DENIED` | code comment notes this handler was **previously missing entirely**, causing denials to surface as a vague 500 instead of the real reason — found/fixed while investigating a SoD permission issue; `IMPLEMENTATION-DISCOVERED` history worth preserving |
| `Exception` (catch-all) | 500 | `INTERNAL_ERROR` | logged `log.error`, generic message, does not leak exception detail |

Key asymmetry: `IllegalStateException` → treated as a server bug (500, `log.error`); `ObjectOptimisticLockingFailureException` and `AccessDeniedException`/`WorkflowAuthorizationDeniedException` → treated as expected/recoverable client-facing conditions (409/403). This directly maps onto `20-ui-api-service-mapping.md`'s finding that the frontend's shared `[403,409,410]` handling (capability refresh + generic error toast) is well-matched to the backend's intent for these three specific statuses.

`ControlledCopyNotAvailableException` (referenced during the lifecycle trace) was **not found by name** in `GlobalExceptionHandler` — `UNKNOWN` whether it exists as a distinct type falling through to the 500 catch-all, or under a different name; not confirmed this pass.

## Retry pattern — `finalizeWithRetry`, replicated identically across all three Controlled Copy batch async services
`ControlledCopyBatchDistributionAsyncService`, `ControlledCopyBatchCancelAsyncService`, `ControlledCopyBatchRecallAsyncService` share the **exact same shape**:
- `MAX_PROCESSING_ATTEMPTS = 3` (independently declared per class, not a shared constant — minor duplication).
- Loop attempts 1–3; on exception (Distribution specifically catches `OptimisticLockingFailureException` and re-checks terminal state, treating that as `SKIPPED_TERMINAL` rather than failure — see `12-transaction-concurrency.md`), logs a warning and, if not the last attempt, sleeps `250L * attempt` ms — **linear backoff: 250ms, 500ms**, not exponential.
- After exhausting all 3 attempts: marks the job item `FAILED` with `lastErrorCode`/`lastErrorMessage`. Distribution additionally calls `restoreFailedCopy(...)` to roll the copy back to "Ready for Distribution" so it's retry-eligible.

**Confirmed: this is the only retry-with-backoff pattern anywhere in the codebase.** No `@Retryable` annotation, no `RetryTemplate` usage found anywhere in `com.eqms`. Every other integration failure path (MinIO, SharePoint sync, SMTP, Graph Office Online, NAS/SMB — see `18-external-integrations.md`) fails once and either swallows-and-logs or throws straight to the global handler, with zero automatic retry. This is an architecturally significant, deliberate asymmetry: retry logic exists specifically for **transient local-database concurrency conflicts** in Controlled Copy batch processing, not for external-system flakiness.

## `resumePendingJobs()` — confirmed present in all three batch async services
All three classes have an identical `@Scheduled(fixedDelay=30000) resumePendingJobs()`: queries up to 10 `PENDING` jobs of the matching action type, oldest-first; atomically claims each via `jobRepository.claimPendingJob(jobId)` (guards against two instances picking up the same job after a restart); re-invokes the corresponding handler for any items still `PENDING`. This corrects/confirms the earlier trace's partial finding (only Distribution had been directly verified) — Cancel and Recall have the identical mechanism. Systematic, deliberately mirrored design, not a one-off.

## Manual retry endpoints / dead-letter handling
- `ControlledCopyController`: `POST /distribution-batches/{batchId}/retry-failed?action={DISTRIBUTE|RECALL|CANCEL}` (default `DISTRIBUTE`) — a real, reachable endpoint, dispatches to the matching `retryFailedX(batchId)` method, returns **202 Accepted** immediately (fire-and-forget; work happens in the `@Async retryFailedItems(...)` methods, confirmed present on all three services).
- A companion failed-items listing endpoint returns `ControlledCopyBatchFailedItemResponse` (copy id, controlled-copy number, recipient name, `lastErrorMessage`) for the most recent job of a batch — this is the dead-letter visibility surface: a user/admin can see exactly which copies failed and why, then retry just those.
- **From the API's perspective, the manual-retry UX is**: batch action → some items exhaust 3 automatic attempts → job status becomes `COMPLETED_WITH_ERRORS` → frontend shows a batch-result modal with the failed list (via the failed-items GET, cross-referenced in `20-ui-api-service-mapping.md` item 6) → user clicks retry → `POST .../retry-failed` → 202 → async reprocessing of only `FAILED` items → status updates discoverable via the same GET or the SSE progress channel (`controlled-copy-batch-progress` event).
- **No alerting/notification-on-permanent-failure was found** beyond the SSE progress event and the failed-items GET — a permanently failed item (one that also fails manual retry) sits as `FAILED` with no push notification to anyone; it is discoverable only by proactively checking the batch result UI. `IMPLEMENTATION-GAP` candidate for Decision Log: is silent, pull-based dead-letter visibility acceptable for a GMP-relevant distribution failure, or should it page/notify someone?

## UNKNOWNs
- Whether `ControlledCopyNotAvailableException` exists under that name and where it's mapped.
- Whether every checksum/integrity-verification path is wired end-to-end (see `17-file-storage.md`).
- Whether any scheduled reconciliation exists for permanently-`FAILED` SharePoint syncs (see `18-external-integrations.md`) — if none exists, that's a second silent-failure surface alongside the Controlled Copy dead-letter gap above.
