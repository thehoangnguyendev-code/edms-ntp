# TO-BE Specification — Document Lifecycle

Status: Human-approved TO-BE requirements (this pass). Scope: **Document master lifecycle only**. Document Revision workflow is referenced strictly as an upstream/downstream dependency (activation trigger, in-progress-status check, cascade target) — its own workflow is not redesigned here. Controlled Copy lifecycle is referenced strictly as a cascade target of Document Obsolete — its own workflow is not redesigned here.

Baseline: AS-IS `docs/as-is-sds/` — `07-workflows.md`, `08-state-machines.md`, `09-business-rules.md`, `11-cross-workflow-dependencies.md`, `21-known-unknowns-conflicts.md`, `22-traceability-index.md`. No application code was modified to produce this document.

---

## 1. Scope

In scope: Document creation, Draft editing, DRAFT→ACTIVE activation, Cancel, Obsolete, the Obsolete cascade to Revisions and Controlled Copies, the concurrency/error semantics of these transitions, the frontend capability contract for Document-level actions, and notification on Obsolete.

Out of scope (referenced only as a dependency boundary, not redesigned):
- Document Revision's own workflow (Submit/Review/Approve/Train/Publish/Reject/Upgrade) — see AS-IS `07-workflows.md` WF-REV-01–12. Only the **initial upload trigger** (activation) and the **in-progress-status set** (Obsolete precondition) are consumed here.
- Controlled Copy's own workflow (Request/Distribute/Recall/Destroy/Reissue/Expiry) — see AS-IS `07-workflows.md` WF-CC-01–08. Only the **Obsolete-on-cascade** effect is consumed here.

---

## 2. Document Lifecycle State Model (TO-BE)

Unchanged from AS-IS (confirmed in `08-state-machines.md` §8.1–8.3, `09-business-rules.md` BR-DOC-*):

```
                 (upload initial Revision source file, same txn)
   NONE ──create──> DRAFT ───────────────────────────────────────> ACTIVE ──obsolete──> OBSOLETED
                       │                                                      (terminal)
                       └──cancel (only if zero Revisions exist)──> CLOSED_CANCELLED
                                                                      (terminal)
```

No new Document states are introduced. `OBSOLETED` and `CLOSED_CANCELLED` remain terminal. The only behavioral changes in this TO-BE are: (a) an explicit audit event for DRAFT→ACTIVE, (b) mandatory reason on Cancel, (c) corrected error semantics on Cancel/Obsolete conflicts, (d) a centralized Controlled-Copy-obsolete cascade operation, (e) closed concurrency window on Obsolete, (f) a unified frontend capability contract, (g) notification on Obsolete. The state *graph* itself is unchanged (`KEEP`).

---

## 3. TO-BE Workflows

### WF-DOC-01 (TO-BE) — Create Document
`NONE → DRAFT`. Actor: any user holding document-creation permission (permission-driven, unchanged — `06-role-authorization-model.md` §6.0). No electronic signature. Audit logged on creation (`CREATE`, fromStatus `null`, toStatus `DRAFT`). **Unchanged from AS-IS.**

### WF-DOC-02 (TO-BE) — Draft Editing
Document metadata may be edited while `DRAFT` by an authorized actor. The existing Sub-Type/reviewer-requirement consistency validation (AS-IS BR-DOC-002) is retained unmodified. **Unchanged from AS-IS.**

### WF-DOC-03 (TO-BE) — Document Activation
`DRAFT → ACTIVE`, triggered when the source file of the Document's initial (original, non-upgrade) Revision is successfully stored. Trigger semantics are **kept exactly as AS-IS-verified**: conceptually equivalent to `RevisionService.activateDocumentAfterInitialSourceStored`, guarded by (Revision is the initial/original Revision, i.e. `parentRevision == null`) AND (Document status is currently `DRAFT`) AND (source-file storage succeeded), executed in the **same transaction** as the successful initial Revision upload.

**NEW requirement**: the transition must generate an explicit audit-trail event recording at minimum: Document ID, previous status (`DRAFT`), new status (`ACTIVE`), the triggering Revision ID, actor, timestamp, and an action meaning/reason of "initial revision source uploaded." (AS-IS currently performs this transition with **no dedicated audit entry** — confirmed absent by direct code read; see `21-known-unknowns-conflicts.md` RESOLVED table.) No electronic signature is required for this automatic lifecycle progression (unchanged).

### WF-DOC-04 (TO-BE) — Cancel Document
Allowed only if **no Revision exists** for the Document (unchanged precondition). `DRAFT → CLOSED_CANCELLED`.

