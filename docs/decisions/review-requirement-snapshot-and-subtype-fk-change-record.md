# Change Record — Review-Requirement Snapshot + Sub-Type FK + Reviewer-Assignment Hardening

Status: **APPROVED (owner decisions recorded 2026-09-08)** · Scope: Document Control (Draft workflow), Document Sub-Type dictionary
Owner decisions: see "Decisions" below.

## 1. Problem

`reviewRequirement` (whether a Document Revision needs Reviewers) is derived from the
Document's **Sub-Type** at several checkpoints, from **three inconsistent sources**:

| Consumer | Source today |
|---|---|
| `DocumentDetailResponse.reviewRequirement`, `DocumentListItemResponse` | **live** `DocumentService.resolveDocumentReviewRequirement(document)` |
| Draft save (`saveDraftAssignments`, `updateDocumentDraft`, `configureInitialWorkflow`) | **live** `resolveDocumentReviewRequirement(document)` |
| Revision submit-for-review (`validateReviewersForRequirement`) | **frozen** `document_revisions.review_requirement` (set once at revision creation — BR-DOC §09:54) |
| Frontend (`NewDocumentView.tsx`) | **client-predicted** from the Sub-Type lookup list, matched by **name** |

`document_record.sub_type` is a **plain name string**, not a foreign key. Renaming or
deactivating a Sub-Type orphans the reference; `findByDocumentType_IdAndNameIgnoreCase`
then fails and the code **silently falls back to `REQUIRED`**.

### Failure modes (production risk)

| # | Trigger | Symptom |
|---|---|---|
| E1 | Admin flips Sub-Type `REQUIRED→NONE` after reviewers saved; author edits any field | `REVIEW_NOT_REQUIRED` on save; author "didn't touch reviewers" |
| E2 | Admin flips `NONE→REQUIRED`; FE still shows NONE (reviewer UI hidden), sends `reviewerUserIds:[]` | `AT_LEAST_ONE_REVIEWER_REQUIRED`; FE has no control to add a reviewer → stuck until reload |
| E3 | Admin renames a Sub-Type; existing docs keep the old name | resolve fails → silent fallback to `REQUIRED` → every later Draft edit → E2 |
| E4 | Admin deactivates a referenced Sub-Type | same silent fallback to `REQUIRED` |
| E5 | Switch Sub-Type to a NONE type while a Draft has **saved** reviewers; FE sends `[]` | `Saved reviewers cannot be removed or reordered` **and** cannot proceed → dead Draft |
| E6 | Sub-Type policy changed between revision snapshot and submit | FE (live) vs submit (snapshot) disagree → 400 with no actionable message |
| E7 | FE predicts requirement by Sub-Type **name**; two Sub-Types across different Document Types share a name | wrong prediction → E1/E2 |
| E8 | Document Type has no Sub-Types → dropdown only offers "None" (`value=""`, = *no Sub-Type*) | picking it ⇒ `REQUIRED` ⇒ "why review required, this type has no sub-types" |
| E10 | Draft create omits `reviewerUserIds` entirely | no validation at draft save; error deferred to Upload-Revision / Submit |
| E11 | Error codes thrown as mixed `IllegalArgumentException` / `IllegalStateException` | FE shows generic "error" toast, not actionable |

## 2. Decisions (owner-approved 2026-09-08)

- **D1 (S1) — Snapshot on the Document.** Add `document_record.review_requirement`. It is set
  when the Sub-Type is chosen/changed on a Draft and is the **single** source read by every
  validator, the detail/list DTOs, and (via the DTO) the frontend. An admin changing a
  Sub-Type's policy later does **not** retroactively change an in-flight Draft. Backfill from
  the current live resolution. (Consistent with existing BR-DOC §09:54 for Revisions.)
- **D2 (S2) — Sub-Type by foreign key.** Add `document_record.sub_type_id` → `document_sub_types.id`
  (`ON DELETE RESTRICT`). Keep `sub_type` (name) as a denormalised display value. Resolution is
  by id; **rename is safe** (no orphan). Backfill `sub_type_id` from the current name match.
- **D3 (S4) — Do not auto-remove reviewers.** Switching a Draft's Sub-Type to a NONE-review
  type while it has **saved** reviewers is **rejected** with an actionable message:
  *"Remove the saved reviewers first (requires e-signature) before switching to a Sub-Type that
  does not use review."* No silent deletion of assigned participants.
- **D4 — Full validation path.** One-change record (this file), grep-based impact analysis
  (GitNexus MCP not available this session), and negative + concurrency test evidence.
- **D5 (S8) — Relabel.** The `value=""` option in the Sub-Type dropdown is relabelled
  `— No Sub-Type (review required) —`.

## 3. Invariant statement

For a Draft Document `D` owned by workflow-coordinator `C`:

