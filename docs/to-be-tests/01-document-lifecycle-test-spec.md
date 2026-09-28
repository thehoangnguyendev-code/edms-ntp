# Test Specification — Document Lifecycle (TO-BE)

Source of truth: `docs/to-be-sds/01-document-lifecycle.md` (human-approved). This is a **test design document only** — no application code or test code is created here. Human decisions on Reason validation and `documentLifecycleActions.ts` scope (see prompt) are treated as closed and are reflected directly in the test cases below; no further clarification is requested for those two items.

---

## 1. Scope

Covers all 18 TO-BE rules (TBR-DOC-001–018) from the approved Document Lifecycle specification: Create, Draft Edit, DRAFT→ACTIVE Activation, Cancel, Obsolete (preconditions, success, cascade), the canonical Controlled-Copy-obsolescence operation, transaction rollback, concurrency, the frontend capability contract (including the two-view consistency requirement), stale-state recovery, and notification on Obsolete.

Out of scope (per the TO-BE spec's own scope boundary, carried into this test spec): Document Revision's own workflow correctness (Submit/Review/Approve/Train/Publish/Reject/Upgrade) beyond what is needed to set up Revision state as a precondition/dependency; Controlled Copy's own workflow correctness beyond verifying it as a cascade target; any test of `documentLifecycleActions.ts` call sites outside `NewDocumentView.tsx` (per the closed scope decision).

## 2. Test Strategy

- **Integration-first for lifecycle/transaction/cascade/concurrency behavior**, per the mandate not to rely only on mocked unit tests for: transaction atomicity, optimistic locking, concurrent Revision-state change, database-current-state revalidation, and notification failure isolation. These use a real (or containerized) PostgreSQL instance and real Spring transaction boundaries — not an in-memory/mocked `EntityManager`.
- **Unit tests** are used only for pure validation logic (Reason normalization: null/empty/whitespace/trim) and frontend gating-logic assertions that don't require a live backend.
- **API-level tests** exercise the real controller endpoints (`DocumentController`) to verify HTTP status codes and machine-readable error codes as observed by a client — not just the service-layer exception type.
- **Concurrency tests** use two real, independently-committing transactions/threads (or two separate test-harness sessions against the same database), never two calls sharing one `EntityManager`/persistence context, to satisfy the TO-BE requirement that the final re-validation reads genuinely fresh persisted state.
- **Frontend tests** exercise the two Document views (`DetailDocumentView.tsx`, `NewDocumentView.tsx`) against a controlled/mocked capability API response, asserting on rendered action availability and on refetch behavior after simulated 403/409/410 responses.
- Every test case traces to at least one TBR-DOC rule and at least one acceptance criterion from the TO-BE spec (§14 there). No test asserts behavior not stated in the approved TO-BE document.

## 3. Test Data Model

Minimal fixture set reused across test cases (built via existing bootstrap/test-data-builder patterns, not invented here):

| Fixture | Description |
|---|---|
| `DOC_DRAFT_NO_REV` | Document in `DRAFT`, zero Revisions. |
| `DOC_DRAFT_WITH_ORIGINAL_REV_NO_FILE` | Document `DRAFT`, one original Revision (`parentRevision=null`) with no source file stored yet. |
| `DOC_ACTIVE_ONE_EFFECTIVE_REV` | Document `ACTIVE`, exactly one Revision, `EFFECTIVE`, no other Revisions in progress. |
| `DOC_ACTIVE_NO_EFFECTIVE_REV` | Document `ACTIVE`, Revisions exist but none `EFFECTIVE` (e.g., all `OBSOLETED`/`CLOSED_CANCELLED`). |
| `DOC_ACTIVE_REV_IN_<STATUS>` | Parametrized: Document `ACTIVE` with one `EFFECTIVE` Revision plus a second Revision in `DRAFT` / `PENDING_REVIEW` / `PENDING_APPROVAL` / `PENDING_TRAINING` / `READY_FOR_PUBLISHING` (five variants). |
| `DOC_ACTIVE_WITH_CC_READY` | `DOC_ACTIVE_ONE_EFFECTIVE_REV` plus one Controlled Copy `READY_FOR_DISTRIBUTION` on that Revision. |
| `DOC_ACTIVE_WITH_CC_DISTRIBUTED` | Same, but the Controlled Copy is `DISTRIBUTED`. |
| `DOC_ACTIVE_WITH_CC_TERMINAL` | Same, but the Controlled Copy is `OBSOLETED` or `CLOSED_CANCELLED` (must remain untouched by any cascade). |
| `USER_AUTHORIZED_<ACTION>` | Users holding exactly the permission needed for a given action (create/edit/cancel/obsolete), no more. |
| `USER_UNAUTHORIZED` | User lacking the relevant permission, otherwise valid session. |
| `VALID_SIGNATURE_TOKEN` / `MISSING_SIGNATURE_TOKEN` / `EXPIRED_SIGNATURE_TOKEN` / `CONSUMED_SIGNATURE_TOKEN` | For e-signature test cases on Obsolete. Current, verified system semantics (`DocumentService.requireValidSignatureToken`, `SignatureTokenConsumptionService.requireAndConsume`): missing/blank token → `IllegalArgumentException` → **HTTP 400**; invalid/expired token (JWT parse failure) → `UnauthorizedException("Electronic signature is invalid or expired")` → **HTTP 401**; already-consumed/replayed token → DB constraint violation translated to `UnauthorizedException("This electronic signature has already been used and cannot be reused")` → **HTTP 401**. These are the existing, established codes reused by the tests below — no new HTTP code is introduced. |
| `NOTIFICATION_DISPATCH_FORCED_FAILURE` | Test harness hook/stub causing the email-send step of a policy-driven notification to throw, to exercise `EmailNotificationService.recordDeliveryFailure` without a real SMTP dependency. |
| `REASON_NULL` / `REASON_EMPTY` / `REASON_WHITESPACE` / `REASON_VALID("  text  ")` / `REASON_AT_MAX_LENGTH` / `REASON_OVER_MAX_LENGTH` | Reason-field fixtures per the closed validation decision. `REASON_AT_MAX_LENGTH`/`REASON_OVER_MAX_LENGTH` use whatever the **existing** persisted column/DTO length constraint is (to be read from the current entity/DTO definition at implementation time — this test spec does not invent a number; see §12 error-semantic tests). |

## 4. Positive Tests

| Test ID | Group | Summary |
|---|---|---|
| TC-DOC-001 | A | Create Document with valid fields → `DRAFT`. |
| TC-DOC-005 | B | Authorized actor edits a `DRAFT` Document → fields persisted, still `DRAFT`. |
| TC-DOC-006 | B | Sub-Type change with a **consistent** existing reviewer set → accepted. |
| TC-DOC-008 | C | Upload source file for the initial original Revision of a `DRAFT` Document → Document becomes `ACTIVE`. |
| TC-DOC-014 | D | Cancel a zero-Revision Document with a valid trimmed Reason → `CLOSED_CANCELLED`. |
| TC-DOC-020 | D | Reason `"  Discontinued per QA  "` → stored value is the trimmed text `"Discontinued per QA"`, not a default. |
| TC-DOC-034 | F | Obsolete with a valid, unconsumed signature token → succeeds. |
| TC-DOC-035–041 | F | Obsolete cascade: Document/Revision/Controlled-Copy state and reason-code assertions (see §8). |
| TC-DOC-043–044 | G | Canonical operation invoked with the correct reason code from each of its two confirmed live callers (Document Obsolete → `DOCUMENT_OBSOLETED`; Revision publish-supersede → `NEW_REVISION_PUBLISHED`). |
| TC-DOC-045 | G | **Corrected**: verifies only that the canonical operation's reason-code **contract** (parameter/enum) accepts and preserves `REVISION_OBSOLETED` as a valid value (e.g., calling the operation directly with that reason code persists it correctly on the resulting Controlled-Copy audit entry). Does **not** require or create a live third caller, and does **not** introduce a manual Revision-Obsolete endpoint/action — per TO-BE scope, only Document Obsolete and Revision publish-supersede are confirmed live callers. |

## 5. Negative Tests

| Test ID | Group | Summary |
|---|---|---|
| TC-DOC-007 | B | Edit attempted while Document is not `DRAFT` → rejected per existing state-guard rule. |
| TC-DOC-013 | C | Source-file storage fails (e.g., validation/malware-scan rejection) → Document remains `DRAFT`, no activation, no new audit entry. |
| TC-DOC-017 | D | Reason = `null` → rejected. |
| TC-DOC-018 | D | Reason = `""` → rejected. |
| TC-DOC-019 | D | Reason = `"   "` (whitespace-only) → rejected. |
| TC-DOC-021 | D | Regression: verify no code path substitutes a default `"Document cancelled"` string when Reason is invalid — the request must be rejected, not auto-corrected. |
| TC-DOC-022 | D | Reason exceeding the existing schema/DTO max length → rejected per the **existing** constraint (no new limit invented). |
| TC-DOC-023 | D | Cancel attempted on a Document that already has a Revision → rejected. |
| TC-DOC-026–032 | E | Each of the seven Obsolete precondition violations individually rejected (Document not ACTIVE; no EFFECTIVE Revision; Revision in each of the five in-progress statuses). |
| TC-DOC-033 | F | Obsolete attempted with a **missing** signature token → rejected (HTTP 400, existing semantics). |
| TC-DOC-070 | F | Obsolete attempted with an **expired** signature token → rejected (HTTP 401, existing semantics). |
| TC-DOC-071 | F | Obsolete attempted with an **already-consumed/replayed** signature token → rejected (HTTP 401, existing semantics). |

For all three of TC-DOC-033/070/071: Document remains `ACTIVE`; no Revision or Controlled Copy is mutated; no Document-Obsolete audit entry is created; no `ElectronicSignature` row is created for the failed attempt.

## 6. Authorization Tests

| Test ID | Group | Summary |
|---|---|---|
| TC-DOC-004 | A | `USER_UNAUTHORIZED` attempts Create → 403, no Document created, no audit entry. |
| TC-DOC-068 | D | `USER_UNAUTHORIZED` attempts Cancel on an otherwise-eligible Document → 403, Document unchanged. |
| TC-DOC-069 | F | `USER_UNAUTHORIZED` attempts Obsolete on an otherwise-eligible Document → 403, Document unchanged, no signature consumed. |

Authorization gate for all three remains the existing permission-code + policy-engine model (`requireDocumentMasterLifecycleAction` or its TO-BE equivalent) — these tests assert the **existing** authorization boundary is still enforced after the TO-BE changes, per TBR-DOC-001/005/009 classification `KEEP`. No new authorization rule is introduced or tested here.

## 7. Audit / Signature Tests

| Test ID | Group | Summary |
|---|---|---|
| TC-DOC-002 | A | Create produces exactly one `CREATE` audit entry (fromStatus `null` → `DRAFT`). |
| TC-DOC-003 | A | Create requires no electronic signature (no `ElectronicSignature` row created). |
| TC-DOC-010 | C | Activation audit entry contains: Document ID, `DRAFT`, `ACTIVE`, triggering Revision ID, actor, timestamp, reason text ("initial revision source uploaded" or equivalent approved wording). |
| TC-DOC-011 | C | Activation requires no electronic signature. |
| TC-DOC-012 | C | Repeating the upload path against an already-`ACTIVE` Document (e.g., uploading to a second original-lineage Revision, or retrying the same call) produces **no additional** Document-status audit entry and **no** further status mutation (idempotency). |
| TC-DOC-015 | D | Cancel requires no electronic signature. |
| TC-DOC-016 | D | Cancel audit entry's reason field exactly equals the actor-entered (trimmed) text — never the AS-IS default fallback string. |
| TC-DOC-041 | F | Obsolete produces audit entries at all three levels: Document (`OBSOLETE`), each cascaded Revision (`OBSOLETE`), each cascaded Controlled Copy (`OBSOLETE`, reason `DOCUMENT_OBSOLETED`). |
| TC-DOC-049 | H | After a forced-failure rollback, **no** audit rows from the failed attempt persist at any level (Document, Revision, or Controlled Copy). |
| TC-DOC-050 | H | After a forced-failure rollback, no `ElectronicSignature` row persists for the failed attempt. |
| TC-DOC-033, TC-DOC-070, TC-DOC-071 | F | Each of the three signature-failure paths (missing/expired/replayed) produces no Document-Obsolete audit entry and no `ElectronicSignature` row (cross-referenced from §5). |

## 8. Transaction / Cascade Tests

| Test ID | Group | Summary |
|---|---|---|
| TC-DOC-009 | C | **Corrected** (was incorrectly implying MinIO participates in the PostgreSQL transaction — it does not; MinIO is an external object store and current WORM policy disables deletion, so no compensation/rollback of an already-written MinIO object can be assumed unless a specific staging/compensation mechanism is verified in the implementation). Scope of this test is strictly the **database** transaction boundary: inject a forced failure in the `uploadRevisionFile`/`createRevisionAndUploadFile` transaction **after** the Document-activation mutation (`activateDocumentAfterInitialSourceStored`) has been applied in-memory/in-transaction but **before** the surrounding database transaction commits. Verify: (a) the Document row remains `DRAFT` after the transaction rolls back (the in-memory `ACTIVE` mutation never reaches the database); (b) the Revision row's database mutation rolls back as applicable (e.g., it does not remain persisted as if the upload succeeded); (c) the new activation audit entry (TBR-DOC-004) does not persist. **Do not assert** that the already-written MinIO object is deleted, reverted, or otherwise rolled back — that is not a database transaction property. **STORAGE FOLLOW-UP / OUT-OF-SCOPE FOR DOCUMENT LIFECYCLE**: if this scenario can leave an unreachable/orphaned WORM object in MinIO after a DB rollback (source file physically stored, but no DB row references it as active), that is a storage-lifecycle concern to be tracked separately — this Document Lifecycle change does not redesign storage compensation/staging and this test spec does not require one to exist. |
| TC-DOC-036 | F | All non-terminal Revisions of the Document → `OBSOLETED`. |
| TC-DOC-037 | F | `READY_FOR_DISTRIBUTION` Controlled Copies of the affected Revision(s) → `OBSOLETED`. |
| TC-DOC-038 | F | `DISTRIBUTED` Controlled Copies → `OBSOLETED`. |
| TC-DOC-039 | F | Controlled Copies already `OBSOLETED`/`CLOSED_CANCELLED` (terminal) are **not** touched (no status write, no new audit entry, no `obsoletedAt` change). |
| TC-DOC-040 | F | Every cascaded Controlled Copy carries `obsoleteReason = DOCUMENT_OBSOLETED`. |
| TC-DOC-042 | F | Positive-path atomicity: Document + all Revision + all Controlled-Copy mutations commit together in one transaction (verified by transaction-boundary instrumentation, not just end-state inspection). |
| TC-DOC-046 | G | The retired AS-IS duplicate implementation (`RevisionService.obsoleteDistributedControlledCopies` as an independent mutator) no longer performs the mutation directly — verified structurally (e.g., the canonical operation is the only code path that sets Controlled-Copy status for this cascade family; a code-level/call-graph check, not just behavioral). |
| TC-DOC-047 | G | Both callers (Document Obsolete, Revision publish-supersede) produce an identical audit-entry shape/effect via the canonical operation, differing only in the reason code. |
| TC-DOC-048 | H | **Core atomicity test**: forced failure injected after the Revision cascade completes but before the Controlled-Copy cascade finishes → Document status change, all Revision status changes, and all Controlled-Copy status changes are fully rolled back; database end-state is identical to the pre-attempt state in every affected table. |

## 9. Concurrency Tests

| Test ID | Group | Summary |
|---|---|---|
| TC-DOC-051 | I | Two independent transactions: Transaction A begins Obsolete and passes its initial precondition check; Transaction B (separate connection/thread) changes a Revision to an in-progress status and **commits**; Transaction A then performs its final pre-commit re-validation → must detect the now-in-progress Revision and fail with 409, not commit. |
| TC-DOC-052 | I | **Fresh-read proof**: the re-validation query in Transaction A is shown to hit the database directly (e.g., via a fresh repository query configured to bypass the first-level/persistence-context cache, or via a query executed on a distinct `EntityManager`/connection from the one used for the initial check) rather than returning a cached/stale in-memory entity reference. Test must fail if the implementation only re-reads the same managed JPA entity instance already held from the initial check. |
| TC-DOC-053 | I | Two concurrent Obsolete attempts on the **same** Document (same initial state) — one succeeds, the other receives an optimistic-lock conflict (`@Version` mismatch) mapped to HTTP 409 `CONCURRENT_MODIFICATION`; the Document ends in a single, consistent `OBSOLETED` state (not double-processed). |

## 10. Notification Tests

| Test ID | Group | Summary |
|---|---|---|
| TC-DOC-061 | L | After successful Obsolete, the Document Author receives a notification event. |
| TC-DOC-062 | L | The DCO/Document Coordinator (permission-equivalent recipient) receives a notification event. |
| TC-DOC-063 | L | The recipient of a Controlled Copy that was `DISTRIBUTED` and became `OBSOLETED` by this action receives a notification event. |
| TC-DOC-064 | L | The recipient of a Controlled Copy that was only `READY_FOR_DISTRIBUTION` (never distributed) receives **no** notification for this action. |
| TC-DOC-065 | L | Notification is dispatched via the existing `NotificationDispatcher` policy engine — verified structurally (no new direct-`EmailService`/ad hoc send path introduced for this workflow). |
| TC-DOC-066 | L | Simulated notification-dispatch failure (e.g., `NotificationDispatcher` throws/returns failure) → the already-committed Document Obsolete transaction (status, cascade, audit, signature) is **not** rolled back. |
| TC-DOC-067 | L | **No longer blocked** (human decision closed this prompt). Verifies the full durable-failure/manual-retry contract using the **existing live mechanism** found by targeted read: `EmailNotificationService.recordDeliveryFailure` persisting a `NotificationDeliveryFailure` row, `NotificationController`'s `GET /notifications/delivery-failures` (admin listing) and `POST /notifications/delivery-failures/{id}/retry` (manual retry via `EmailNotificationService.retryDeliveryFailure`). Steps and assertions: (1) simulate a notification delivery failure (`NOTIFICATION_DISPATCH_FORCED_FAILURE`) during the post-commit Document-Obsolete notification dispatch; (2) assert the Document/Revision/Controlled-Copy lifecycle state, audit entries, and electronic signature from the already-committed Obsolete transaction are unaffected by the failure; (3) assert exactly one `NotificationDeliveryFailure` row is persisted with `status="FAILED"`; (4) assert that row identifies the event/notification type, the recipient, the channel, the error message, and `lastAttemptAt`; (5) assert an authorized operator can retrieve it via `GET /notifications/delivery-failures` and invoke `POST /notifications/delivery-failures/{id}/retry`; (6) assert a successful manual retry updates the same row to `status="RESOLVED"` (confirmed behavior of `retryDeliveryFailure`) **without** re-executing any part of the Document-Obsolete lifecycle transaction (Document/Revision/Controlled-Copy status, audit entries, and signature row counts are unchanged by the retry — only the notification is resent). |
| TC-DOC-072 | L | **New** (per closed human decision, item D/E consequence): if the Document Obsolete transaction itself **rolls back** (e.g., due to the concurrency conflict in TC-DOC-051 or the forced-failure cascade rollback in TC-DOC-048), assert that **no** Document-Obsolete notification work is triggered at all — no policy dispatch call, no `NotificationDeliveryFailure` row, no notification sent — since notification is triggered only after a successful lifecycle commit (TO-BE requirement B). |

## 11. Frontend Capability Tests

| Test ID | Group | Summary |
|---|---|---|
| TC-DOC-054 | J | Given an identical mocked capability response for a Document/user, `DetailDocumentView.tsx` and `NewDocumentView.tsx` render the same Cancel/Obsolete availability (both shown, both hidden, or both disabled — matched pairwise across representative capability states: allowed / not-allowed / loading). |
| TC-DOC-055 | J | `NewDocumentView.tsx` no longer calls `canObsoleteDocumentWithRevisionHistory(...)` as part of computing action availability — verified via a spy/mock on the imported function showing zero invocations during the gating computation (the component may still compile-reference `documentLifecycleActions.ts` for unrelated purposes, but this specific function must not be part of the Obsolete-button-enabled expression). |
| TC-DOC-056 | J | Regression guard: `canObsoleteDocumentWithRevisionHistory` (and `hasEffectiveRevision`, `hasOpenRevisionInProgress`) remain exported and unchanged in behavior, and unrelated call sites (`document-list/types.ts`, `controlledCopyRequest.ts`) continue to compile and behave as before — confirms no global deletion occurred. |
| TC-DOC-057–060 | K | See §11b below. |

### 11b. Frontend Stale-State Recovery

| Test ID | Group | Summary |
|---|---|---|
| TC-DOC-057 | K | Document lifecycle mutation call returns HTTP 403 → frontend immediately refetches Document detail, relevant Revision summary, and lifecycle capabilities. |
| TC-DOC-058 | K | Same mutation returns HTTP 409 → same refetch behavior. |
| TC-DOC-059 | K | Same mutation returns HTTP 410 → same refetch behavior. |
| TC-DOC-060 | K | After the refetch completes, the action buttons re-render to reflect the fresh capability state **without requiring a manual page reload** (e.g., a previously-enabled Obsolete button becomes disabled if the refetched capability now denies it). |

## 12. Error-Semantic Tests

| Test ID | Group | Summary |
|---|---|---|
| TC-DOC-024 | D | After a rejected Cancel (existing-Revision conflict), the Document row is verified byte-for-byte unchanged (status, version, all lifecycle timestamps) compared to its pre-request state. |
| TC-DOC-025 | D | Regression: the existing-Revision Cancel conflict never returns HTTP 500 (asserts the specific status code and that the response body carries `error.code == "DOCUMENT_CANCEL_NOT_ALLOWED"`, not a generic/opaque 500 payload). |
| TC-DOC-026–032 | E | Each precondition violation returns **HTTP 409** with one of the three **final, human-approved** codes: TC-DOC-026 → `DOCUMENT_OBSOLETE_NOT_ACTIVE`; TC-DOC-027 → `DOCUMENT_OBSOLETE_NO_EFFECTIVE_REVISION`; TC-DOC-028 through TC-DOC-032 (the five in-progress Revision statuses) → the **same single shared code** `DOCUMENT_OBSOLETE_REVISION_IN_PROGRESS` (never five separate codes; the response body may additionally carry the specific offending Revision's status for UI messaging). Each also produces no partial lifecycle change (Document/Revision/Controlled-Copy rows all unchanged). |
| TC-DOC-051/053 | I | Concurrency conflicts return HTTP 409 with a machine-readable code (cross-referenced from §9). |
| TC-DOC-033 | F | Missing signature token → **HTTP 400** (`IllegalArgumentException` mapping — existing, established code; no new code invented). |
| TC-DOC-070 | F | Expired signature token → **HTTP 401** (`UnauthorizedException("Electronic signature is invalid or expired")` — existing, established code). |
| TC-DOC-071 | F | Replayed/already-consumed signature token → **HTTP 401** (`UnauthorizedException("This electronic signature has already been used and cannot be reused")` — existing, established code). |

---

## 13. Traceability Matrix

Columns: Test ID → TBR-DOC ID → Acceptance Criterion (AC#, from TO-BE §14) → Test Level → Backend/Frontend → Preconditions (fixture) → Expected Result (summary) → GMP/data-integrity significance.

| Test ID | TBR-DOC | AC# | Level(s) | B/F | Preconditions | Expected Result | GMP significance |
|---|---|---|---|---|---|---|---|
| TC-DOC-001 | 001 | 1 | SERVICE, API | Backend | valid create payload | Document created, status `DRAFT` | Low — record initiation |
| TC-DOC-002 | 001 | 1 | SERVICE, DATABASE | Backend | — | One `CREATE` audit row | **High** — 11.10(e) capture of record creation |
| TC-DOC-003 | 001 | 1 | API | Backend | — | No `ElectronicSignature` row | Low |
| TC-DOC-004 | 001 | — | AUTHORIZATION, API | Backend | `USER_UNAUTHORIZED` | 403, no Document persisted | Medium — access control |
| TC-DOC-005 | 002 | 2 | SERVICE, API | Backend | `DOC_DRAFT_NO_REV` | Fields updated, still `DRAFT` | Low |
| TC-DOC-006 | 002 | 2 | SERVICE | Backend | consistent reviewer set | Update accepted | Medium — SoD/review-requirement integrity |
| TC-DOC-007 | 002 | 2 | SERVICE, API | Backend | `DOC_ACTIVE_ONE_EFFECTIVE_REV` | Edit rejected per existing state guard | Medium |
| TC-DOC-008 | 003 | 3 | INTEGRATION | Backend | `DOC_DRAFT_WITH_ORIGINAL_REV_NO_FILE` | Document → `ACTIVE` | **High** — core lifecycle gate |
| TC-DOC-009 | 003 | 3 | INTEGRATION, DATABASE | Backend | same | Forced failure rolls back the PostgreSQL Document and Revision mutations and the activation audit entry together; no assertion is made about the already-written MinIO object (not part of the DB transaction — see STORAGE FOLLOW-UP note in §8) | **High** — DB atomicity |
| TC-DOC-010 | 004 | 3 | INTEGRATION, DATABASE | Backend | same | Audit row with all 7 required fields | **High** — 11.10(e) |
| TC-DOC-011 | 003 | 3 | API | Backend | same | No signature required/created | Low |
| TC-DOC-012 | 003 | 3 | INTEGRATION | Backend | `DOC_ACTIVE_ONE_EFFECTIVE_REV` + retry | No second transition/audit entry | Medium — idempotency, audit-trail integrity |
| TC-DOC-013 | 003 | — | INTEGRATION | Backend | invalid/malicious file | Document remains `DRAFT`, no audit entry | Medium |
| TC-DOC-014 | 005 | 6 | SERVICE, API | Backend | `DOC_DRAFT_NO_REV`, valid reason | `CLOSED_CANCELLED` | Medium |
| TC-DOC-015 | 006 | 6 | API | Backend | same | No signature required | Low |
| TC-DOC-016 | 007 | 4, 6 | SERVICE, DATABASE | Backend | reason `"  text  "` | Audit reason == trimmed actor text | **High** — 11.10(e) accuracy |
| TC-DOC-017 | 007 | 4 | UNIT, API | Backend | reason = null | Rejected (validation error) | Medium |
| TC-DOC-018 | 007 | 4 | UNIT, API | Backend | reason = "" | Rejected | Medium |
| TC-DOC-019 | 007 | 4 | UNIT, API | Backend | reason = "   " | Rejected | Medium |
| TC-DOC-020 | 007 | — | SERVICE, DATABASE | Backend | reason with padding | Stored value trimmed, preserved exactly | Medium |
| TC-DOC-021 | 007 | 4 | SERVICE | Backend | any invalid reason | No silent default substitution occurs | **High** — data integrity / falsification risk if defaulted |
| TC-DOC-022 | 007 | — | SERVICE, API | Backend | reason at/over existing max length | Accepted at max, rejected over max per existing constraint | Low |
| TC-DOC-023 | 008 | 5 | API | Backend | `DOC_ACTIVE_ONE_EFFECTIVE_REV` (has a Revision) | 409, `DOCUMENT_CANCEL_NOT_ALLOWED` | Medium |
| TC-DOC-024 | 008 | 5 | INTEGRATION, DATABASE | Backend | same | Document row unchanged | **High** — no partial mutation |
| TC-DOC-025 | 008 | 5 | API | Backend | same | Never HTTP 500 | Medium — API contract stability |
| TC-DOC-026 | 009, 010 | 7 | API, INTEGRATION | Backend | Document not `ACTIVE` | 409, `DOCUMENT_OBSOLETE_NOT_ACTIVE`, no partial change | **High** |
| TC-DOC-027 | 009, 010 | 7 | API, INTEGRATION | Backend | `DOC_ACTIVE_NO_EFFECTIVE_REV` | 409, `DOCUMENT_OBSOLETE_NO_EFFECTIVE_REVISION` | **High** |
| TC-DOC-028 | 009, 010 | 7 | API, INTEGRATION | Backend | `DOC_ACTIVE_REV_IN_DRAFT` | 409, `DOCUMENT_OBSOLETE_REVISION_IN_PROGRESS` | **High** |
| TC-DOC-029 | 009, 010 | 7 | API, INTEGRATION | Backend | `DOC_ACTIVE_REV_IN_PENDING_REVIEW` | 409, `DOCUMENT_OBSOLETE_REVISION_IN_PROGRESS` | **High** |
| TC-DOC-030 | 009, 010 | 7 | API, INTEGRATION | Backend | `DOC_ACTIVE_REV_IN_PENDING_APPROVAL` | 409, `DOCUMENT_OBSOLETE_REVISION_IN_PROGRESS` | **High** |
| TC-DOC-031 | 009, 010 | 7 | API, INTEGRATION | Backend | `DOC_ACTIVE_REV_IN_PENDING_TRAINING` | 409, `DOCUMENT_OBSOLETE_REVISION_IN_PROGRESS` | **High** |
| TC-DOC-032 | 009, 010 | 7 | API, INTEGRATION | Backend | `DOC_ACTIVE_REV_IN_READY_FOR_PUBLISHING` | 409, `DOCUMENT_OBSOLETE_REVISION_IN_PROGRESS` (same code as 028–031 — confirms single shared code, not five) | **High** |
| TC-DOC-033 | 011 | 8 | SERVICE, API | Backend | `MISSING_SIGNATURE_TOKEN` | 400, Document remains `ACTIVE`, no audit/signature row | **High** — 21 CFR 11.50/11.70 negative-path integrity |
| TC-DOC-034 | 011 | 8 | SERVICE, API | Backend | valid signature token | Obsolete succeeds | **High** — 21 CFR 11.50/11.70 |
| TC-DOC-035 | 009, 013 | 8 | INTEGRATION | Backend | `DOC_ACTIVE_ONE_EFFECTIVE_REV` | Document `ACTIVE`→`OBSOLETED` | **High** |
| TC-DOC-036 | 012 | 8 | INTEGRATION | Backend | multiple non-terminal Revisions | All → `OBSOLETED` | **High** |
| TC-DOC-037 | 013 | 8 | INTEGRATION | Backend | `DOC_ACTIVE_WITH_CC_READY` | Copy → `OBSOLETED` | **High** |
| TC-DOC-038 | 013 | 8 | INTEGRATION | Backend | `DOC_ACTIVE_WITH_CC_DISTRIBUTED` | Copy → `OBSOLETED` | **High** |
| TC-DOC-039 | 013 | 8 | INTEGRATION | Backend | `DOC_ACTIVE_WITH_CC_TERMINAL` | Copy unchanged | **High** — no incorrect state mutation |
| TC-DOC-040 | 013 | 8 | INTEGRATION, DATABASE | Backend | cascaded copies | `obsoleteReason=DOCUMENT_OBSOLETED` | Medium |
| TC-DOC-041 | 012, 013 | 8, 11 | INTEGRATION, DATABASE | Backend | full cascade | Audit at Document/Revision/Copy levels | **High** |
| TC-DOC-042 | 012, 013 | 8 | INTEGRATION | Backend | full cascade | Single-transaction commit confirmed | **High** — atomicity |
| TC-DOC-043 | 013 | 9 | SERVICE, INTEGRATION | Backend | Document Obsolete path | Canonical op called w/ `DOCUMENT_OBSOLETED` | **High** — dedup verification |
| TC-DOC-044 | 014 | 9 | SERVICE, INTEGRATION | Backend | Revision publish-supersede path (dependency only) | Canonical op called w/ `NEW_REVISION_PUBLISHED` | **High** |
| TC-DOC-045 | 013, 014 | 9 | SERVICE, UNIT | Backend | direct call to canonical op with reason=`REVISION_OBSOLETED` (no third caller created) | Reason code accepted and preserved on the resulting audit entry | Medium |
| TC-DOC-046 | 014 | 9 | SERVICE, UNIT | Backend | code/call-graph inspection | Old duplicate no longer independently mutates state | **High** — divergence-risk closure |
| TC-DOC-047 | 013, 014 | 9 | INTEGRATION | Backend | both callers | Identical audit-entry shape, differing reason code | Medium |
| TC-DOC-048 | 012, 013, 015 | 8 | INTEGRATION, DATABASE | Backend | forced failure mid-cascade | Full rollback, no partial state | **Critical** — GMP atomicity guarantee |
| TC-DOC-049 | 012, 013 | 8 | INTEGRATION, DATABASE | Backend | same forced failure | No orphan audit rows | **High** |
| TC-DOC-050 | 011 | 8 | INTEGRATION, DATABASE | Backend | same forced failure | No orphan signature row | **High** |
| TC-DOC-051 | 015 | 10 | CONCURRENCY, INTEGRATION | Backend | two real transactions | Transaction A fails 409, no commit | **Critical** — GMP concurrency integrity |
| TC-DOC-052 | 015 | 10 | CONCURRENCY, INTEGRATION, DATABASE | Backend | fresh-read proof harness | Re-validation reads DB-current state, not stale context | **Critical** |
| TC-DOC-053 | 015 | 10 | CONCURRENCY, INTEGRATION | Backend | two concurrent Obsolete calls | One succeeds, one 409 `CONCURRENT_MODIFICATION` | **High** |
| TC-DOC-054 | 017 | 12 | FRONTEND | Frontend | identical capability response | Both views render same availability | Medium — UX/consistency, not GMP-critical itself |
| TC-DOC-055 | 017 | 12 | FRONTEND, UNIT | Frontend | `NewDocumentView` render | Helper not invoked for gating | Medium |
| TC-DOC-056 | 017 | — | FRONTEND, UNIT | Frontend | unrelated call sites | Unaffected, still exported | Low — regression guard |
| TC-DOC-057 | 018 | 13 | FRONTEND | Frontend | mutation → 403 | Refetch Document+Revision+capabilities | Medium |
| TC-DOC-058 | 018 | 13 | FRONTEND | Frontend | mutation → 409 | Same refetch | Medium |
| TC-DOC-059 | 018 | 13 | FRONTEND | Frontend | mutation → 410 | Same refetch | Medium |
| TC-DOC-060 | 018 | 13 | FRONTEND, END-TO-END | Frontend | post-refetch | Actions re-render without reload | Medium |
| TC-DOC-061 | 016 | 11 | SERVICE, INTEGRATION | Backend | successful Obsolete | Author notified | Medium |
| TC-DOC-062 | 016 | 11 | SERVICE, INTEGRATION | Backend | same | DCO/Coordinator notified | Medium |
| TC-DOC-063 | 016 | 11 | SERVICE, INTEGRATION | Backend | Distributed copy present | Recipient notified | Medium |
| TC-DOC-064 | 016 | 11 | SERVICE, INTEGRATION | Backend | Ready-for-Distribution-only copy | Recipient NOT notified | Medium — over-notification is itself a data-handling concern |
| TC-DOC-065 | 016 | — | SERVICE | Backend | code inspection | Uses `NotificationDispatcher`, no new direct-send path | Low — architectural conformance |
| TC-DOC-066 | 016 | 11 | INTEGRATION | Backend | simulated dispatch failure | Obsolete transaction remains committed | **High** — lifecycle commit must not depend on notification success |
| TC-DOC-067 | 016 | 11 | SERVICE, INTEGRATION, DATABASE | Backend | `NOTIFICATION_DISPATCH_FORCED_FAILURE` after successful Obsolete | Durable `NotificationDeliveryFailure` row created (recipient/channel/event/error/timestamp), retrievable via `GET /notifications/delivery-failures`, manually retryable via `POST .../retry`, retry marks `RESOLVED` without replaying the lifecycle transaction | **High** — GMP-relevant delivery must be durably tracked, not silently lost |
| TC-DOC-068 | 005 | — | AUTHORIZATION, API | Backend | `USER_UNAUTHORIZED` | 403, Document unchanged | Medium |
| TC-DOC-069 | 009 | — | AUTHORIZATION, API | Backend | `USER_UNAUTHORIZED` | 403, Document unchanged, no signature consumed | Medium |
| TC-DOC-070 | 011 | 8 | SERVICE, API | Backend | `EXPIRED_SIGNATURE_TOKEN` | 401, Document remains `ACTIVE`, no audit/signature row | **High** — 21 CFR 11.50/11.70 |
| TC-DOC-071 | 011 | 8 | SERVICE, API | Backend | `CONSUMED_SIGNATURE_TOKEN` | 401, Document remains `ACTIVE`, no audit/signature row | **High** — 21 CFR 11.70 (signature uniqueness/replay protection) |
| TC-DOC-072 | 016 | 11 | INTEGRATION | Backend | rolled-back Obsolete attempt (from TC-DOC-048 or TC-DOC-051 scenario) | No notification dispatch, no `NotificationDeliveryFailure` row | Medium — prevents notifying about a lifecycle change that never committed |

---

## 14. BLOCKED Tests

**None.** TC-DOC-067 was previously BLOCKED pending a human decision on what "observable/recoverable" notification-failure semantics concretely require. That decision is now closed (this prompt), and a targeted read of the existing codebase found a **fully live, already-wired mechanism** that satisfies it without any new subsystem:

- Entity `NotificationDeliveryFailure` (`recipient`, `notificationType`, `eventDomain`, `channel`, `errorMessage`, `payloadJson`, `attempts`, `createdAt`, `lastAttemptAt`, `status`) — already has every field the human decision requires (recipient/channel/event/error/attempt-timestamp identifiable).
- `EmailNotificationService.recordDeliveryFailure(...)` — already called from every email-send failure path in the service, **including** the policy-driven path used by `NotificationDispatcher` (the same dispatcher TBR-DOC-016 requires Document-Obsolete notifications to use) — confirmed by direct code read of `EmailNotificationService`'s policy-driven send method and `NotificationDispatcher`'s constructor dependency on `EmailNotificationService`.
- `NotificationController`: `GET /notifications/delivery-failures` (admin-only, permission `settings.notification_policy.manage`, paginated) — satisfies "an authorized operator must be able to identify the failed delivery."
- `NotificationController`: `POST /notifications/delivery-failures/{id}/retry` → `EmailNotificationService.retryDeliveryFailure(id)` — already implemented, `@Transactional`, re-sends via the stored template/payload, updates the **same** row's `status` to `RESOLVED` on success or `FAILED` (with incremented `attempts`, capped at 5) on repeat failure — satisfies "the failed delivery must be manually retryable" **without** replaying the original Document-Obsolete lifecycle transaction (the retry only re-sends the notification, it does not re-invoke `DocumentService.obsoleteDocument`).

No additional entity, table, or subsystem needs to be created. The **minimum additional implementation** this TO-BE change requires (recorded here for the eventual implementation pass, not decided or built now) is: ensuring the Document-Obsolete notification call sites (Author, DCO/Coordinator, Distributed-copy recipients) route through the same `NotificationDispatcher`/`EmailNotificationService` path that already populates `NotificationDeliveryFailure` on failure — i.e., no bespoke direct-send call that would bypass this existing tracking. Automatic retry/backoff is explicitly **not** required (human decision D) and is not tested here; only manual retry (already implemented) is verified.

TC-DOC-067 is rewritten in §10/§13 to verify this end-to-end. No other test case in this specification is BLOCKED — all TBR-DOC-001–018 rules had sufficient detail (including the closed human decisions on Reason validation, `documentLifecycleActions.ts` scope, MinIO/DB transaction boundaries, and notification-failure recoverability) to design a concrete test.

## 15. Exit Criteria

This test specification is considered ready for implementation hand-off when:
1. Every TBR-DOC-001–018 rule has at least one mapped test case, and **zero** test cases remain BLOCKED (confirmed in §13 — all 18 rules covered, no BLOCKED entries as of this pass).
2. Every acceptance criterion in the approved TO-BE spec (§14 there, AC# 1–13) has at least one mapped test case.
3. No test case in this document asserts behavior beyond what `01-document-lifecycle.md` approved, or beyond what the current codebase already establishes for signature-error semantics and notification-failure infrastructure (self-check performed during this correction pass: TC-DOC-009 no longer assumes MinIO participates in the database transaction; TC-DOC-045 no longer requires a manual Revision-Obsolete workflow; TC-DOC-033/070/071 assert only the existing, established HTTP codes for signature failures).
4. Test IDs are fully contiguous, TC-DOC-001 through TC-DOC-072, with no gaps (TC-DOC-033 — previously missing — is now defined; TC-DOC-070–072 are newly added at the end).
5. Test-level distribution (§ below, "Report") shows integration/concurrency coverage for every atomicity, optimistic-locking, concurrent-state, and notification-isolation requirement, per the mandate not to rely solely on mocked unit tests for those areas.

---

## Report (corrected, this pass)

- **File created/updated**: `docs/to-be-tests/01-document-lifecycle-test-spec.md`
- **Total test cases**: **72** (TC-DOC-001 through TC-DOC-072, fully contiguous — the previously-missing TC-DOC-033 is now defined, and TC-DOC-070/071/072 are newly added)
- **Number by test level** (a test case may carry more than one level tag, so the sum below exceeds 72):
  - UNIT: 7
  - SERVICE: 23
  - INTEGRATION: 37
  - DATABASE: 12
  - API: 26
  - AUTHORIZATION: 3
  - CONCURRENCY: 3
  - FRONTEND: 7
  - END-TO-END: 1
- **Number mapped to each TBR-DOC rule** (all 18 rules covered; a test may map to more than one closely coupled rule):
  - TBR-DOC-001: 4
  - TBR-DOC-002: 3
  - TBR-DOC-003: 5
  - TBR-DOC-004: 1
  - TBR-DOC-005: 2
  - TBR-DOC-006: 1
  - TBR-DOC-007: 7
  - TBR-DOC-008: 3
  - TBR-DOC-009: 9
  - TBR-DOC-010: 7 (shared with 009 — the seven Obsolete-precondition tests each verify both the precondition logic and its error-code mapping)
  - TBR-DOC-011: 5 (signature requirement, now including the three new negative paths: missing/expired/replayed)
  - TBR-DOC-012: 5
  - TBR-DOC-013: 12 (035, 037–043, 045, 047–049)
  - TBR-DOC-014: 4
  - TBR-DOC-015: 4 (adds TC-DOC-048, the rollback test, alongside the three concurrency tests)
  - TBR-DOC-016: 8 (adds TC-DOC-072, the rollback-produces-no-notification test)
  - TBR-DOC-017: 3
  - TBR-DOC-018: 4

- **BLOCKED test count**: **0** (TC-DOC-067 unblocked this pass — see §14 for the existing live mechanism found and used).
- **Every TO-BE requirement is now testable as written.**

### Changed test cases this pass
- **TC-DOC-009** — rewritten to scope strictly to the database transaction boundary; no longer asserts MinIO object rollback; adds an explicit STORAGE FOLLOW-UP / OUT-OF-SCOPE note for any orphaned-WORM-object risk.
- **TC-DOC-045** — rewritten to verify only the canonical operation's reason-code contract accepts `REVISION_OBSOLETED`; no longer implies or requires a third live caller or a manual Revision-Obsolete workflow.
- **TC-DOC-067** — unblocked and rewritten to verify the full durable-failure/manual-retry contract against the existing `NotificationDeliveryFailure`/`NotificationController` mechanism.
- **New**: TC-DOC-033 (missing signature token), TC-DOC-070 (expired signature token), TC-DOC-071 (replayed signature token), TC-DOC-072 (rolled-back Obsolete produces no notification work).
- Test Data Model (§3): added `MISSING_SIGNATURE_TOKEN` fixture and documented the current, established HTTP-code semantics for each signature-failure fixture (400 for missing, 401 for expired/replayed) so no test invents a new code.

### Existing notification failure/retry infrastructure found (targeted read, this pass)
A fully live mechanism already exists and is reused as-is, with no new subsystem introduced:
- `entity/NotificationDeliveryFailure` — persisted record with `recipient`, `notificationType`, `eventDomain`, `channel`, `errorMessage`, `payloadJson`, `attempts`, `createdAt`, `lastAttemptAt`, `status` (`FAILED`/`RESOLVED`).
- `EmailNotificationService.recordDeliveryFailure(...)` — already invoked from every email-send failure path, including the policy-driven send method used by `NotificationDispatcher` (confirmed: `NotificationDispatcher` depends on `EmailNotificationService` directly).
- `NotificationController`: `GET /notifications/delivery-failures` (paginated, permission-gated) and `POST /notifications/delivery-failures/{id}/retry` → `EmailNotificationService.retryDeliveryFailure(id)` (`@Transactional`, resends via stored template/payload, updates the same row to `RESOLVED`/`FAILED`, capped at 5 attempts) — a working manual-retry endpoint already shipped.
- Minimum additional implementation needed (not built now, recorded for the implementation pass): ensure the Document-Obsolete notification call sites route through this same dispatcher/service path rather than any new direct-send call, so failures land in this existing table automatically.

### Is Document Lifecycle ready for implementation?
**Yes.** All 18 TBR-DOC rules are covered, zero tests are BLOCKED, no test assumes behavior beyond the approved TO-BE spec or beyond verified current-system semantics (signature error codes, notification infrastructure), and the MinIO/transaction-boundary and REVISION_OBSOLETED-caller corrections removed the two incorrect assumptions flagged previously. The three Obsolete-precondition error codes are now final and human-approved (`DOCUMENT_OBSOLETE_NOT_ACTIVE`, `DOCUMENT_OBSOLETE_NO_EFFECTIVE_REVISION`, `DOCUMENT_OBSOLETE_REVISION_IN_PROGRESS` — the last shared across all five in-progress statuses) — no remaining open item.

STOP.
