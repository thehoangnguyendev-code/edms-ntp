# Form Settings administration layout — 2026-10-02

## Follow-up: consistent Clear Filters button

Owner requested matching sibling screens. The normal-mode Clear Filters Button
now uses the same outline/sm and class set as ControlledCopiesView, including
36px height, horizontal padding and red background/white text on hover. Handler,
server query, permission checks and signed save are unchanged. Upstream impact
LOW, zero indexed callers/processes. Regression assertion checks the common
classes alongside the existing clear-filter API test. No live browser visual QA.

## Follow-up: withdraw Active / Form defaults

Owner withdrew the default-filter request. Status, Document Type and mobile draft
start at All again; automatic Form lookup selection was removed. Initial API
query has no status/type constraint. Users still choose filters, with compact-mode
changes committed on Apply. This supersedes the defaults section below; no server,
permissions, record workflow or save behaviour changed. Exact page impact LOW,
zero indexed direct callers or affected processes. Regression tests updated to
assert the unconstrained initial request and explicit user-selected Form UUID.

## Follow-up: editable Active / Form defaults

Owner requested initial Status Active and Document Type Form, both editable.
Initial state sends ACTIVE and resolves Form to the document-type lookup value
(the backend returns a UUID, not a hardcoded FORM code). Before lookup resolution,
the existing backend also accepts the Form name in addLookupPredicate. Resolution
does not overwrite a user-changed filter. Compact controls still commit only on
Apply, normal controls and mobile drawer use the same server query; Clear remains
All. No client-side record filtering was added. Scope/permissions, lifecycle,
artefacts, signature/audit and async generation are unchanged. Page upstream
impact LOW. Eight focused tests passed, covering initial UUID query, overrides of
both defaults, Cancel/Apply, layout switching, sorting and ten-row pagination.

## Follow-up: respect the global desktop-filter mode

Source-confirmed cause: Form Settings rendered DesktopSelectFilters unconditionally,
unlike sibling screens that read compactDesktopFilters from useBranding. It now
subscribes to that existing shared configuration hook (including its existing
branding-updated SSE invalidation) and renders either compact draft/Apply controls
or the standard Search/Status/Document Type grid with Clear Filters. Mobile drawer
is unchanged; committed filters are preserved across mode changes. Normal controls
update the same server query and reset page to 1. No new backend API, DB field,
permission, e-signature or record workflow change. Exact page impact: LOW.

Seven focused tests passed, including a simulated shared-setting update in the
mounted page, retained ACTIVE filter, clearing server query and switching back.
This is not a live multi-user SSE/browser validation; no deployment performed.

## Follow-up: compact header and drag scrolling

Owner requested reducing the header height and wiring the existing useTableDragScroll
hook. Removed the page-specific min-h-8 header-button constraint (shared DataTable
header padding remains unchanged) and passed scrollerRef, isDragging and dragEvents
through the existing DataTable API. No shared hook/table implementation changed.
The hook preserves text selection and suppresses row-selection clicks after a drag.
Ten-row server pagination, sort/filter query and signed save remain unchanged.
Exact page impact is LOW, zero indexed dependants. Six focused tests passed,
including horizontal scroll delta, suppressed post-drag selection and normal click
selection afterwards. Browser height/visual QA was not performed for this follow-up.

## Follow-up: shared table and maximum ten rows per page

Owner request: use `components/ui/table` and show at most ten records per page.
The page already used DataTable; imports now consistently use the shared table barrel
for DataTable, TableEmptyState and TablePagination. Page size is a constant 10 sent
to the existing server pagination API, and the per-page selector is hidden. No client
slice/filter/sort is used; row numbering uses the server page offset (page 2 starts at 11).
The shared table, backend endpoint, permission checks, document selection and signed
save flow are unchanged. Exact page UID upstream impact: LOW, zero indexed dependants.

Verification: five focused page tests passed, including a ten-row server response,
absence of the size selector, API `limit: 10`, and page-two numbering. TypeScript
noEmit passed. No browser visual check or Docker deployment was performed for this
pagination-only follow-up; no new styling, branding, dark mode or layout was introduced.

## Request and scope

One white frame containing two columns: document table with search/filter and No.,
and the existing per-document Form Settings editor. Stack columns on narrow screens.
Use existing UI components and white/slate/emerald styling, not a new design system.
No new regulated business rule is introduced.

## Invariants

- Actor/permission/object: route permission documents.form.configure and existing
  server authorization are unchanged. Configuration remains per selected document.
- Lifecycle/parent-child: no transitions or propagation rules changed.
- Artefacts/version/checksum: no file processing or storage change.
- Audit/e-signature: FormSettingsCard is unchanged. Save still uses its existing
  ESignatureModal and updateFormSettings payload with reason/signatureToken.
