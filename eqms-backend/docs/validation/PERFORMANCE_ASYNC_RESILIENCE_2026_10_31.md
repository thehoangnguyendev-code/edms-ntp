# API and asynchronous processing performance change record

Status: implemented subset validated; remaining audit recommendations are listed below.
Not a compliance or release sign-off.

## Request and decisions

The owner accepted implementation of the performance audit recommendations on 2026-10-31.
The owner additionally selected continued Publish execution from a persisted signing confirmation,
and explicitly authorized the HIGH-impact change to signature-token consumption, limited to the
confirmed Publish job. Existing JWT tokens must remain single-use for all other operations.
The owner separately authorized the HIGH-impact change to `NotificationDispatcher.dispatch`
(16 indexed direct callers) to move policy-driven SMTP delivery to a DB outbox while preserving
the recipient/policy/content/in-app behavior.

Decision reference: `PERFORMANCE-PUBLISH-SIGNED-INTENT-2026-10-31` in the decision log.

## Invariants

- Actor: publishing/report workers re-resolve the requesting user and current permissions; no
  increase in object scope. Notification recipients remain the policy-resolved event recipients.
- Lifecycle: existing parent/revision guards and related-document publication rules remain enforced.
- Artifacts: a confirmed publication must bind the source/preview/template versions and request;
  changes must invalidate the intent. An expired worker cannot publish a newer attempt's artifact.
- Signature: no password or reusable/raw signature JWT is persisted in a job. A durable intent is
  limited to its exact job, actor and content; a different operation cannot consume it.
- Audit: acceptance and signing confirmation must be committed together; publication evidence and
  terminal job state must be committed with the business result, not inferred from UI success.
- Async: preserve bounded concurrency, avoid scheduler/request threads doing report rendering,
  use owner-checked renewals and DB attempt fencing; Redis failure remains fail-closed when
  distributed locking is enabled. Its existing explicitly disabled, single-instance mode is unchanged.
- Realtime: notifications contain only IDs. Hidden/offline pages defer refresh, then query the same
  authorized APIs on return. Scope filters are unchanged.

## Source and tooling limitations

The instructed `docs/system/` evidence set and `08_ONE_CHANGE_RECORD_TEMPLATE.md` were absent in
this checkout. This record uses inspected source and targeted tests; missing documentation is
not replaced by an inferred requirement. The initial frontend GitNexus index returned corrupted symbol
paths; the repaired root `edms-ntp` index now resolves source paths. Manual caller inspection
supplements indexed results. No compliance claim is made.
GitNexus `detect-changes` was attempted with both `scope=compare,base_ref=main` and `scope=all`
on the backend index; it returned "No changes detected" despite known working-tree changes.
Those early empty results were not evidence that the scope was safe. The later root-index
`detect_changes --scope compare --base-ref main` and `--scope all` successfully found changed
symbols and flows, including unrelated changes already present in the shared workspace. Manual
diffs distinguish this record from Training/UI work. Raw tool output remains under ignored target/.

## Implemented so far

- Report worker dispatches through a dedicated bounded executor, leaving scheduler threads free.
- Global Redis lease renewal checks ownership; lease loss stops the worker claiming more jobs.
- Per-run DB heartbeat is fenced by run/attempt/status/unexpired lease. Existing artifact publisher
  still performs its own transactional fencing and authorization checks.
- HTTP latency histograms and p50/p95/p99 use Spring's URI-template metrics, with no new public endpoint.
- Realtime refreshes deduplicate repeated entity changes and wait while the tab is hidden/offline.
- Policy emails are inserted in the dispatch transaction. SMTP runs on a separate bounded worker,
  with atomic `SKIP LOCKED` claims. Mandatory events bypass digest/quiet-hours as before and have
  priority over the optional backlog. Existing tracked SMTP retries/manual retry behavior remains.
  Interrupted/ambiguous sends become UNKNOWN, visible in the failure centre/queue metrics, and
  are not automatically replayed by the outbox. This does not establish exactly-once SMTP delivery.
- Event and scheduled Controlled Copy distribution use the same transactional compare-and-set claim;
  recovery dispatches onto the executor instead of bypassing `@Async`. Failed-item retries also claim
  their job before work. Existing lifecycle finalization/terminal-state handling is preserved.
- Publishing/preview requests are persisted with no raw signature JWT. Publishing acceptance consumes
  the JWT once and records a durable confirmation, actor snapshot and content binding in one transaction.
  New commands are immutable at DB level. The worker uses a separate, internal typed Publish authorization;
  the generic JWT validator has no durable-intent bypass. Related documents, participants, content,
  source versions, templates/styles and signature settings are bound. VIEW bookkeeping is excluded.
- Job execution holds an exclusive DB row lock, and publication/terminal job completion share a transaction.
  A crashed transaction leaves the durable command QUEUED; two workers cannot execute it simultaneously.
  Existing jobs without persisted commands are not replayed or assigned reconstructed signature authority.
