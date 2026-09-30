# CHG-UI-TABLE-20260930 — Shared table renderers

Status: source implementation and automated checks completed; full browser visual QA not executed.

## Request / scope

User requested a complete inventory and common implementation for tables across the project, including nested/detail screens, then authorized continued migration through completion. This record covers presentation refactoring only.

Sources: `src/components/ui/table/DataTable.tsx`, `TablePrimitives.tsx`, `tableStyles.ts`, `ResponsiveTable.tsx`, `index.ts`; the complete consumer inventory is in `docs/TABLE_COMPONENTS.md`.

The project does not currently contain the referenced `eqms-backend/docs/validation/08_ONE_CHANGE_RECORD_TEMPLATE.md`, system assurance documents or governance decision log. This source-backed record follows the existing project change-record structure. It introduces no new regulated business rule and makes no compliance claim.

## Invariant

- Actors, permission checks, object scope and backend capability conditions are unchanged.
- Lifecycle transitions and parent/child effects are unchanged.
- Artifact version/checksum, storage, audit, electronic signature and async generation code are unchanged.
- Specialized table rendering preserves DOM structure, classes, native attributes, ref forwarding, spans, callbacks, conditionals, controls, selection and expanded content.
- The table system performs no fetching, filtering or client-side authorization. Feature/server logic owns those operations.

## Impact evidence

GitNexus upstream impact was executed for the named functions/components containing table markup before their edits. Most results were LOW. OriginalDocumentTab and MaterialApproversTab/MaterialAuditTrailTab/MaterialReviewersTab were MEDIUM (5 direct callers). ESignatureModal was CRITICAL (46 direct callers, 27 processes), and AuditTrailTab CRITICAL (10 direct callers, 6 processes); the user was notified before edits. The changes in these shared components are mechanically verified DOM substitutions only.

DataTable is newly introduced and not in the existing index; impact returned UNKNOWN. Direct source inspection found its consumers and its DOM contract is covered by new tests.

GitNexus detect-changes ran after migration: 139 tracked changed files, 501 symbols, 96 affected processes, critical overall. This is the dirty worktree's combined change set, including user-owned backend/other changes present before this task, not a table-only result. The AST baseline is the table-scoped evidence; no commit or push was performed.

## Verification evidence

- AST migration: 103 files / 2,078 JSX table elements migrated. Normalization against the 443-file pre-migration source snapshot produced zero differences outside the explicit table-tag/style/import changes. The migrated subset baseline and verification script are saved.
- Native JSX table tags are now restricted to TablePrimitives. A source-boundary regression test enforces this for screens, tabs, modals and child row/cell renderers.
- DOM contract tests: 3 passed, including native hierarchy, React 19 ref forwarding, colspan/rowspan, input callbacks, selection, sorting, row actions and Action click isolation.
- Production Vite build: passed (23.33 s).
- Full suite: 83 passed / 8 failed / 91 tests. Seven failures originate from missing ToastProvider in DetailDocumentView lifecycle tests when rendering UncontrolledCopyEligibilityCard; one from the existing KnowledgeExplorerPage initial-folder/widget assertion. A temporary Vite transform restored the pre-migration native JSX in memory and reran both failing suites: same 8 failures (16 passed / 24 tests). The temporary config was removed after the comparison.
- TypeScript: no remaining diagnostics in migrated table sources. Five diagnostics persist in DocumentPdfViewer, seen before and after migration: unsupported fit-page/fit-width ZoomLevel strings and four missing PdfPreviewSettings document-menu fields. These files were not edited by this task.

## Limits / follow-up evidence

Automated DOM and AST evidence confirms this refactor preserves the rendering contract; it does not establish GxP compliance or replace browser-based visual QA. Existing layouts remain as-is through compatibility variants; a later redesign can consolidate variants with explicit visual review. DB/API/backend changes are not required for this presentation-only migration.

