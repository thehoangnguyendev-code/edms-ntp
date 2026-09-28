# 18 — External Integrations (AS-IS)

Evidence: direct read of `service/FileStorageService.java`, `service/MinioObjectStorageService.java`, `service/MicrosoftGraphStorageService.java` (via `RevisionSharePointSyncWorker`), `service/MicrosoftGraphOfficeOnlineService.java`, `service/EmailService.java`, `service/DistributedSchedulerLockService.java`, `config/MicrosoftGraphStorageProperties.java`.

## Inventory
| System | Client / integration point | Config source |
|---|---|---|
| MinIO (S3-compatible object storage) | `io.minio.MinioClient` in `MinioObjectStorageService` | `integrations.storage` config + `app.minio.*` fallback |
| Microsoft Graph — SharePoint file sync | Raw `java.net.http.HttpClient` in `MicrosoftGraphStorageService` | `config/MicrosoftGraphStorageProperties` (`app.microsoft-graph.*`) |
| Microsoft Graph — Office Online co-authoring | `MicrosoftGraphOfficeOnlineService`, separate `OfficeOnlineConfigurationService`-sourced config | Similar Graph app registration, independently verified via `isConfigured(config)` on nearly every public method |
| SMTP (email) | `JavaMailSenderImpl` in `EmailService`, cached per config hash | `notifications.emailConfig` (host/port/user/pass/senderEmail/useSSL) |
| Redis (scheduler lease) | `StringRedisTemplate` in `DistributedSchedulerLockService` — Lua-scripted "release-if-owner" lock | `app.scheduler-lock.redis.enabled` (falls back to `APP_RATE_LIMIT_REDIS_ENABLED`) |
| Redis (rate limiting) | `RateLimiterService` — a second, separate Redis consumer (not read in depth this pass) | — |
| ClamAV | `ClamAvScanService` (referenced by `RevisionUploadFileValidator`; internals not read) | — |
| SMB/CIFS (NAS) | `org.codelibs.jcifs.smb` in `FileStorageService` | `integrations.storage` (`nasHost`/`nasShareName`/`nasUsername`/`nasPassword`/`nasDomain`) |
| SSO/LDAP/SAML | **Not found** as a distinct client. Grep hits (`ElectronicSignatureService`, `SystemConfigurationService`) not opened this pass — treat as likely **not implemented**, `UNKNOWN` not certain. |
| Simulated-only "storage providers" | AWS S3, Azure Blob, GCS, Google Drive, OneDrive, generic "SharePoint" storage provider (distinct from the real Graph/SharePoint sync above), Dropbox — all fake, see `17-file-storage.md` | `integrations.storage` |

## Failure behavior per integration
- **MinIO**: startup bucket-setup only runs if `app.minio.initialize-on-startup=true`; if unreachable at startup, logs a warning and **lets the app start anyway** ("so an administrator can configure storage"). Runtime client exceptions wrap to `IOException`, propagate uncaught by any circuit breaker, ultimately surfacing as a generic 500 `INTERNAL_ERROR` via `GlobalExceptionHandler`'s catch-all unless a more specific handler intercepts. **No retry, no circuit breaker for MinIO calls.**
- **Microsoft Graph (SharePoint file sync)**: `syncRevisionFile` wraps the whole flow and returns a failed-result DTO rather than throwing; the async worker marks `storageSyncStatus=FAILED` and logs a warning. **No retry/backoff, no circuit breaker.** Because the sync is fully asynchronous (fired after commit), **a Graph outage does not block the revision workflow itself** — the revision transitions normally; the SharePoint mirror simply stays stale/`FAILED` until (if ever) re-synced. No scheduled reconciliation for `FAILED` syncs found (`UNKNOWN` if one exists elsewhere).
- **Microsoft Graph (Office Online editing)**: every public method starts with a synchronous, in-request `isConfigured(config)` check — misconfiguration throws `IllegalStateException` immediately, which `GlobalExceptionHandler` maps to **500 INTERNAL_ERROR** (not a friendlier 4xx) — a REST-semantics smell worth flagging (misconfiguration is arguably a 4xx/ops condition, not a server bug), but not a functional defect. **No revision-workflow deadlock**: Office Online interactions are user-initiated actions outside the mandatory submit/review/approve state machine, so a Graph outage blocks only "edit online," not the DRAFT→REVIEW→APPROVE lifecycle, which continues operating on the locally/MinIO-stored DOCX. **Has a real (custom, non-Resilience4j) circuit breaker**: `MicrosoftGraphOfficeOnlineService.send`/`sendBytes` share a JVM-in-memory `consecutiveFailures`/`circuitOpenedAt` counter — after 5 consecutive 5xx/429 responses the circuit trips and every call fails fast with `IOException("Microsoft Graph circuit breaker is open; retry after 30 seconds")` for 30 seconds, instead of continuing to hit Graph. No retry/backoff on top of that, and the breaker is per-instance (in-memory, not shared across replicas).
- **SMTP**: `sendTemplateEmail`/`sendRenderedEmail`/`sendTemplateEmailWithAttachment` let send exceptions propagate; but the convenience wrapper `sendEmail(to, templateName, variables)` **swallows all exceptions with `logger.error` only** — so any notification path using `sendEmail` never surfaces an SMTP failure to its caller. No `@Retryable`/backoff around SMTP sends. `testConnection` bypasses the sender cache to avoid corrupting the cached production sender with test credentials.
- **Redis (scheduler lock)**: `DistributedSchedulerLockService.tryAcquire` **fails closed for correctness** — if Redis is enabled but unreachable, returns a not-acquired lease; comment: "the caller must skip the job rather than risk duplicate regulated actions." Lease release also swallows Redis errors on close. Deliberately safe degrade: a Redis outage causes scheduled jobs to simply not run on any instance (never duplicate), rather than erroring.
- **NAS/SMB**: most detailed operator-facing failure-message logic in the codebase — pattern-matches lowered exception messages ("access is denied", "network name cannot be found"/host-down/timeout, "bad network name", SMB protocol-mismatch) into specific human-readable remediation hints. No retry; connection test is on-demand only, admin-triggered.

## MicrosoftGraphStorageProperties config surface (`app.microsoft-graph.*`)
`baseUrl`, `tenantId`, `clientId`, `clientSecret`, `siteId`, `driveId`, `libraryFolder` (default `"EQMS"`, legacy alias `folderPath`), `shareLinkScope` (default `"organization"`), `externalInviteRedirectUrl`. This backs the real SharePoint sync path only; `MicrosoftGraphOfficeOnlineService` uses a separate `OfficeOnlineConfigurationService`-sourced config whose exact field list was not read this pass (`UNKNOWN` whether it duplicates or diverges from these properties).

## Cross-cutting note
Only one external integration has a circuit breaker: Microsoft Graph — Office Online editing
(`MicrosoftGraphOfficeOnlineService`, see above) has a custom, non-Resilience4j, in-memory,
per-instance one. Every other integration traced (MinIO, Microsoft Graph SharePoint file sync,
SMTP, NAS/SMB) is either a synchronous call that throws straight through with no breaker, or an
async worker that swallows and logs. The **only** place with genuine retry logic anywhere in the
codebase is the Controlled Copy batch async services (see `19-error-retry-recovery.md`), which is
retry against a **transient concurrency conflict on the local database**, not against any of the
external systems listed here.