- The per-transaction signature-consumption cache is unbound at completion so the same pooled thread
  cannot accidentally authorize a subsequent transaction from an earlier transaction's cache.
  Suspension/resumption also isolates a REQUIRES_NEW transaction from the outer transaction's token.
- Lightweight, object-authorized polling follows the accepted job ID. Timeout/403/latest-job changes
  cannot be reported as a successful Publish. Polls no longer load/read the whole workspace/PDF.
- Document author lookup searches at the server (initial 30, up to 10 selected active people retained).
  Searching people no longer reloads every dictionary. Request cancellation is caller-owned; shared
  request deduplication remains for other consumers. Database query cancellation is not claimed.
- The document search fetch effect follows committed URL search only, eliminating the extra old-query
  request when debounce completes. Old requests are aborted; latest-result protection remains.

## Evidence and remaining work

- Backend: 105 passing selected tests across the command/database, signature, report lease/publisher,
  revision business rules, copy claim/scheduler, notification policy/outbox and people lookup tests.
  See `PublishingCommandDatabaseTest`, `ConfirmedPublishSignatureTest`, `PublishingJobStatusScopeTest`,
  `NotificationEmailOutboxDatabaseTest`, `SignatureTokenConsumptionServiceTest`, `ReportJobWorkerTest`,
  `ReportRunLeaseServiceTest`, `DistributedSchedulerLockServiceTest`, `RevisionBusinessRulesTest`,
  `ReportArtifactPublisherFailureTest`, `ControlledCopyBatchDistributionAsyncServiceTest`,
  `NotificationDispatcher*Test`, `DocumentFilterAuthorLookupTest` and `AsyncResilienceContextTest`.
- Frontend: 1,137/1,137 tests across all 217 suites pass, including 50/50 in ten selected
  performance suites (search/cancellation, URL/tab isolation, lookup API, compact filters, document
  columns, realtime and Publish completion). TypeScript passes. Seven stale mocks were updated for
  the optional AbortSignal argument; one unrelated Training test now matches its existing button
  label case-insensitively. No Training business implementation was changed for these test fixes.
- DB concurrency/rollback/restart tests use disposable PostgreSQL on localhost:55439 and random schemas.
  The full application context starts on the disposable DB. The pre-existing demo `NotificationBootstrap`
  assumes sample users exist and fails on a new DB; the context smoke mocks only this demo runner.
  It does not prove the demo bootstrap or a complete fresh-install user workflow.
  Migrations V706 through V715 were exercised on the disposable database/schema fixtures.
- Sanitized test summary: `evidence/performance_2026_10_31/summary.json`; raw Maven reports/logs remain
  under the ignored `target/` directory and are not copied into source control.
- Generated PDF/OnlyOffice/MinIO publication and multi-instance SMTP outcomes have not been validated
  end-to-end with real documents. No production throughput/p95 improvement percentage is claimed.
- Wider audit limits: non-policy mail outside fenced Controlled Copy delivery and DCO ZIP attachment
  mail retain their existing delivery semantics. Fifteen direct table fetchers forward abort signals;
  wrapped Training/Report fetchers still need explicit forwarding for transport cancellation, though
  stale results are ignored and table rows remain during refetch. Report artifact downloads use the
  verified stream; other byte-array download endpoints are unchanged. Browser abort does not establish
  cancellation of the database query already executing on the server.
- Shared runtime observation: backend Docker was restarted outside this tool run while work was in progress;
  the development DB had V706 through V709 installed. All four checksums match their current source files
  (-1158555795, -348411542, -1503013618, -1843888321 respectively). V706 was kept byte-for-byte compatible
  after it was found applied; actor context and immutability were added as later migrations, not Flyway repair.
  The container reported healthy; unauthenticated actuator health returned 403. No application data was deleted.
- No Git commit/push was issued. After the owner confirmed the concurrent updater had finished,
  backend/frontend Docker images were rebuilt and the two services recreated with `--no-deps`.
  Backend is healthy and shared DEV Flyway reports V714/V715 successful. Existing legacy PROCESSING
  rows were not reset or replayed by migration. The dedicated outbox key is present (value omitted).
  This operational smoke is separate from the isolated automated test evidence.

## Continuation: fenced distribution, verified downloads and shared tables

Decision `PERFORMANCE-CC-FENCED-RECOVERY-2026-10-31`: the owner explicitly chose to retain
legacy PROCESSING jobs without ownership metadata for DCO reconciliation, and auto-recover
new jobs. The owner also authorized the shared `useServerTable` CRITICAL scope (34 indexed
direct callers, two affected process entry points) while preserving permissions/server queries.

- New V714 claims use a random worker token, protocol and expiring lease. Event, scheduler and
  manual retry use the same atomic claim. A per-copy transaction holds the job fence and parent/
  child locks through file finalization, copy update, item outcome and primary email enqueue.
  The current active actor and batch permission/object scope are checked at execution, including
  failure restoration. Obsoleted/terminal parents or copies are skipped. An expired worker cannot
  restore or complete a newer attempt. Recovery keeps the accepted actor; explicit retries use the
  current retry actor. No signature authority is reconstructed.