**MODIFY**: a Reason/Activity Summary becomes **mandatory** (non-blank) — AS-IS currently accepts a blank reason and silently substitutes the default string `"Document cancelled"` (confirmed by direct code read of `DocumentService.cancelDocument`, `firstNonBlank(request.activitySummary(), "Document cancelled")`). Audit trail remains mandatory (unchanged). No electronic signature required (unchanged). Terminal state (unchanged). No cascade is necessary because zero Revisions must exist (unchanged).

**MODIFY (error semantics)**: if a Revision exists, Cancel must be denied with a **business-state error**, not a generic exception. Response: **HTTP 409 Conflict**, machine-readable code `DOCUMENT_CANCEL_NOT_ALLOWED`, plus a user-readable explanation. AS-IS currently throws a plain `IllegalStateException`, which `GlobalExceptionHandler` maps to **HTTP 500** (confirmed in `19-error-retry-recovery.md`) — this is corrected here.

### WF-DOC-05 (TO-BE) — Obsolete Document
Allowed only when: Document is `ACTIVE`; at least one `EFFECTIVE` Revision exists; no Revision is currently in an in-progress state (`DRAFT`, `PENDING_REVIEW`, `PENDING_APPROVAL`, `PENDING_TRAINING`, `READY_FOR_PUBLISHING` — unchanged set, consumed as a dependency on Revision state, not redefined here). `ACTIVE → OBSOLETED`.

Reason/Activity Summary mandatory (unchanged intent; AS-IS already threads `request.reason()` into the persisted signature — confirmed by code read of `DocumentService.obsoleteDocument`, though server-side non-blank enforcement was not independently re-verified in this pass, see §14 acceptance criteria). Electronic signature mandatory (unchanged — AS-IS already requires and persists one, meaning `OBSOLETED`). Audit trail mandatory (unchanged).

### WF-DOC-06 (TO-BE) — Obsolete Cascade
Document Obsolete must **atomically** cause, as one business transaction:
1. Document `ACTIVE → OBSOLETED`.
2. All applicable non-terminal Revisions (i.e., not already `OBSOLETED`/`CLOSED_CANCELLED`) → `OBSOLETED`.
3. All applicable Controlled Copies currently `READY_FOR_DISTRIBUTION` or `DISTRIBUTED` → `OBSOLETED`.

The cascade remains **synchronous, in the same transaction** as the Document status change — **not** moved to asynchronous processing (unchanged from AS-IS, which already runs this cascade in one transaction per `08-state-machines.md` §8.3; this TO-BE formalizes it as a requirement rather than an incidental fact). Either the entire cascade succeeds as one business action, or the whole transaction rolls back — no partial cascade is a valid outcome.

**MODIFY**: the Controlled-Copy portion of this cascade must invoke the canonical operation defined in WF-DOC-07 below, rather than the document-local inline implementation that exists in AS-IS.

