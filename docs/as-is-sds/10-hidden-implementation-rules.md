# 10 — Hidden / Implementation-Discovered Rules (running ledger)

Aggregated from module traces so far. Full citations live in the source files (`06`, `08`); this is an index for quick scanning.

1. **Co-Author can edit but never upload/replace the controlled source file** (`DocumentAuthorizationService.canUploadRevisionSource`) — `06-role-authorization-model.md` §6.3.
2. **SYSTEM_SUPER_ADMIN is not exempt from Controlled Copy SoD checks** (`ControlledCopyAuthorizationService.evaluateInternal`) — `06` §6.3.
3. **Anonymous token-based Controlled Copy preview/download** bypasses EQMS login/permission entirely, trust boundary = possession of `accessToken` + preview password — `06` §6.3.
4. **Reviewer/Approver action is strict FIFO by `sequenceOrder`**, not "any assigned reviewer may act" — `06` §6.3, `08` §8.4b.
5. **Cancel requires no e-signature; Obsolete does** (Document level) — asymmetric GMP control — `08` §8.2/8.3.
6. **Document Cancel is only legal when zero revisions exist at all** (any status) — `08` §8.2.
7. **Document Obsolete cascades to (a) all non-terminal revisions and (b) all DISTRIBUTED/READY_FOR_DISTRIBUTION controlled copies, via two independent code paths** rather than shared logic — duplication risk — `08` §8.4c.
8. **`RevisionWorkflowAction.OBSOLETE` and the `OBSOLETED`-target branch of `updateRevisionStatus` are both dead code** — no caller anywhere; revision-obsolete only ever happens as a side effect of publish-supersede or document-obsolete — `08` §8.4c.
9. **`RevisionSnapshotAsyncService`/`RevisionSnapshotEvent` are dead code**; real snapshot regen is synchronous and silently swallows exceptions (`log.warn` only) — `08` §8.4d.
10. **`uploadRevisionFile` bypasses the hybrid authorization engine**, using legacy permission helpers instead of the defined `UPLOAD_SOURCE` workflow action — `08` §8.4d.
11. **Controlled Copy: Distributed copies can never be cancelled** — batch cancel silently filters them out as ineligible rather than failing — `08` §8.4.
12. **Controlled Copy recall's async finalize has no terminal-state guard**, unlike distribute's and cancel's — asymmetric concurrency safety net — `08` §8.4, `12-transaction-concurrency.md`.
13. **Controlled Copy `status`/`statusCode`/`currentStage` can diverge** — a dedicated `ControlledCopyBatchStatusDiscrepancy` entity + hourly scanner exists specifically because these three fields are set by multiple independent code paths (one shared helper for normal `ControlledCopyService` transitions, but separate inline pairs in `RevisionService`'s revision-obsolete cascade and in the batch entity everywhere) — the scanner is deliberately read-only/non-self-healing — `08` §8.4/§8.4.3.
14. **Printing (single-copy) and preview/download-quota consumption use atomic conditional bulk UPDATEs**, not optimistic-lock-guarded Java mutation — deliberate concurrency-safe design for quota enforcement — `08` §8.4.1, `12`.
15. **A Document Sub-Type change with no `reviewerUserIds` in the request re-validates existing reviewers against the new Sub-Type's requirement** and fails the save on mismatch — `08` §8.5.
16. **Templates cannot have `requiresTraining` re-enabled** even via direct request while ACTIVE — forcibly nulled — `08` §8.5.
17. **`updateActiveWorkflowConfiguration` metadata changes run through a parallel "shadow" authorization engine** in addition to the normal check, specifically for `UPDATE_METADATA` — evidence of an in-progress authorization-engine migration — `08` §8.5.
18. **Workflow role catalog (`WorkflowRole`) is descriptive/assignable metadata only** — real authorization is 100% permission-code + policy-engine driven; role *names* shown in the UI do not themselves grant access — `06` §6.0 (architectural headline finding).

## Added from domain-model, storage, async, notification, audit, e-signature passes
19. **Controlled Copy `statusCode` is not FK-enforced** against its lookup table (unlike Document/Revision) — root cause of the discrepancy-scanner's existence. Structural, not itself a defect (`05-data-model.md`).
20. **No unique constraint on `(document_id, revision_number)`** — the DB does not structurally prevent two revisions of one document sharing a revision number (`05-data-model.md`).
21. **`ControlledCopyDistributionBatch` has no `@Version`/optimistic-lock field** at all, unlike Document/Revision/ControlledCopy — consistent with why Batch relies entirely on async re-fetch + explicit terminal-state checks (`05`, `12`).
22. **Storage "providers" for AWS S3/Azure/GCP/Drive/OneDrive/SharePoint(generic)/Dropbox are simulated only** — no real SDK client exists; selecting them in admin config silently writes to a local directory instead (`17-file-storage.md`). Materially significant, flag for Decision Log.
23. **MinIO deletion is unconditionally disabled** (`delete()`/`deletePrefix()` always throw) — deliberate WORM/GMP design, the strongest schema-level enforcement of "never delete" found anywhere (`17`).
24. **`RevisionSharePointSyncWorker` has no optimistic-conflict check against the Graph item's own version** before writing back — a concurrent Office-Online co-authoring sync could have a stale write silently win (`17`).
25. **Three independent "async event" mechanisms were built but never wired to a publisher**: `RevisionSnapshotEvent`, `AsyncEmailRequestedEvent`, `MfaOtpEmailRequestedEvent` — all have live listener beans but zero construction sites (`13-async-scheduler-events.md`). This is now a confirmed *pattern*, not an isolated occurrence.
26. **No `AsyncUncaughtExceptionHandler` or custom `RejectedExecutionHandler`** configured on any of the four dedicated thread pools — overflow/uncaught-async-exceptions fall to Spring defaults (`13`).
27. **`ControlledCopyExpiryScheduler`'s 7-day reminder bypasses the `NotificationDispatcher` policy engine entirely**, unlike every other notification in the system, despite a matching catalog event (`controlled_copy.expiring_soon`) existing for exactly this purpose (`14-notifications.md`).
28. **Five+ QF-referenced notification types have no confirmed live trigger**: Author/Co-Author assignment, Periodic Review due, Document Valid-Until 7-day/1-day expiry, Controlled Copy Request, plus four catalog-defined-but-never-fired event codes (`14`).
29. **Audit trail and e-signature immutability are convention-based, not DB-enforced** — no delete/update call sites exist in the service layer, but the repositories technically still expose inherited delete methods, and no DB trigger/constraint was found blocking mutation (`15-audit-trail.md`, `16-electronic-signature.md`).
30. **E-signature is password-only by hardcoded design** (`AUTHENTICATION_METHOD="PASSWORD"`, never configurable), and `MFA_DISABLED=true` is hardcoded — meaning the two 21 CFR 11.200(a) signature components currently reduce to the same factor (password) reused across login and signing (`16`). Flagged for Decision Log, not a code defect.
31. **No re-authentication-after-idle-break gate feeds into the signature flow** — `verifySignature` only checks password correctness at the moment of signing, not session idle time (`16`).
32. **Legacy `EmailNotificationService` template path can potentially double-send email** for policy-managed events (calls both the legacy template lookup and, internally, the policy dispatcher) — flagged UNKNOWN, not confirmed (`14`).

Pending confirmation / follow-up needed before finalizing severity: items 7, 8, 9, 22, 25, 27, 28, 30 in particular should be raised as explicit questions to the team (per CLAUDE.md's Decision Log guidance) rather than assumed defects — several may be intentional UI scoping or roadmap/deferred-feature decisions.
