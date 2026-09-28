# 20 — UI/API/Service Mapping — Frontend/Backend Enforcement Cross-Check (AS-IS)

Scope: Document / Revision / Controlled Copy lifecycle actions, cross-checked explicitly against the confirmed backend baseline (`08-state-machines.md`, `12-transaction-concurrency.md`). Frontend evidence: `eqms/src` (React). Backend evidence: prior confirmed lifecycle trace.

## Summary table
| # | Workflow | Verdict |
|---|---|---|
| 1 | Revision publish auto-obsoletes sibling EFFECTIVE revision + its distributed controlled copies | MATCH |
| 2 | Manual single-revision Obsolete (backend has no reachable path) | MATCH — no frontend UI exists for it either |
| 3 | Document Obsolete cascade | **UNKNOWN (partial)** — endpoint + e-signature step confirmed; button-gating source (server capability vs. client re-derivation) not fully verified |
| 4 | Controlled Copy state transitions (Distribute/Cancel/Recall eligibility) | MATCH |
| 5 | Reviewer/Approver strict FIFO | MATCH for authorization outcome; **FRONTEND-LOOSER** in one narrow respect (client capability cache can transiently show a stale "allowed" state) |
| 6 | Async batch finalize polling (Distribute/Cancel/Recall) + Recall's missing terminal-state guard | MATCH for polling behavior; the confirmed backend gap on Recall is **not compensated for** client-side |

## 1. Revision publish → sibling EFFECTIVE revision obsoleted + its distributed controlled copies cascaded
**Backend**: `RevisionService.publishRevisionRecord` — see `08-state-machines.md` §8.4b.
**Frontend**: `documentApi.publishRevision(revisionId, data?)` (`eqms/src/services/api/documents.ts:1094`, `POST /revisions/:revisionId/publish`). Button gating is entirely server-capability-driven via `useRevisionActionCapabilities` (`eqms/src/hooks/useRevisionActionCapabilities.ts`) and `capabilities.can("<action>")`, consumed in `RevisionReviewView.tsx`/`DetailRevisionView.tsx`/`RevisionApprovalView.tsx`/`RevisionTrainingView.tsx`. **No client-side re-derivation of the cascade** — the UI does not predict which sibling/controlled copies will be affected before calling publish; it relies on a post-action refetch to reflect the cascade.
**Verdict: MATCH.** Frontend defers entirely to backend capability decisions; no independent logic to diverge.

## 2. Manual "obsolete a single revision" — confirmed dead on the backend; frontend check
**Backend**: no reachable endpoint (`RevisionController` has no `/obsolete` route; `RevisionWorkflowAction.OBSOLETE` unreachable) — `08-state-machines.md` §8.4c.
**Frontend**: no `obsoleteRevision`-style API function exists in `eqms/src/services/api/documents.ts`. Searched all revision workflow/detail views — the only "Obsolete"-adjacent element found is `GeneralTab.tsx`'s `isObsoleted` prop, which purely disables/read-only-renders form fields once a revision is already obsolete; it is not an action trigger. No dead/disabled "Obsolete Revision" button was found anywhere.
**Verdict: MATCH.** The frontend correctly has no client for a backend action that doesn't exist — consistent, not a gap.

## 3. Document Obsolete cascade
**Backend**: `DocumentService.obsoleteDocument` — `08-state-machines.md` §8.3.
**Frontend**: wired via `documentApi.obsoleteDocument(id, { reason, obsoleteDate, signatureToken? })` (`documents.ts:688`). Gating logic referenced in `eqms/src/features/documents/shared/documentLifecycleActions.ts`, consumed from `DetailDocumentView.tsx`. E-signature step enforced via a signature-fields/e-sign modal flow before `obsoleteDocument` is called with a `signatureToken` — consistent with backend's mandatory signature.
**Verdict: UNKNOWN (partial).** Confirmed: endpoint wiring and mandatory e-signature step match backend. **Not verified**: whether `documentLifecycleActions.ts` recomputes "ACTIVE + has an EFFECTIVE revision + no revision in progress" client-side (a duplication/drift risk, matching the divergence pattern already flagged for the Document→Controlled-Copy cascade in `08` §8.4c) or purely defers to a server-provided capability, the way the equivalent Revision hook does. **Follow-up needed**: full read of `documentLifecycleActions.ts` and `DetailDocumentView.tsx`'s obsolete-button gating before closing this to a definitive verdict.

## 4. Controlled Copy state transitions (Distribute/Cancel/Recall eligibility)
**Backend**: 4 states, Distributed copies never cancellable (silently filtered from batch eligibility), Recall requires Distributed/Obsoleted, Cancel only from READY_FOR_DISTRIBUTION — `08-state-machines.md` §8.4.
**Frontend**: `ControlledCopiesView.tsx` gates every action button on server-computed decision objects (`cancelDecision?.allowed`, `distributeDecision?.allowed`, `recallDecision?.allowed`, from `getControlledCopyActionDecision(...)`/`useControlledCopyBatchActionCapabilities(...)`), each also guarded by `!isCapabilityLoading`. The frontend does **not** hardcode the state-transition matrix. Cancel's visibility is additionally narrowed by view/tab (`viewType === "ready" || "all"`) — an extra UI-only restriction that is **stricter, never looser**, than the backend rule.
**Verdict: MATCH.**