### WF-DOC-07 (TO-BE) — Canonical Controlled-Copy-Obsolescence Operation
**NEW**: introduce one canonical business operation — "obsolete Controlled Copies due to a source lifecycle change" — as a single service entry point. Both of the following callers must invoke this one operation rather than maintaining independent implementations:
- Document Obsolete (WF-DOC-06 above).
- Revision superseded by a newer Effective Revision (Document Revision's own publish workflow — consumed here only as a caller of the canonical operation, not redesigned).

The operation must accept a **reason code** parameter with at least the values: `DOCUMENT_OBSOLETED`, `NEW_REVISION_PUBLISHED`, `REVISION_OBSOLETED` (the exact AS-IS reason vocabulary, unchanged). It must apply the same effect regardless of caller: every Controlled Copy of the affected Revision(s) currently `READY_FOR_DISTRIBUTION` or `DISTRIBUTED` → `OBSOLETED` with the caller-supplied reason, batch-status synchronized, one audit entry per copy. This eliminates the two independent AS-IS implementations (`DocumentService.obsoleteDocument`'s inline loop and `RevisionService.obsoleteDistributedControlledCopies`) documented as a divergence-risk in `11-cross-workflow-dependencies.md` and `09-business-rules.md` BR-CC-013.

---

## 4. TO-BE Business Rules

See §15 Traceability for the full rule table with AS-IS mapping. Rule IDs use prefix `TBR-DOC-###`.

---

## 5. Authorization Principles

**KEEP, unchanged**: the permission-code + policy-engine authorization model (`06-role-authorization-model.md` §6.0) is retained for every Document lifecycle action. `documentAuthorizationService.requireDocumentMasterLifecycleAction(actor, document, actionCode)` (or its TO-BE equivalent) remains the single authorization gate for Cancel and Obsolete. No role-name-based check is introduced. SYSTEM_SUPER_ADMIN exemption status for Document actions specifically remains as AS-IS (confirmed non-exempt for Controlled Copy only, `UNKNOWN` for Document — this TO-BE does not resolve that AS-IS UNKNOWN; it is orthogonal to the lifecycle changes requested).

---

## 6. Audit Requirements

| Transition | AS-IS audit | TO-BE audit | Change |
|---|---|---|---|
| Create | Logged (`CREATE`, null→`DRAFT`) | Same | KEEP |
| Draft edit | Logged (`UPDATE`, per-field changes) | Same | KEEP |
| **Activation (DRAFT→ACTIVE)** | **Not logged as a distinct event** | **Logged**: Document ID, `DRAFT`→`ACTIVE`, triggering Revision ID, actor, timestamp, reason "initial revision source uploaded" | **NEW** |
| Cancel | Logged (`CANCEL`, fromStatus→`CLOSED_CANCELLED`, reason defaulted if blank) | Logged, same shape, **reason now mandatory (non-blank), never defaulted** | MODIFY |
| Obsolete | Logged (`OBSOLETE`, fromStatus→`OBSOLETED`) + per-cascaded-Revision/Copy entries | Same, cascaded-Copy entries now sourced from the single canonical operation (one consistent entry shape regardless of caller) | MODIFY (shape consolidation only, not a new capture requirement) |

All audit entries remain governed by the existing `AuditTrailService` convention-based immutability model (`15-audit-trail.md`) — this TO-BE does not change audit storage/immutability guarantees, only which events are captured and the mandatoriness of the reason field.

---

## 7. Electronic-Signature Requirements

| Transition | AS-IS | TO-BE | Change |
|---|---|---|---|
| Create | None | None | KEEP |
| Draft edit | None | None | KEEP |
| Activation | None | None | KEEP |
| Cancel | None | None | KEEP |
| Obsolete | Mandatory, meaning `OBSOLETED`, persisted as an `ElectronicSignature` row | Mandatory, unchanged | KEEP |

No new e-signature requirement is introduced anywhere in the Document lifecycle by this TO-BE. The automatic DRAFT→ACTIVE progression explicitly remains signature-free per the approved requirement.

---

## 8. Notification Requirements

**NEW** (closes a confirmed AS-IS gap — `14-notifications.md` documented no independently-confirmed trigger for document-level obsolete notification): after a successful Document Obsolete transaction commits, generate notification events via the **existing** `NotificationDispatcher` policy engine (no new direct-email implementation) addressed to, at minimum:
- the Document Author;
- the DCO / Document Coordinator (permission-equivalent recipient, not a role-string match — consistent with `06-role-authorization-model.md` §6.0's architecture);
- recipients of Controlled Copies that were `DISTRIBUTED` and became `OBSOLETED` **because of this action**.

**Explicit exclusion**: a recipient must **not** be notified solely because their copy was `READY_FOR_DISTRIBUTION` and had never actually been distributed to them — no notification content has reached them yet, so there is nothing to inform them about.

**Failure isolation**: notification dispatch failure must **not** reverse an already-committed Document Obsolete transaction — the lifecycle mutation and its audit/signature records are final regardless of notification outcome (consistent with AS-IS's existing pattern of notification being a best-effort side effect, not a transactional participant, per `14-notifications.md`).

**Durable failure tracking and manual retry (human decision, closed)**: notification work is triggered only after the lifecycle transaction commits (not before, not as part of it). If a delivery attempt fails, the failure must be **durably persisted** (not log-only, not silently dropped) with the recipient, channel, event, error, and attempt timestamp identifiable, so an authorized operator can locate it and manually retry it. Automatic retry/backoff is **not** required by this change. This requirement is satisfied by an **existing, already-live mechanism** confirmed by targeted code read — `entity/NotificationDeliveryFailure` (persisted via `EmailNotificationService.recordDeliveryFailure`, already invoked from the policy-driven send path `NotificationDispatcher` depends on) plus `NotificationController`'s `GET /notifications/delivery-failures` (admin listing) and `POST /notifications/delivery-failures/{id}/retry` (manual retry via `EmailNotificationService.retryDeliveryFailure`, which resolves the same row without replaying the Document-Obsolete lifecycle transaction). **No new notification subsystem is introduced** — the only implementation requirement is to ensure the Document-Obsolete notification call sites route through this existing dispatcher/service path.

---

## 9. Error Semantics

| Condition | AS-IS response | TO-BE response | Change |
|---|---|---|---|
| Cancel attempted with a Revision already present | `IllegalStateException` → **HTTP 500**, generic `INTERNAL_ERROR` | **HTTP 409 Conflict**, code `DOCUMENT_CANCEL_NOT_ALLOWED`, user-readable message | **MODIFY** |
| Obsolete attempted with stale/invalid preconditions (not ACTIVE, no EFFECTIVE revision, revision in progress) | `IllegalStateException` → **HTTP 500** | **HTTP 409 Conflict**, one of three **human-approved, final** machine-readable codes: `DOCUMENT_OBSOLETE_NOT_ACTIVE` (Document not ACTIVE); `DOCUMENT_OBSOLETE_NO_EFFECTIVE_REVISION` (no EFFECTIVE Revision exists); `DOCUMENT_OBSOLETE_REVISION_IN_PROGRESS` (any Revision in `DRAFT`/`PENDING_REVIEW`/`PENDING_APPROVAL`/`PENDING_TRAINING`/`READY_FOR_PUBLISHING` — **one shared code for all five statuses, not five separate codes**; the specific offending Revision's status/detail may be included separately in the response body for human-readable UI messaging, but must not change the machine-readable code) | **MODIFY** |
| Concurrent conflict detected at commit time (optimistic lock or re-validated precondition failure) | `ObjectOptimisticLockingFailureException` → HTTP 409 `CONCURRENT_MODIFICATION` (already correct per `19-error-retry-recovery.md`); business-precondition re-check gap otherwise unhandled | HTTP 409, machine-readable code, **no partial lifecycle change** | **MODIFY** (extends existing 409 pattern to the newly-added precondition re-check) |

General principle carried forward unchanged from AS-IS: `AccessDeniedException`/`WorkflowAuthorizationDeniedException` continue to map to 403 (KEEP).

---

## 10. Concurrency Requirements

**MODIFY** (closes AS-IS BR-DOC-010's confirmed TOCTOU window, `12-transaction-concurrency.md`): immediately before committing the Document Obsolete mutation, the server must **re-validate** that the lifecycle preconditions (Document still `ACTIVE`; an `EFFECTIVE` Revision still exists; no Revision has since entered an in-progress state) still hold, within the same transaction, rather than relying solely on a single check performed at the start of the method with several intervening reads/writes before the final save.

A concurrency/business-state conflict detected at this point must:
- make **no partial lifecycle change** (full transaction rollback — the existing single-transaction cascade design already supports this; the requirement is that the re-validation itself participates in the same atomic unit);
- return **HTTP 409**;
- return a **machine-readable error code**;
- result in the UI refetching current state/capabilities (see §11).

The existing `@Version` optimistic-lock column on `DocumentRecord` is retained as a complementary, not a replacement, protection (KEEP) — it continues to guard against a literal concurrent write to the same Document row; the new precondition re-check additionally guards against a **business-state** change (e.g., a Revision entering `PENDING_REVIEW` mid-transaction-window) that `@Version` alone would not catch, since that would be a write to a *different* row (the Revision), not the Document row itself.

Do not rely on frontend state for enforcement of any of the above — the server remains the sole source of truth (unchanged principle, `06` §6.0).

---

## 11. Frontend/Server Capability Contract

**MODIFY** (resolves the confirmed cross-view inconsistency recorded in `21-known-unknowns-conflicts.md` Decision Log candidate #11 and `07-workflows.md` WF-DOC-05): the server-computed capability (`GET` resource-capabilities endpoint for `DOCUMENT_MASTER`, already implemented and already consumed by both views) becomes the **sole authoritative source** for whether Cancel/Obsolete (and other Document lifecycle actions) are available.

- `DetailDocumentView.tsx` already defers purely to this capability (AS-IS, confirmed) — **no change required** to this view's action-gating logic.
- `NewDocumentView.tsx` currently combines the same server capability **with** an independent client-side re-derivation via `documentLifecycleActions.ts`'s `canObsoleteDocumentWithRevisionHistory` (ACTIVE + has-EFFECTIVE-revision + no-revision-in-progress, recomputed client-side). This duplicated recomputation must be **removed** from the action-gating decision — the server capability alone must gate the button. The frontend may still use server-provided decision **details/reasons** (e.g., a denial-reason string from the capability response) to render an explanatory message, but must not independently recreate the authoritative lifecycle state machine.
- Both Document views must behave **consistently** for the same document/user/state after this change.

**Scope decision (closed)**: `documentLifecycleActions.ts`'s lifecycle helper functions are **not** globally deleted. For this change, only `NewDocumentView.tsx` must stop using `canObsoleteDocumentWithRevisionHistory(...)` as an authorization/action-gating condition — the server capability becomes authoritative there too. The helper functions may remain in the module (and may still be imported by `NewDocumentView.tsx` for non-gating purposes if needed) because other call sites (`document-list/types.ts`, `controlledCopyRequest.ts`) are outside this change's scope and are not modified.

**NEW** — capability refetch on mutation conflict: for lifecycle mutation responses of **403, 409, or 410**, the frontend must immediately refetch: (a) the Document, (b) the Revision summary/history required by the current view, and (c) the server lifecycle capabilities — then re-render available actions from the fresh data. AS-IS currently has **no such reactive refetch** for either Document view (both `DetailDocumentView.tsx` and `NewDocumentView.tsx` recover capability staleness only passively — a 10-second poll in one, and only-on-next-successful-hydrate in the other; confirmed by direct code read, `21-known-unknowns-conflicts.md` RESOLVED table). This TO-BE extends the reactive-refresh pattern already proven for Controlled Copy actions (`ControlledCopiesView.tsx`, confirmed in `20-ui-api-service-mapping.md`) to the Document views.

---

## 12. Cross-Workflow Cascade Requirements

(Restates WF-DOC-06/07 in dependency-map form, consistent with `11-cross-workflow-dependencies.md`'s structure.)

| Source event | Target | Sync/Async | Transaction | TO-BE target effect | Divergence eliminated |
|---|---|---|---|---|---|
| Document Obsolete | Document | Synchronous | Same transaction | `ACTIVE`→`OBSOLETED` | n/a |
| Document Obsolete | non-terminal Revisions | Synchronous | Same transaction | →`OBSOLETED`, via the existing per-revision status+history+audit mechanism (unchanged, `RevisionService`-delegated as AS-IS already does) | n/a — this half of the cascade was already single-implementation in AS-IS |
| Document Obsolete | Controlled Copies (Ready-for-Distribution/Distributed) | Synchronous | Same transaction | →`OBSOLETED`, reason `DOCUMENT_OBSOLETED`, **via the canonical operation (WF-DOC-07)** | **Yes** — replaces the document-local inline loop |
| (dependency only) Revision superseded by newer Effective Revision | Controlled Copies of the superseded Revision | Synchronous | Same transaction as the publish (Revision workflow, not redesigned here) | →`OBSOLETED`, reason `NEW_REVISION_PUBLISHED`, **via the same canonical operation (WF-DOC-07)** | **Yes** — replaces `RevisionService.obsoleteDistributedControlledCopies`'s standalone implementation |

No new asynchronous hop is introduced anywhere in this cascade. The canonical operation is a synchronous, in-process, in-transaction service call from both callers — not a message/event published for later async processing (consistent with the explicit instruction not to move this cascade to asynchronous processing).

---

## 13. AS-IS → TO-BE Change Matrix

| Area | AS-IS | TO-BE | Classification |
|---|---|---|---|
| Create → DRAFT | `DocumentService.createDocumentDraft` | Unchanged | KEEP |
| Draft edit + Sub-Type/reviewer validation | `DocumentService.updateDocumentDraft` | Unchanged | KEEP |
| DRAFT→ACTIVE trigger mechanism | `activateDocumentAfterInitialSourceStored` | Unchanged mechanism | KEEP |
| DRAFT→ACTIVE audit event | None | New explicit audit entry | NEW |
| Cancel precondition (zero revisions) | Enforced | Unchanged | KEEP |
| Cancel signature | None required | Unchanged | KEEP |
| Cancel reason | Optional, defaulted if blank | Mandatory, non-blank | MODIFY |
| Cancel conflict error code | `IllegalStateException`→HTTP 500 | HTTP 409 + `DOCUMENT_CANCEL_NOT_ALLOWED` | MODIFY |
| Obsolete preconditions | Enforced (ACTIVE, EFFECTIVE revision exists, none in-progress) | Unchanged | KEEP |
| Obsolete signature | Mandatory | Unchanged | KEEP |
| Obsolete conflict error code | `IllegalStateException`→HTTP 500 | HTTP 409 + distinct machine codes per precondition | MODIFY |
| Obsolete cascade to Revisions | Synchronous, same transaction, delegated to `RevisionService` | Unchanged | KEEP |
| Obsolete cascade to Controlled Copies | Inline loop in `DocumentService.obsoleteDocument` | Delegated to canonical operation | MODIFY |
| Revision-supersede cascade to Controlled Copies | `RevisionService.obsoleteDistributedControlledCopies` (independent implementation) | Delegated to the same canonical operation | **REMOVE/DUPLICATE** (this AS-IS implementation is retired in favor of the shared one) |
| Canonical CC-obsolescence operation | Does not exist | New single service entry point, reason-code parameterized | NEW |
| Obsolete transaction atomicity/sync | Single transaction, synchronous | Unchanged, formalized as a requirement | KEEP |
| Concurrency: precondition re-check before commit | Single check only, at method start | Re-validated immediately before commit | MODIFY |
| `@Version` optimistic lock on Document | Present | Unchanged, retained as complementary protection | KEEP |
| Frontend: `DetailDocumentView.tsx` gating | Server-capability-only | Unchanged | KEEP |
| Frontend: `NewDocumentView.tsx` gating | Server capability + client re-derivation | Server-capability-only (client re-derivation removed from gating) | MODIFY |
| `documentLifecycleActions.ts` lifecycle-gating helper (`canObsoleteDocumentWithRevisionHistory` and its Document-specific inputs) | Used for gating in `NewDocumentView.tsx` | No longer used for gating (may remain as a display-only helper if still needed elsewhere — subject to the human-decision constraint in §11) | **REMOVE/DUPLICATE** (as a gating mechanism only) |
| Frontend refetch on 403/409/410 | Passive (poll / next-hydrate only) | Active, immediate refetch of Document + Revision summary + capabilities | NEW |
| Notification on Document Obsolete | No independently-confirmed trigger (AS-IS gap) | New notification to Author, DCO/Coordinator, and affected Distributed-copy recipients, via existing `NotificationDispatcher` | NEW |
| Notification on Ready-for-Distribution-only copies | n/a (gap) | Explicitly excluded from notification | NEW (an exclusion rule, not a trigger) |
| Notification failure isolation from lifecycle commit | Already the de facto pattern elsewhere in the system | Formalized as a requirement for this workflow | KEEP (pattern) / NEW (as an explicit requirement for this specific workflow) |

**Counts**: KEEP = 15, MODIFY = 7, NEW = 6, REMOVE/DUPLICATE = 2. (Total 30 matrix rows; some rows represent the same underlying change viewed from two angles — see §15 for the deduplicated rule-level count.)

---

## 14. Acceptance Criteria

1. Creating a Document produces a `DRAFT` record and one `CREATE` audit entry; no signature prompt appears.
2. Editing Document metadata while `DRAFT` succeeds for an authorized actor and preserves the Sub-Type/reviewer-requirement consistency check (a Sub-Type change with an inconsistent existing reviewer set is rejected, unchanged from AS-IS).
3. Uploading the initial Revision's source file to a `DRAFT` Document transitions the Document to `ACTIVE` in the same transaction, and produces exactly one new audit entry capturing Document ID, `DRAFT`→`ACTIVE`, the triggering Revision ID, actor, timestamp, and the reason text. Repeating the upload path against an already-`ACTIVE` Document produces no further Document-status audit entry (idempotency preserved).
4. Reason/Activity Summary validation (human decision, closed): `null` → invalid; empty string → invalid; whitespace-only → invalid; a trimmed non-blank value → valid and preserved exactly as the actor entered it (after trimming, no further alteration). No arbitrary minimum character count is introduced. No default reason is ever silently substituted. Maximum length is whatever the existing persisted field/API constraint already is — no new maximum is invented.
5. Attempting Cancel on a Document that already has any Revision returns **HTTP 409** with code `DOCUMENT_CANCEL_NOT_ALLOWED` and a human-readable message — never HTTP 500.
6. Cancelling a Document with zero Revisions and a non-blank reason succeeds, produces one audit entry, requires no signature, and results in `CLOSED_CANCELLED`.
7. Attempting Obsolete returns **HTTP 409**, never HTTP 500, with exactly one of three final codes: `DOCUMENT_OBSOLETE_NOT_ACTIVE`, `DOCUMENT_OBSOLETE_NO_EFFECTIVE_REVISION`, or `DOCUMENT_OBSOLETE_REVISION_IN_PROGRESS` (the last shared across all five in-progress Revision statuses — never five separate codes).
8. Obsoleting an eligible Document requires a valid electronic signature; on success, the Document becomes `OBSOLETED`, every non-terminal Revision becomes `OBSOLETED`, and every `READY_FOR_DISTRIBUTION`/`DISTRIBUTED` Controlled Copy of the Document becomes `OBSOLETED` with reason `DOCUMENT_OBSOLETED` — all as one atomic transaction (a forced failure injected after the Revision cascade but before the Controlled Copy cascade must roll back the entire transaction, including the Document and Revision status changes).
9. The Controlled-Copy portion of both the Document-Obsolete cascade and the Revision-supersede cascade are verified to invoke the same canonical operation (verifiable by a shared code path / shared audit-entry shape / shared reason-code enum), not two independently-maintained implementations.
10. A concurrent request that changes a Revision to an in-progress status between the Obsolete request's initial check and its commit causes the Obsolete transaction to fail with **HTTP 409** and a machine-readable code, with no partial state change (Document remains `ACTIVE`, no Revision or Controlled Copy is mutated).
11. After a successful Obsolete, the Document Author, the DCO/Coordinator, and every recipient whose Controlled Copy was `DISTRIBUTED` and became `OBSOLETED` receive a notification; a recipient whose copy was only `READY_FOR_DISTRIBUTION` receives none. A simulated notification-dispatch failure does not roll back the already-committed Obsolete transaction, and produces a durable, identifiable `NotificationDeliveryFailure` record that an authorized operator can locate and manually retry (retry resolves the record without replaying the Obsolete transaction). A Document Obsolete attempt that itself rolls back produces no notification work at all.
12. `DetailDocumentView.tsx` and `NewDocumentView.tsx` render identical Cancel/Obsolete availability for the same Document/user/state (verifiable by comparing both views' rendered action set against the same capability response).
13. A 403, 409, or 410 response from any Document lifecycle mutation causes the frontend to refetch Document detail, the relevant Revision summary, and lifecycle capabilities, and to re-render actions from the refreshed data, without requiring a manual page reload.
14. **Resolved (previously flagged as needing a human decision)**: Reason/Activity Summary validation depth is now closed per criterion 4 above (null/empty/whitespace invalid, trimmed non-blank valid, no arbitrary minimum length, existing max-length constraint respected, no silent default substitution).

---

## 15. Traceability

| TBR ID | AS-IS Workflow ID | AS-IS Business Rule ID | Classification | Backend component | Frontend component | Audit | Signature | Notification | Error semantics | Concurrency | Acceptance criteria # |
|---|---|---|---|---|---|---|---|---|---|---|---|
| TBR-DOC-001 | WF-DOC-01 | BR-DOC-001 | KEEP | `DocumentService.createDocumentDraft` | Document create form | `CREATE` logged | None | None | n/a | n/a | 1 |
| TBR-DOC-002 | WF-DOC-02 | BR-DOC-002 | KEEP | `DocumentService.updateDocumentDraft` | Document edit form | `UPDATE` logged | None | None | Validation error on Sub-Type/reviewer mismatch | n/a | 2 |
| TBR-DOC-003 | WF-DOC-03/WF-REV-01 | BR-REV-001 (AS-IS; no dedicated BR-DOC id existed) | KEEP (mechanism) | `RevisionService.activateDocumentAfterInitialSourceStored` (or TO-BE equivalent), invoked from `uploadRevisionFile`/`createRevisionAndUploadFile` | Revision upload UI | Same transaction, no change to upload audit | None | None | n/a | Idempotent guard retained | 3 |
| TBR-DOC-004 | WF-DOC-03 | (none — new) | **NEW** | Same call site as TBR-DOC-003, additional `auditTrailService` call | n/a | **New explicit entry**: Document ID, DRAFT→ACTIVE, Revision ID, actor, timestamp, reason | None | None | n/a | Must occur in the same transaction as TBR-DOC-003 | 3 |
| TBR-DOC-005 | WF-DOC-04 | BR-DOC-004 | KEEP | `DocumentService.cancelDocument` | Cancel action UI | Unchanged | None | None | n/a | n/a | 5, 6 |
| TBR-DOC-006 | WF-DOC-04 | BR-DOC-005 | KEEP | Same | Same | n/a | None (unchanged) | None | n/a | n/a | 6 |
| TBR-DOC-007 | WF-DOC-04 | (none — modifies default-fallback behavior) | **MODIFY** | `DocumentService.cancelDocument` — remove `firstNonBlank(..., "Document cancelled")` fallback, require non-blank input | Cancel modal — reason field becomes required | Reason now always the actor-supplied text | None | None | Validation error if blank | n/a | 4 |
| TBR-DOC-008 | WF-DOC-04 | (none — new error-mapping requirement) | **MODIFY** | `DocumentService.cancelDocument` guard + `GlobalExceptionHandler` (new mapping or new exception type) | Cancel action UI — must render 409 message, not a generic failure | n/a | n/a | n/a | **HTTP 409, `DOCUMENT_CANCEL_NOT_ALLOWED`** | n/a | 5 |
| TBR-DOC-009 | WF-DOC-05 | BR-DOC-006 | KEEP | `DocumentService.obsoleteDocument` precondition checks | Obsolete action UI | Unchanged | Unchanged (mandatory) | n/a | See TBR-DOC-010 | n/a | 7 |
| TBR-DOC-010 | WF-DOC-05 | (none — new error-mapping requirement) | **MODIFY** | Same + `GlobalExceptionHandler` | Obsolete action UI | n/a | n/a | n/a | **HTTP 409**, one of three final codes: `DOCUMENT_OBSOLETE_NOT_ACTIVE` / `DOCUMENT_OBSOLETE_NO_EFFECTIVE_REVISION` / `DOCUMENT_OBSOLETE_REVISION_IN_PROGRESS` (single shared code for all five in-progress statuses) | n/a | 7 |
| TBR-DOC-011 | WF-DOC-05 | BR-DOC-007 | KEEP | `ElectronicSignatureService.createEntitySignature` | E-sign modal | n/a | Mandatory, meaning `OBSOLETED` (unchanged) | n/a | n/a | n/a | 8 |
| TBR-DOC-012 | WF-DOC-06 (WF-DOC-05 cascade step) | BR-DOC-008 | KEEP | `RevisionService.obsoleteRevisionAsPartOfDocumentObsolete` (unchanged call) | n/a | Unchanged per-revision entries | n/a | n/a | n/a | Same transaction | 8 |
| TBR-DOC-013 | WF-DOC-06/WF-DOC-07 | BR-DOC-009, BR-CC-013 | **MODIFY** | New canonical CC-obsolescence operation, called from `DocumentService.obsoleteDocument` | n/a | Consolidated entry shape | n/a | n/a | n/a | Same transaction | 8, 9 |
| TBR-DOC-014 | WF-DOC-07 (dependency: Revision publish cascade) | BR-CC-013 (the "two independent paths" finding) | **REMOVE/DUPLICATE** | Retire `RevisionService.obsoleteDistributedControlledCopies` as a standalone implementation; its caller (Revision publish-supersede) now calls the canonical operation instead | n/a | Same canonical entry shape as TBR-DOC-013 | n/a | n/a | n/a | Same transaction as the Revision publish (unchanged boundary) | 9 |
| TBR-DOC-015 | WF-DOC-06 | BR-DOC-010 | **MODIFY** | `DocumentService.obsoleteDocument` — add precondition re-check immediately pre-commit | n/a | n/a | n/a | n/a | **HTTP 409 + machine code on conflict** | **New re-validation step, same transaction; `@Version` retained as complementary** | 10 |
| TBR-DOC-016 | WF-DOC-05 | (none — new) | **NEW** | `DocumentService.obsoleteDocument` (post-commit hook) → `NotificationDispatcher`/`EmailNotificationService` (existing `NotificationDeliveryFailure` durable-failure/manual-retry mechanism reused, no new subsystem) | n/a | n/a | n/a | **New**: Author, DCO/Coordinator, affected Distributed-copy recipients; excludes Ready-for-Distribution-only recipients; failure does not roll back the transaction and is durably tracked + manually retryable; a rolled-back Obsolete attempt produces no notification work | n/a | n/a | 11 |
| TBR-DOC-017 | WF-DOC-05 (frontend) | `20-ui-api-service-mapping.md` item 3; `21` Decision Log #11 | **MODIFY** | n/a | `NewDocumentView.tsx` — remove `documentLifecycleActions.ts` re-derivation from gating decision; `DetailDocumentView.tsx` unchanged | n/a | n/a | n/a | n/a | n/a | 12 |
| TBR-DOC-018 | WF-DOC-05 (frontend) | (none — new) | **NEW** | n/a | Both Document views — add 403/409/410 → refetch Document + Revision summary + capabilities | n/a | n/a | n/a | Consumes the codes from TBR-DOC-008/010/015 | Client-side reflection of server concurrency outcome | 13 |

**Rule count**: 18 TO-BE rules (TBR-DOC-001–018). Classification totals at the rule level:
- **KEEP = 8**: 001, 002, 003, 005, 006, 009, 011, 012.
- **MODIFY = 6**: 007, 008, 010, 013, 015, 017.
- **NEW = 3**: 004, 016, 018.
- **REMOVE/DUPLICATE = 1**: 014.
