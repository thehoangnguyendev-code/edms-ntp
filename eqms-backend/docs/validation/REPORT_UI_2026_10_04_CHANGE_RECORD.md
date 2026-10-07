# Report template UI follow-up — 2026-10-04

Owner request: reuse Controlled Copy's Konva library for mark transforms; remove redundant
section heading and fix breadcrumbs; simplify charts and presentation-field insertion;
align catalog/detail/new/edit with existing shared UI and Publishing Template conventions.

Decision baseline: REPORT-ANALYTICS-2026-10-03 and REPORT-LAYOUT-2026-10-03.
Invariants: same active administrator permission, server-generated previews/aggregates,
versioned Save Changes with mandatory reason/audit, immutable historical artifacts,
unchanged document access and other signature/workflow behavior. No new retention rule.
Canvas edits are draft presentation values, not client-generated report files or analytics.
Existing copy-policy editors and Publishing Templates remain unchanged.

GitNexus: new report symbols return UNKNOWN (not indexed). Manually trace caller/API/tests.
Source evidence:
- ReportLayoutDesigner uses shared FormSection/Input/Select/Checkbox/TabNav and existing
  copy-policy MarkCard controls. Named automatic fields expose descriptions/examples at each
  explicit insertion target. Cover/header/footer are separate structured configuration cards.
- ReportMarkCanvas uses existing react-konva/Konva Transformer for draft move/resize/rotate.
  The background PNG is obtained from the existing server PDF renderer through authenticated
  POST /reports/templates/layout/preview-page; no report records/files are created.
- ReportLayoutController retains current permission/validation/no-store boundaries. Chart
  configuration demonstrations now contain 3 categories (5/3/2), explicitly marked demonstration.
- ReportTemplateService advertises dateFields from provider-declared DATE filters, not client
  field-name heuristics. Monthly trend selectors accept only those declared fields.
- ReportTemplateEditor removes the redundant title above tabs; final breadcrumb equals page
  title. ReportTemplateCatalog uses shared DataTable/Badge/FormSection for list/details.

Verification (2026-10-04, local development):
- Vitest: 14 passed across report template tests and shared Select regression tests.
- TypeScript noEmit: passed. Vite production build: passed (existing large-chunk warning).
- Focused report JUnit suite: 49 passed, 0 failures/errors/skips, including isolated PostgreSQL
  schema tests and permission boundaries. New tests cover raster preview authorization,
  invalid pages, named insertion and server-declared date-field contracts.
- Docker backend/frontend rebuilt/recreated; backend health healthy.
- Chrome Admin TEST_DOCUMENT_REGISTER: removed heading, correct breadcrumb, server-rendered
  chart page with three colored categories/counts; named Prepared by inserted into Header;
  Monthly trend automatically selects Effective Date and excludes text fields.
- Real pointer drag changed watermark coordinates; corner resize changed width/font size;
  rotate handle changed angle. These TEST draft changes were discarded without Save Changes.
- Mobile viewport 375x812: document scrollWidth 375; shared cards stack, no horizontal overflow.
  Viewport override reset after verification.
- Catalog list/detail use the shared table and Template Details FormSection. New Template
  breadcrumb and PageHeader both show New Report Template. No new template was saved.
- Screenshots: target/report-template-ui-2026-10-04.png and
  target/report-template-mobile-2026-10-04.png (local, not committed).
- GitNexus detect-changes compare main: CRITICAL across the existing dirty working tree
  (55 tracked files/167 symbols/19 flows, including unrelated prior changes). No commit/push.

Residual limitations: canvas text is a positioning aid; PDF Preview remains authoritative for
font fitting/token replacement. Cover/header/footer use structured settings, not a newly added
DOCX upload designer. No full-system regression or GMP compliance claim is made. Permissions,
versioned saves, historical artifacts and other workflows were not intentionally changed.