## 5. Reviewer/Approver strict FIFO by sequenceOrder
**Backend**: `RevisionWorkflowAuthorizationService.isPendingReviewer`/`isPendingApprover` — `06-role-authorization-model.md` §6.3.
**Frontend**: `RevisionReviewView.tsx` derives `canReview`/`canRejectReview` exclusively from `revisionActionCapabilities.can("completeReview"/"rejectReview")`, with an explicit code comment: *"The server capability is the workflow authority. Do not add a stale detail-payload flag as a second gate after navigation/preloading."* — a deliberate design decision **not** to re-implement FIFO logic client-side. No independent FIFO computation was found anywhere in `document-revisions/**`; sequence display is purely presentational.
**However**: the capability response is cached client-side for **5 seconds** (`CACHE_TTL_MS = 5_000`, keyed by `${authToken}::${revisionId}`, in `useRevisionActionCapabilities.ts`). If Reviewer #1 acts and Reviewer #2 loads the same revision's capability within that 5s window from a stale cache entry, #2 could transiently see an outdated `allowed=true` in the UI. **The actual mutation attempt is still backend-enforced and fails closed** — this is a UI staleness/UX issue, not an authorization bypass.
**Verdict: MATCH for authorization outcome; FRONTEND-LOOSER only in the narrow sense of the 5-second capability cache.**

## 6. Async batch finalize (Distribute/Cancel/Recall) — polling behavior and the confirmed Recall gap
**Backend**: status flips synchronously; per-copy finalization happens via an after-commit event listener; Distribute's finalize has a terminal-state guard, Recall's does not (`08-state-machines.md` §8.4, `12-transaction-concurrency.md`).
**Frontend**: all three actions (`handleESignConfirm`, `handleDistributeESignConfirm`, `handleRecallESignConfirm` in `ControlledCopiesView.tsx`) treat the synchronous mutation response as **provisional**, setting a `..._Progress({status:"in_progress"})` state rather than showing immediate success. Completion is detected via **two parallel mechanisms**: an SSE-style listener for `"controlled-copy-batch-progress"` events, and an explicit **polling fallback** (code comments: *"SSE delivery is fire-and-forget with no replay/buffering"*) — confirming the frontend does re-fetch for async completion for all three actions, not just assume synchronous finality. On completion (including partial failure), the UI fetches job status + failed items and offers `handleRetryAllFailedRecall`/`Cancel`/`Distribute` as first-class retry affordances.
**Gap not compensated for**: **no frontend-side terminal-state guard was found for Recall** corresponding to the confirmed backend gap. The recall progress/polling code treats `in_progress → completed/completed_with_errors` uniformly across all three actions with no extra client-side check preventing a stale/already-terminal copy from being resubmitted in a recall retry.
**Verdict: MATCH for polling/re-fetch behavior. The confirmed backend concurrency gap on Recall (`10-hidden-implementation-rules.md` #12) is real and unmitigated by the UI** — a user retrying a failed recall batch is not protected client-side either; 409/410 errors are only handled reactively (see cross-cutting notes below), never pre-empted.

## Cross-cutting API/service layer notes
- Central HTTP client: `eqms/src/services/api/client.ts`.
- **GET response cache**: `GET_CACHE_TTL_MS = 1500`ms — absorbs duplicate GETs from re-renders, explicitly invalidated on every mutation (`invalidateGetCache()`, called from `requestOnceMutation`). A ~1.5s window still exists where two near-simultaneous GETs from different components could return an identical cached snapshot — a minor, distinct stale-state vector from the 5s revision-capability cache in item 5.
- **Mutation dedup**: identical in-flight mutations (same method+url+data+params) are coalesced (`requestOnceMutation`), and an `Idempotency-Key` header is auto-attached for `/documents|revisions|publishing|controlled-copies|electronic-signature|workflow` URLs (`requiresIdempotencyKey`) — deliberate double-submit protection.
- **No global 409 (optimistic-lock conflict) handling**: the response interceptor in `client.ts` only special-cases 401 and 429; 409 falls through to a plain reject/propagate. Per-action handling is duplicated identically at 3+ call sites in `ControlledCopiesView.tsx`: on `[403, 409, 410]`, force a capability + row refresh (`refreshSelectedCapabilities`) and show a generic error toast built via `getApiErrorMessage` (`eqms/src/utils/apiError.ts`). **There is no distinct "someone else changed this — reload?" dialog and no automatic retry-with-backoff** on the frontend — treatment is silent-state-refresh + generic error text.

## Files referenced
`eqms/src/services/api/documents.ts`, `eqms/src/services/api/client.ts`, `eqms/src/services/api/workflowActionPolicy.ts`, `eqms/src/services/api/lifecycleStatePolicy.ts`, `eqms/src/services/api/controlledCopyPolicy.ts`, `eqms/src/hooks/useRevisionActionCapabilities.ts`, `eqms/src/utils/apiError.ts`, `eqms/src/features/documents/document-revisions/review-revision/RevisionReviewView.tsx`, `eqms/src/features/documents/document-revisions/workspace-tabs/GeneralTab.tsx`, `eqms/src/features/documents/controlled-copies/ControlledCopiesView.tsx`, `eqms/src/features/documents/shared/documentLifecycleActions.ts` (partially reviewed), `eqms/src/features/documents/document-detail/DetailDocumentView.tsx` (not yet read in full — follow-up needed for item 3).

## Open follow-up
Item 3 (Document Obsolete button-gating source) remains UNKNOWN pending a full read of `documentLifecycleActions.ts` and `DetailDocumentView.tsx`. Tracked in `21-known-unknowns-conflicts.md`.