- `D.review_requirement` is fixed at the moment a Sub-Type is set/changed on `D`, from
  `subtype.review_requirement` (or `REQUIRED` when no Sub-Type / unresolved).
- Every reviewer-assignment validation (`validateReviewerRules` and the RevisionService
  mirrors) uses `D.review_requirement` (Draft) or `revision.review_requirement` (in-flight
  Revision) — never a fresh live lookup.
- `NONE` ⇒ reviewer participants MUST be empty; `REQUIRED` ⇒ ≥1. A Sub-Type change that would
  violate this against **already-persisted** reviewers is rejected, not auto-corrected.
- Mandatory audit for the Sub-Type / review-requirement change stays in the same transaction
  as the field write (no best-effort downgrade).
- e-signature tokens for suspend/terminate-style flows are unaffected; no replay path added.

## 4. Impact analysis (grep-based; GitNexus MCP unavailable this session)

| Symbol | Callers / effect |
|---|---|
| `DocumentService.resolveDocumentReviewRequirement` | 6 call sites (DTO ×2, `saveDraftAssignments`, `updateDocumentDraft` re-validate, `configureInitialWorkflow`, `updateActiveWorkflowConfiguration`). Change: read `document.review_requirement` (stored) instead of live Sub-Type lookup. Risk: **HIGH** (core Draft workflow). Mitigated by backfill + tests. |
| `RevisionService.resolveReviewRequirement` | 2 call sites (`createDraftRevision` snapshot set, upload-revision gate). Change: read `document.review_requirement`. Behaviour unchanged for revisions already snapshotted. Risk: **MEDIUM**. |
| `DocumentService.applyDraftFields` (Sub-Type block) | Set `sub_type_id` + `review_requirement` on Sub-Type set/clear; enforce D3 guard. Risk: **HIGH**. |
| `applyDocumentSubType` / `updateDocumentSubType` (dictionary) | Rename now allowed (D2). No retro-write to documents. Risk: **LOW** (documents no longer name-match). |
| `DocumentDetailResponse` / `DocumentListItemResponse` | Field value source changes to stored column. DTO shape unchanged. Risk: **LOW**. |
| Migration on `document_record` | Two nullable columns + FK + backfill on a core table. Risk: **MEDIUM** (table size, lock). Use `ALTER TABLE ... ADD COLUMN` (nullable, no default rewrite) + batched backfill. |
| Frontend `NewDocumentView.tsx` | Stop client-predicting; treat DTO `reviewRequirement` as authoritative; keep a "Refresh requirement" affordance; reconcile on `REVIEW_*` errors. Risk: **LOW**. |

Affected processes: WF-DOC-01 (create), WF-DOC-02 (draft edit), WF-REV-01 (submit for review),
Document Sub-Type dictionary CRUD.

## 5. Implementation (phased)

**Phase 1 — BE data model + snapshot (regulated core)**
1. `DocumentRecord`: add `subTypeId` (`@ManyToOne`→`DocumentSubType`, `insertable/updatable` normal) + `reviewRequirement` (`@Enumerated(STRING)`, nullable).
2. Migration `V4xx`: `ALTER TABLE document_record ADD COLUMN sub_type_id UUID`, `ADD COLUMN review_requirement VARCHAR(16)`, `ADD CONSTRAINT fk_document_sub_type FOREIGN KEY (sub_type_id) REFERENCES document_sub_types(id)`. Backfill: `UPDATE document_record d SET sub_type_id = st.id, review_requirement = st.review_requirement FROM document_sub_types st JOIN document_types t ON t.id = st.document_type_id WHERE d.document_type_id = t.id AND lower(d.sub_type) = lower(st.name)`. Then `UPDATE document_record SET review_requirement='REQUIRED' WHERE review_requirement IS NULL` (covers no-subtype + unresolved).
3. `applyDraftFields` Sub-Type block: on set → resolve by name→id, store `subTypeId`, `subType=name`, `reviewRequirement=subtype.reviewRequirement`; on clear → all null + `reviewRequirement=REQUIRED`. Enforce **D3**: if new requirement is `NONE` and the Draft currently has ≥1 persisted REVIEWER participant → `throw new IllegalArgumentException("REVIEWERS_MUST_BE_REMOVED_FIRST: remove the saved reviewers (requires e-signature) before switching to a Sub-Type that does not use review")`.
4. `resolveDocumentReviewRequirement` → return `document.getReviewRequirement()` (default `REQUIRED` if null). `RevisionService.resolveReviewRequirement` → same. Keep the private methods as the single read point.
5. **S5**: in `saveDraftAssignments`, when `reviewerUserIds == null` and `review_requirement == REQUIRED` and no REVIEWER participant exists yet → return a field-level warning in the response (non-blocking) OR (min) leave deferred but ensure the later gate message is actionable. (Chosen: keep deferred, improve message — see S7.)