- Async generation: no jobs added or modified.
- Search/filter/pagination: documentApi.getDocumentsPage sends search, status,
  documentType, page and limit to GET /documents. Returned rows are not filtered
  client-side. Filter choices come from GET /documents/filters; Apply commits the
  draft and resets page to 1, while Cancel leaves committed filters unchanged.

## Source and impact

FormSettingsAdministrationView.tsx uses DataTable, TablePagination,
DesktopSelectFilters, mobile FilterDrawer, Input/SearchInput and the existing
FormSettingsCard. No. uses the server page offset; keyboard row selection is supported.
Shared components, backend endpoints and DB schema are unchanged.

GitNexus exact UID upstream impact: LOW, 0 indexed direct callers / processes.
The new page is lazily imported through SettingsRoutes. An initial ambiguous lookup
included a CRITICAL unrelated/blank candidate; the exact file UID resolved it.
detect-changes scope all reports pre-existing navigation/route work at MEDIUM risk;
the requested page and new test are untracked and not included by that diff tool.
Existing changes in other files were preserved; no commit performed.

## Verification and limits

- TypeScript noEmit passed.
- Full frontend suite: 212 tests across 35 files passed.
- Three focused page tests cover No./pagination, selected document ID, Apply-only
  server filter query, Cancel, debounced server search and list error state.
- Browser fixture renders the actual page and existing editor with mocked read APIs;
  no signing, saving or database writes performed. Probe screenshots at 375, 768,
  1024, 1280, 1440, 1920 px inspected. Page overflow checks passed at all six widths
  with the editor selected. The table intentionally scrolls inside its own frame.
- Probe reported search placeholder contrast (P1/P2): local overrides now use slate-500.
  P3 (subtle Filter hover) is inherited from the shared Button and retained to match
  other screens. Shared pagination/overlay/focus styling remains unchanged. Fixture
  branding CORS/404 errors are not evidence of a production API failure.
- Very long document names are limited to three table lines with full text in the
  title attribute and selected editor heading.
- Browser QA does not prove production authorization, signature/audit persistence,
  or backend transactions. No BE/DB migration, Docker rebuild or deployment.

The system/governance documents and 08_ONE_CHANGE_RECORD_TEMPLATE referenced by
AGENTS.md are absent in this checkout. This source/test evidence record does not
claim GMP compliance or approve a new workflow rule.

## Follow-up: sortable headers and page-header save action

User requested server-side sorting and moving Save Form Settings beside PageHeader.
Sort is supported for Document Number, Name, Type and Status. No. is a derived page
ordinal, not a stored sort field. Changing sort resets page to 1; repeated clicks
toggle asc/desc. No client row sort/filter/slice was added.

Source-confirmed server path: documentApi.getDocumentsPage → GET /documents →
DocumentService.listDocuments → buildSpecification + PageRequest →
documentRepository.findAll(specification, pageable). resolveSortProperty maps
documentNumber/documentName/type/status to documentNumber/documentName/
documentType.name/status.sortOrder. Server clamps page >= 1 and limit to 1..50.
Existing server authorization/object filtering remains unchanged. No API/DB change.

FormSettingsCard now accepts an optional renderSaveAction slot. The administration
page portals the existing action into PageHeader; other callers keep the inline
button. Dirty/approver checks are unchanged, and the action is disabled while signing.
handleSigned, reason/signatureToken payload, selected document ID and onSaved reload
are unchanged. This supersedes the earlier statement that FormSettingsCard was untouched.

GitNexus FormSettingsCard upstream reported CRITICAL: 1 direct caller, 74 processes,
315 symbols; its direct caller has blank metadata, giving a broad cross-module result.
The warning was presented and the user explicitly approved this scoped edit while
preserving signing/saving. Exact page UID remained LOW. detect-changes reported
8 tracked files / 7 symbols / 2 flows at MEDIUM, including existing unrelated work.
handleSigned is included by hunk mapping but its implementation did not change.

Verification: TypeScript noEmit passed; full frontend suite 216 tests / 36 files
passed. Seven focused tests cover server sort parameters and page reset, prior
search/filter/pagination checks, exactly one save action in the header, dirty and
approver validation, no update before signature confirmation, cancellation without
update, original signed payload/document ID, and backward-compatible inline action.
Signature tests mock the signature adapter; they do not validate token consumption
or audit persistence in a live backend.

Browser QA uses the real page and editor with read API fixtures: one enabled header
save button after a local checkbox change; no page overflow at 375/768/1024/1280/
1440/1920 px. Probe ran at 375/1440 and screenshots were inspected. Shared subtle
hover warnings (Filter and DataTable header) are retained to match the project;
small header targets were increased to 32px. Fixture-only branding CORS/404 is not
production evidence. No live save, Docker rebuild, deployment or commit performed.