- Scoped legacy primary recipient email now renders/enqueues in that transaction, without SMTP.
  A render/enqueue error propagates and rolls the copy transaction back. Preferences, templates,
  recipients and usage-count semantics are preserved. Actual SMTP uses the existing outbox worker;
  UNKNOWN outcomes still require reconciliation. Template usage errors after a successful SMTP
  send do not trigger another delivery. DCO ZIP remains best effort after job completion.
- Report HTTP download retains run/artifact ownership, current snapshot authorization, purged/
  expiry checks and mandatory audit. It reads source in 64 KiB chunks into a private disposable
  spool, verifies SHA-256 fully, then streams that same file. No unverified bytes are returned.
  Concurrent prepared transfers default to 4 and a per-file spool limit of 256 MiB; overflow fails
  closed. MVC completion, stream errors and shutdown close resources; an age-based janitor removes
  abandoned copies only after acquiring their file lock. Original MinIO/local source and WORM
  retention are never deleted. Endpoint/method and FE Blob contract are unchanged. The audit means
  authorized/checksum verified, not proof of complete receipt by the client.
- Shared table hook distinguishes initial loading from background fetching, retains rows during
  search/sort/page refresh and aborts old request signals on cleanup. It still clears rows on a
  current request error and suppresses stale responses/errors. Thirteen dictionary/education/name-
  format/My Training adapters plus two session/grant adapters forward the signal to Axios separately
  from query params. Optional signal preserves existing callers; wrapped adapters are not claimed
  to abort their transport until wired. No filter/sort/pagination was moved into the frontend.
- Additional evidence: `ControlledCopyWorkerFencingDatabaseTest` (7),
  `ControlledCopyFencedDispatchTest` (2), `ControlledCopyDeliveryScopeTest` (3),
  `VerifiedDownloadServiceTest` (4), `VerifiedDownloadResponsesTest` (2),
  `ReportDownloadScopeTest` (4); FE hook cancellation and URL/tab-isolation tests plus thirteen
  parameterized API forwarding cases. The complete selected regression totals are in summary.json.
  These deterministic tests establish the simulated claim/rollback/checksum/authorization cases,
  not real multi-node SMTP delivery or a full business acceptance run.


### Email content protection (owner-approved continuation)

- `NotificationEmailCipher` uses AES-256-GCM with independent 96-bit random nonces and a 128-bit
  authentication tag. AAD binds each ciphertext to its queue UUID/recipient/event/domain. V715
  records the encryption protocol; newly enqueued subject/body fields contain placeholders and
  the payload holds an encrypted envelope. The plaintext credential is not inserted into the new
  outbox rows. Existing unencrypted rows keep their rollout reader; no historical evidence is deleted.
- A dedicated 32-byte Base64 key is mandatory (`APP_NOTIFICATIONS_OUTBOX_ENCRYPTION_KEY`; Compose
  source variable `NOTIFICATION_OUTBOX_ENCRYPTION_KEY`). The DEV key was securely generated into
  ignored root `.env`; no key value is copied into documentation, tool output, Git or test reports.
  Every backend instance must use the same key. Retain/back up the key with access restrictions:
  losing/replacing it makes existing encrypted messages unreadable; rotation is not implemented.
  Blank examples are provided for DEV/TEST/PROD. No JWT or signing key is reused.
- Missing/invalid configuration blocks startup. A wrong key, unsupported encryption version or
  tampered binding blocks SMTP and marks UNKNOWN for manual reconciliation with safe failure
  metadata. Existing failure-payload sanitation removes password/token/secret keys. Cipher errors
  do not echo the input key or plaintext content. Tests cover nonce uniqueness, round trip,
  wrong key, recipient/ID/event substitution, ciphertext at rest, legacy delivery and rollback.


### Follow-up defect: Degree Levels empty after request cancellation

- Runtime-confirmed on 2026-10-31: the authenticated Degree Levels page showed an empty state;
  browser console recorded Axios CanceledError. Shared GET deduplication reused the promise whose
  caller signal had just been aborted during an effect cleanup/remount. No degree-level records
  were deleted and no data-filter/authorization change was needed.
- `requestOnceGet` now isolates caller-cancellable GETs from the shared promise map and response
  cache, using the same authenticated Axios instance/interceptors. Ordinary GET deduplication
  remains unchanged. This also covers other signalled dictionary/education table adapters.
  GitNexus impact: LOW, one indexed direct caller, six upstream hits. No BE, DB, permission,
  workflow, audit or signature behavior was changed by this defect fix.
- Added real Axios-adapter regression cases for an immediate abort/remount, independent concurrent
  callers and preserved non-cancellable GET deduplication. The four selected suites pass 22/22;
  TypeScript passes. Frontend Docker was rebuilt/recreated. Browser verification on the existing
  signed-in tab shows all eight Degree Levels (1–8 of 8), including Đại học/Thạc sĩ/Tiến sĩ.
  Full FE result above predates this follow-up; it is not claimed as a rerun after this small fix.