**Phase 2 — Concurrency / error contract**
6. **S6**: `submitForReview` — if `revision.review_requirement != document.review_requirement` → `throw new IllegalStateException("REVIEW_REQUIREMENT_CHANGED: the Sub-Type review policy changed after this revision was created; reopen the revision to reconcile reviewers")`.
7. **S7**: audit the full set of codes (`REVIEW_NOT_REQUIRED`, `AT_LEAST_ONE_REVIEWER_REQUIRED`, `REVIEWER_REQUIRED`, `APPROVER_REQUIRED`, `REVIEWERS_MUST_BE_REMOVED_FIRST`, `REVIEW_REQUIREMENT_CHANGED`, `Saved reviewers cannot be removed…`). Ensure each is a stable prefix `CODE: message`. FE maps prefix→i18n toast; catches both `error.response.data.message` shapes.

**Phase 3 — Frontend**
8. `NewDocumentView.tsx`: `reviewRequirement = serverReviewRequirement` (drop client prediction as the primary; keep only as pre-first-save hint). Reviewers tab in NONE state keeps a visible "This Sub-Type does not use review" panel + a "Re-check" button that refetches the document detail. On any `REVIEW_*` error → refetch detail, re-render reviewer UI, toast the mapped message.
9. Sub-Type dropdown: `value===""` label → `— No Sub-Type (review required) —` (**D5**).

**Phase 4 — Tests (negative + concurrency)**
- `applyDraftFields`: set NONE Sub-Type with existing saved reviewer → `REVIEWERS_MUST_BE_REMOVED_FIRST`.
- `applyDraftFields`: rename Sub-Type in dictionary, then edit Draft → still resolves via `sub_type_id`, `review_requirement` unchanged (snapshot).
- `saveDraftAssignments`: `REQUIRED` + empty reviewers → `AT_LEAST_ONE_REVIEWER_REQUIRED`; `NONE` + non-empty → `REVIEW_NOT_REQUIRED`.
- `submitForReview`: document `review_requirement` mutated after revision snapshot → `REVIEW_REQUIREMENT_CHANGED`.
- Concurrency: two parallel `updateDocumentDraft` — one changes Sub-Type, one adds reviewer — assert no state where `review_requirement=NONE` with a persisted reviewer.
- Migration backfill: doc with resolvable Sub-Type → `sub_type_id` + `review_requirement` set; doc with orphan name → `review_requirement='REQUIRED'`, `sub_type_id` NULL.

## 6. Rollback

- Migration is additive (2 nullable columns + FK). Rollback = `ALTER TABLE document_record DROP CONSTRAINT fk_document_sub_type, DROP COLUMN sub_type_id, DROP COLUMN review_requirement`.
- Code reverts to live `resolveDocumentReviewRequirement`. No data loss (the name string `sub_type` is retained throughout).

## 7. Evidence / open risk

- `detect_changes` vs `main` to be captured before commit (GitNexus MCP unavailable this session — record the `git diff --stat` instead).
- Residual: documents whose `sub_type` name never matched any Sub-Type (data drift pre-dating this change) get `review_requirement='REQUIRED'` — safe default, but list them post-migration for DCO review (`SELECT document_number, sub_type FROM document_record WHERE sub_type IS NOT NULL AND sub_type_id IS NULL`).

## 8. Implementation evidence (2026-09-08)

Actual table name is `documents` (not `document_record`); `DocumentRevisionRecord` maps to
`document_revisions`. Review-requirement values after V389 are `NONE` | `REQUIRED` (VARCHAR(16)).

**Delivered:**

