# Change record — `has_related_documents` / `has_correlated_documents` flag drift

**Date:** 2026-09-08
**Area:** Document Control — document/revision relations
**Type:** Defect fix + data repair (no behaviour/policy change)

## 1. Problem

The All Documents list (and the Revisions list, and the "Related Document = Yes/No" filter) showed
**"No"** in the Related/Correlated column for a document that visibly *had* a related document in
its expandable detail panel (reported: `SOP.0037` → related `POL.0001`, column said "No").

- The list column and the filter read the **denormalised boolean** `documents.has_related_documents`
  / `has_correlated_documents` (and the per-revision snapshot on `document_revisions`).
- The expandable detail reads `document_relations` **live**.

## 2. Root cause

`document_relations` has three writers in `DocumentService`:

| Writer | Path | Updated the flag? |
|---|---|---|
| `applyDraftFields` (from request payload count) | draft create/update | yes |
| `saveDraftAssignments` (delete + re-insert rows) | draft create/update | **no** (relied on `applyDraftFields` running in the same request) |
| `replaceActiveDocumentRelations` (delete + re-insert rows) | `updateActiveWorkflowConfiguration` — "configure next revision's related/correlated documents" on an **already-Active** document | **no** |

Editing relations on an Active document therefore wrote/removed `document_relations` rows but left
the boolean flags untouched, and `updateActiveWorkflowConfiguration` then `save()`d the document
with the stale flag. `document_relations` is keyed by `source_document_id` (the document, not a
revision), so every revision of a document shares one relation set — the per-revision snapshot must
always equal the document's flag; any divergence is drift.

## 3. Invariant

`documents.has_related_documents == EXISTS(document_relations WHERE source_document_id = id AND relation_type = 'RELATED')`
(and the same for `CORRELATED`, and for each `document_revisions` row vs. its parent document).

## 4. Fix

- `DocumentService.replaceActiveDocumentRelations` — set the matching flag from the resolved row
  set after the delete/insert (new helper `applyRelationPresenceFlag`).
- `DocumentService.saveDraftAssignments` — same, defensively, so the flag is correct regardless of
  whether `applyDraftFields` also ran for the request.
- `DocumentService.updateActiveWorkflowConfiguration` — include `relatedDocumentsChanged` /
  `correlatedDocumentsChanged` in the condition that triggers
  `RevisionService.syncDraftRevisionWithDocument(...)`.
- `RevisionService.syncDraftRevisionWithDocument` — copy `hasRelatedDocuments` /
  `hasCorrelatedDocuments` from the document onto the open Draft revision; corrected the
  now-misleading Javadoc ("need no resync").
- **Migration `V409__repair_has_relation_flags_from_document_relations.sql`** — recompute the flags
  on `documents` from `document_relations`, then propagate to `document_revisions`.

`applyRevisionSnapshot` already copies the flags from the (now-correct) document; no change there.

## 5. Evidence

- Full backend suite: **760 tests, 0 failures, 0 errors** (unchanged count — no regression).
- V409 applied to `eqms-database` (Flyway 409). Post-migration live queries:
  - `SOP.0037`: `has_related_documents = true` (1 relation row), `has_correlated_documents = false`
    (0 rows) — list column now shows "Yes" for Related.
  - `documents` rows still drifted: **0**.
  - `document_revisions` rows drifted vs. parent document: **0**.
  - 17 documents now correctly flagged `has_related_documents = true`.
- `detect_changes` substitute (GitNexus MCP unavailable): changes confined to
  `DocumentService.java` (2 writer sites + 1 trigger condition + 1 helper), `RevisionService.java`
  (`syncDraftRevisionWithDocument`), migration `V409`.

## 6. Follow-up (not blocking)

`updateActiveWorkflowConfiguration` has **no** integration test today (its several authorization
gates make setup heavy). A dedicated test — activate a document, configure a next-revision related
document, assert the flag + list DTO — is the ideal regression guard and should be added when that
method next gets substantive work.

## 7. Rollback

Code changes are additive flag maintenance; reverting them reintroduces the drift but breaks
nothing. `V409` is idempotent (guarded `WHERE` clauses) and can simply be re-run; there is no
down-migration needed because it only corrects data to match `document_relations`.
