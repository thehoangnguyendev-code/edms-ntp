# Report presentation extension — 2026-10-04

Decision: REPORT-WORD-LAYOUT-2026-10-04.
Invariants: active actor and current report permissions; no document-content privilege change;
no parent/child lifecycle changes; immutable components and pinned layouts/checksums; mandatory
versioned Save Changes/audit remains; no electronic signature or approval interpretation;
existing worker reauthorization/publication remains authoritative. No historical file rewrite.

GitNexus: new report symbols UNKNOWN; processOneQueuedRun LOW (1 direct caller),
ReportPlatformService MEDIUM (5 direct callers). Existing convertLocalFileToPdf HIGH
(5 direct callers, 2 processes), reused without changing its implementation.
System As-Is evidence files/change-record template are absent; source/tests remain evidence,
not a compliance claim.

## Implementation evidence

- Migration V535 seals DOCX component bytes, checksum, slot, filename and detected keys;
  database UPDATE/DELETE guards retain uploaded components and historical layouts.
- ReportWordService inspects bounded ZIP/XML packages, rejects external relationships,
  active content, dangerous fields, unknown/signature keys and malformed placeholders;
  validates sealed references before conversion. Conversion concurrency is bounded to two.
- ReportLayoutController, ReportTemplateService and ReportPlatformService reuse current
  authorization/versioned saving/worker publication. PublishingOpenXmlTemplateRenderService
  and OnlyOfficeDocumentEditService are reused; no report e-signature path is introduced.
- ReportLayout, ReportPdfRenderer and ReportPresentationRenderer support portrait/landscape,
  reserved header/footer space, Word component composition and existing pagination.
- ReportLayoutDesigner, ReportMarkCanvas and reportTemplates API reuse shared controls,
  EmbedPDF and Konva positioning; expose explained/copyable keys, movable logo and DOCX uploads.
  UI skill influenced reuse of existing white/emerald controls rather than a new visual system.

## Executed verification — 2026-10-04

- Backend: 60 tests passed across ReportWordServiceTest, ReportAnalyticsTest,
  ReportTemplateDatabaseTest, ReportLayoutTest, ReportLayoutApiTest, ReportTemplateApiTest,
  ReportTemplatePermissionBoundaryTest, ReportMetadataProviderTest and ReportPdfRendererTest.
  Includes isolated PostgreSQL immutability/audit rollback, permission-before-storage,
  checksum failure, XML/ZIP attacks, real publishing renderer metadata substitution with
  no ElectronicSignatureService interaction, pagination and converter failure cleanup.
- One repeated database test initially hit Windows ephemeral-port exhaustion (BindException).
  Test-only data source was changed to a two-connection Hikari pool; complete 60-test rerun passed.
- Frontend: TypeScript check passed; four Vitest files / 16 tests passed, including report
  configuration, async layout upload/preview and shared Select. Production Vite build passed.
  Final Vitest rerun passed after adding translate="no" to literal placeholder keys.
- Runtime: user uploaded report-word-upload-fixture.docx into Header Template of TEST_DOCUMENT_REGISTER.
  Only TEST template was saved as v3; operational templates and previous artifacts were not rewritten.
  Component ID: 503c49a3-0b19-4ca8-86e0-afd99b6515d3.
  Component SHA-256: eb8924780d9de3ec86f10e6ab28aad55952131d9a0f412ae06a43260c104ad38.
- Runtime report: 6f6e36de-c60e-4011-a71f-69ee3296c12b, title
  "TEST · Word Header · metadata only", filter FORM.9904, template v3, COMPLETED, three PDF pages.
  Artifact SHA-256: 32c4eaace72fdac21d4375e8f6e6bff9e179000461fe95cfc90bf01e48bf939f.
  Downloaded bytes match the stored checksum; PDF text contains the title, Nguyen The Hoang
  and FORM.9904, no unfilled report keys and no PDF form/signature fields.
- All three PDF pages rendered with Poppler and visually inspected: cover, actual count chart
  and data page; no header/data overlap observed. EmbedPDF opened the generated artifact.
  Evidence: target/report-word-runtime-page{1,2,3}.png and
  target/report-word-layout-ui-2026-10-04.png (local verification outputs, not committed assets).
- Existing GitNexus detect-changes compared against main reported CRITICAL for the entire dirty
  tree (55 tracked files, 172 symbols, 19 processes), including unrelated earlier work.
  No commit/push performed; unrelated changes preserved.
- Latest backend/frontend images deployed with docker compose up --no-deps; backend health
  was healthy and frontend running at handoff. Actual report generation above was verified
  before final security hardening deployment; hardened source was covered by the passing tests.

## Limits / remaining validation

- Each Word cover/header/footer component must be one page, at most 2 MB compressed;
  six report metadata keys are accepted in DOCX. Page numbering is configured separately.
- Word components apply to PDF, not CSV/XLSX. Configuration preview uses demonstration rows;
  generated reports calculate authorized actual records on the server.
- Desktop live preview and generated output were verified. A 375-pixel measurement previously
  showed no horizontal page overflow; full mobile interaction/visual regression remains unverified
  because the browser viewport override did not reliably target the configuration tab.
- Sustained concurrent conversion/load testing and formal release qualification remain outstanding.
  Passing tests are not a GMP-compliance assertion.
