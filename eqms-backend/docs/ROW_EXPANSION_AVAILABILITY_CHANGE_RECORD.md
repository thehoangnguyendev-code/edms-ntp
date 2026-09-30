# Row expansion availability — 2026-09-30

## Request and scope

Hide the chevron before No. when a Document, Revision, or Controlled Copy row has no companion information to display. Frontend display-only correction; no API, entity, migration, permission, lifecycle, signature, audit, stored artefact/checksum, parent-child transition, or async generation changes.

The prescribed `docs/validation/08_ONE_CHANGE_RECORD_TEMPLATE.md`, system assurance documents, and governance decision log are absent from this checkout. This record captures source/test evidence without claiming approved compliance or inventing a business rule.

## Source-confirmed findings and invariants

- DocumentService.toListItem already returns `hasAnyRevision`, derived from `existsByDocument_Id`, plus related/correlated document arrays. DocumentService.getDocumentRevisions checks existing document view authorization before listing revisions. The Document frontend previously always displayed a chevron and passed `hasDocs=true`.
- RevisionService returns `documentId` and relation arrays in RevisionListItemResponse. ExpandedDocumentRow displays the parent Document as well as relations; a parent is therefore valid companion information even when both relation arrays are empty. The shared Revision table previously defaulted expansion to true.
- Controlled Copy lists use batch summaries mapped into `batchId` and `batchQuantity`. A singleton already renders as a normal copy. Expansion now consistently requires a real batch identifier and more than one child from batch quantity (or explicit copy IDs if quantity is absent), not an individual copy's `totalCopies` issuance metadata.
- Empty expansion cells remain in the layout so No. and the remaining columns stay aligned. Expansion metadata is a display hint, never authorization; all existing server endpoint checks remain unchanged. No per-row preload is added.
- ExpandedDocumentRow and ExpandControlledCopiesRow skip detail API requests when expansion availability is false. The latter also suppresses its expanded markup.

## Impact assessment

GitNexus upstream analysis: all five edited component functions LOW. ExpandedDocumentRow has 2 indexed direct callers / 1 affected process; ExpandControlledCopiesRow has 1 direct caller / 1 affected process; the remaining 3 component functions have 0 indexed direct callers / 0 processes. JSX/dynamic dispatch and index limitations mean this is not a runtime isolation guarantee.

## Verification

- `rowExpansion.test.ts`: 20 cases across Document/Revision/Controlled Copy availability, empty data, parent and relations, singleton and multi-copy batches, malformed count, and totalCopies exclusion.
- `RevisionTableView.test.tsx`: 3 render/click tests for no chevron and no expansion on empty rows, parent/relation availability, and caller overrides that can suppress but not force empty expansion.
- `ExpandedDocumentRow.test.tsx`: 2 negative tests for no markup and no document/revision API calls when hasDocs=false.
- Full frontend suite: 19 files / 136 tests passed. The Revision table's export generic was aligned with its documentId API field after TypeScript caught a missing type declaration; its 3 focused tests passed again. Final `tsc --noEmit --pretty false` passed and scoped `git diff --check` passed.
- GitNexus detect-changes on the full dirty worktree reported 150 files / 520 symbols / 100 flows, CRITICAL; this includes extensive pre-existing changes and is not a scoped risk result for this display-only correction. No commit made.
- No browser acceptance, runtime DB query, or deployment performed. Existing server contracts inspected; no DB migration required for this correction.
