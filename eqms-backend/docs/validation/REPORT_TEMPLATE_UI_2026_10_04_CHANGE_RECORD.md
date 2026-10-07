# Report template UI and soft deletion — 2026-10-04

Decision: REPORT-TEMPLATE-UI-DELETE-2026-10-04.
Scope: Report catalogs/configuration, template designer, Create Report, server catalog
filters and soft-deletion migration/API. Not source-document workflows or signatures.

Invariants: active actor and existing permission checks; server role metadata scope;
version-pinned save/delete; transactional mandatory audit; no physical deletion of
versions, run snapshots or files; prior artifacts retain scope checks; queued generation
cannot produce a new artifact from a deleted template. Preview does not persist changes.

Before: four-column catalog with fixed detail sidebar, no catalog filters/delete action,
custom Create Report step cards, template design preview disabled when name was blank.
After: shared DataTable/drag scrolling/pagination (10), server filters and sort allowlists,
portal ActionDropdown, shared Drawer/FormModal, versioned audited soft deletion, shared
TabNav/WorkflowStepper/Select search. Designer uses Controlled Copy MarkCard and existing
Konva transformer, 5/7 responsive configuration/preview columns and grouped settings.
New layout preview uses a temporary title; mandatory Save validation remains unchanged.

Source: ReportTemplateCatalog/Editor/Run/Lookup/LayoutDesigner, reportTemplates API;
ReportTemplateService/Controller and V536__report_template_soft_delete.sql.
Tests: nine backend report suites, 64 cases (latest surefire reports: zero failures/errors),
including PostgreSQL isolated-schema delete/version/audit rollback/current-scope checks;
frontend report and Select suites: 19 cases, zero failures; TypeScript and production
Vite build passed. Docker backend/frontend updated; backend healthy.
Runtime desktop/mobile checks remain pending authenticated browser access. No production
template has been deleted for testing. Automated tests use isolated schemas and mocks.
The prescribed 08_ONE_CHANGE_RECORD_TEMPLATE.md is absent; this record preserves scope,
approved decision, invariants, risk, implementation and test evidence explicitly instead.
GitNexus does not index new Report symbols (UNKNOWN), so callers/API/tests are traced
directly. Passing builds alone do not demonstrate GMP compliance.

## Catalog UI regression correction — 2026-10-04

Cosmetic scope only: keep shared DataTable, pagination, drag scrolling and server
queries. SmartDropdown measures its own width (not the small action trigger) and
bounds portal placement/width to the viewport. Template links remove responsive
padding/height so names align with codes; report action menus use a 240px minimum.
No permission, lifecycle, deletion, audit, signature, DB or API behavior changes.
GitNexus SmartDropdown upstream impact: LOW, one direct caller, no indexed process;
the newly added ReportTemplateCatalog remains unindexed and was traced directly.

Evidence: TypeScript check, production Vite build and 23 frontend tests passed
(report, Select and four new dropdown positioning/dismissal cases). Authenticated
Chrome check: report row menu fits desktop and 375px mobile (left 127, right 367,
viewport/page width 375); View Detail opens the shared drawer; Escape closes menu.
No data mutation used. Frontend-only Docker rebuild preserves backend sessions.
Screenshots: target/report-template-table-fixed.png and
target/report-template-table-mobile.png (local runtime evidence, not committed).
This is targeted UI regression evidence, not complete module/GMP validation.

## Catalog consistency with Uncontrolled Copies — 2026-10-04

UI-only change to ReportTemplateCatalog: same page/card padding, table wrapper,
shared DataTable/TableEmptyState/SectionLoading and default sticky Action styling
as UncontrolledCopiesView. Classic filters use md:2/lg:3 columns; Clear Filters
is the sixth grid item, aligned like the reference. Existing DesktopFilterPanel,
FilterDrawer/FilterAccordionItem/FilterOptionButton and portal actions remain.
No server queries, access checks, deletion, generation or data persistence changes.

Evidence: 21 report/Select/frontend layout tests passed; TypeScript and Vite build
passed. Authenticated desktop DOM measured exactly three grid columns. At 375px
the page width remains 375px; mobile FilterDrawer shows all four groups and Apply.
Frontend Docker updated. Runtime screenshots: target/report-catalog-aligned-desktop.png
and target/report-catalog-aligned-mobile.png. GitNexus impact UNKNOWN for this newly
added component; callers traced to ReportTemplatesView and ReportConfigurationView.

## History, schedules and layout consistency — 2026-10-04

Approved scope: synchronize History/Scheduled Reports with existing list screens,
align all report breadcrumbs with page titles, show the configuration change reason
only in General, and replace Layout Designer's PDF/Position tabs with a permanent
Position Editor following Controlled Copies Policy PDF Markings.

Invariants: existing server search/sort/pagination, 10-row pages, permissions,
schedule status actions, template version and mandatory save reason are unchanged.
No changes to backend, database, generation lifecycle, retention, signatures or
audit persistence. Canvas background still uses the existing server previewPage
endpoint; geometry edits are unsaved drafts. No business data was changed in UI QA.

Implementation: shared DataTable/loading/empty state, table drag scrolling, portal
actions and drawer; ReportListFilters uses existing classic/compact/mobile controls,
classic max three columns and draft Apply. Report Details and schedule forms use
FormSection. reportBreadcrumbs provides dashboard/module/parent/current-title paths.
The Layout Designer settings/canvas split is 4/8 desktop and stacked mobile.

GitNexus: History and Scheduled exact upstream impact LOW, one direct caller each,
no indexed processes. New Editor/Catalog/Run/LayoutDesigner/MarkCanvas symbols are
unindexed (UNKNOWN); source callers traced within report and report-configuration.

Evidence: 31 frontend tests across report/Select/SmartDropdown suites passed,
including server delegation, Apply-only draft submission, hidden unauthorized
schedule actions, disabled unavailable downloads, direct canvas and one General
reason retained across tabs. TypeScript and Vite production build passed (existing
large-chunk warning remains). Authenticated Chrome verified History table/portal,
Scheduled table/new drawer/mobile filter, configuration breadcrumbs and actual
server-rendered position canvas. At 375px document width is 375px and canvas width
308px; no page overflow. Frontend Docker rebuilt; backend not restarted.
Screenshots: target/report-scheduled-mobile-ui.png and
target/report-layout-position-ui.png. These are local runtime QA artefacts, not
formal full-module/GMP validation evidence.