| Phase | Change | File |
|---|---|---|
| 1 | `subTypeId` (UUID) + `reviewRequirement` (`@Enumerated(STRING)`) fields + accessors | `entity/DocumentRecord.java` |
| 1 | `V408__snapshot_review_requirement_and_subtype_fk_on_documents.sql` — 2 nullable cols, `fk_documents_sub_type` (`ON DELETE RESTRICT`), `ck_documents_review_requirement`, `idx_documents_sub_type_id`, name→id backfill scoped by `document_type_id`, `REQUIRED` default for the remainder | new migration |
| 1 | `applyDraftFields` Sub-Type block: snapshot `subTypeId` + `reviewRequirement`; **D3** guard `REVIEWERS_MUST_BE_REMOVED_FIRST` when switching to `NONE` with ≥1 persisted REVIEWER; no-Sub-Type path re-freezes at `REQUIRED`; trailing null-guard for legacy/new rows | `service/DocumentService.java` |
| 1 | `resolveDocumentReviewRequirement` → reads `document.getReviewRequirement()` (null ⇒ `REQUIRED`); Sub-Type table no longer read live | `service/DocumentService.java` |
| 1 | `resolveReviewRequirement` → same snapshot read; `syncDraftRevisionWithDocument` now also re-syncs `subType` + `reviewRequirement` onto the open Draft revision | `service/RevisionService.java` |
| 1 | `countByDocument_IdAndParticipantType` | `repository/DocumentWorkflowParticipantRepository.java` |
| 2 | **S6** `submitForReview`: `REVIEW_REQUIREMENT_CHANGED` when `revision.reviewRequirement != document.reviewRequirement` | `service/RevisionService.java` |
| 2/3 | **S7** `REVIEW_ERROR_CODE_MESSAGES` prefix→toast map in `extractApiMessage` (also reads `error.code`, splits `CODE:` prefix) | `NewDocumentView.tsx` |
| 3 | **D5** Sub-Type `value=""` option relabelled `— No Sub-Type (review required) —` | `NewDocumentView.tsx` |
| 4 | `tcDoc006b` (D3 reject + roster/Sub-Type unchanged after rollback), `tcDoc006c` (snapshot frozen — later Sub-Type policy edit does not change in-flight Draft; asserts `subTypeId` set) | `test/.../DocumentLifecycleBaselineTest.java` |

**Deviations from §5:** S5 left as "keep deferred, improve message" (as pre-chosen). FE keeps the
client prediction strictly as a pre-first-save hint (`serverReviewRequirement ?? clientPredicted…`);
existing S3 reconcile-on-error + Reviewers-subtab-always-visible behaviour was already present.

**Test evidence:** `mvnw -o -Dtest=DocumentLifecycleBaselineTest test` → 21/0/0.
`RevisionBusinessRulesTest,RevisionUpgradeSessionServiceTest,DocumentMasterActionCapabilityServiceTest`
→ 40/0/0. `mvnw -o test-compile` clean. FE `tsc --noEmit` clean for touched files. V408 applied
cleanly against the integration DB (Flyway `validate-on-migrate=true`) during the test run.

**detect_changes substitute** (GitNexus MCP unavailable): `git diff --stat` — the two service
files also carry unrelated earlier-session edits; this change's net additions are ~120 lines
across entity/repo/migration/test + ~40 in `NewDocumentView.tsx`.

**Residual-risk query (post-migration, for DCO review):**
`SELECT document_number, sub_type FROM documents WHERE sub_type IS NOT NULL AND sub_type_id IS NULL;`
— these carried a Sub-Type name matching no live Sub-Type of their Document Type and were set to
`review_requirement='REQUIRED'` (safe default).

## 9. Follow-up: additional test + FE reconcile (2026-09-08)

**Tests added:**
- `RevisionBusinessRulesTest.submitForReview_documentReviewRequirementChangedAfterRevisionSnapshot_isRejected`
  — S6: revision snapshot `REQUIRED`, document snapshot `NONE` ⇒ `IllegalStateException`
  `REVIEW_REQUIREMENT_CHANGED`, thrown before any signature/side effect.
- `DocumentLifecycleBaselineTest.tcDoc006d_concurrentSwitchToNoReviewSubType_neverLeavesNoneWithSavedReviewer`
  — two parallel `updateDocumentDraft` both switching to a `NONE` Sub-Type with a saved reviewer;
  asserts at least one is rejected and the end state is never `review_requirement=NONE` with a
  REVIEWER still persisted, and the reviewer was not silently removed.

**FE reconcile ([NewDocumentView.tsx](../../eqms/src/features/documents/document-list/document-creation/NewDocumentView.tsx)):**
- `isReviewRequirementError(error)` — recognises the `MACHINE_CODE:` review-requirement guardrail
  errors; `performSaveDraft` catch now calls `hydrateDocumentFromBackend(documentId, false)` on
  such an error so the Reviewers tab + authoritative `reviewRequirement` snapshot re-sync before
  the user retries.
- "Re-check requirement" button in the `NONE` Reviewers panel — manual refetch of Document detail.

**`saveDraftAssignments` reviewer-rule negatives** (`REVIEW_NOT_REQUIRED`,
`AT_LEAST_ONE_REVIEWER_REQUIRED`): unchanged logic, already covered by the existing
`RevisionBusinessRulesTest` suite; the snapshot change only alters the *source* of the
`ReviewRequirement` passed in, which `tcDoc006b/006c/006d` now exercise end-to-end.

**Test run:** `DocumentLifecycleBaselineTest` 22/0/0 · `RevisionBusinessRulesTest` 33/0/0 ·
`RevisionUpgradeSessionServiceTest` + `DocumentMasterActionCapabilityServiceTest` +
`DocumentCancelObsoleteGuardTest` — batch total 69/0/0. FE `tsc --noEmit` clean.
