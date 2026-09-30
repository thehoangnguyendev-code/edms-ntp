# EmbedPDF local PDF viewer -- change record

Status: implemented; runtime QA pending.

## 2026-09-30 frontend type and regression-test repair

- Scope: `DocumentPdfViewer.tsx`, `useDocumentPreviewSettings.ts`, and frontend tests.
  No backend, database, permission, lifecycle, audit/e-signature, stored artifact/checksum,
  parent-child rule, or asynchronous generation changes.
- Source-confirmed: the installed EmbedPDF `ZoomLevel` accepts `ZoomMode | number`.
  Initial fit-page/fit-width now use `ZoomMode.FitPage`/`ZoomMode.FitWidth` rather than
  string literals; actual size remains `1`. Runtime values are unchanged.
- The preview settings interface now declares the four already-persisted Document-menu
  booleans (Open, Close, Security, Screenshot); defaults and enforcement are unchanged.
- Lifecycle tests isolate the unrelated Uncontrolled Copy eligibility card, consistent
  with their existing subtree mocks. Knowledge Explorer tests assert the current heading
  instead of the retired greeting; production lifecycle and Knowledge code are unchanged.
- Test-confirmed: added viewer policy mapping coverage for all three initial zoom values,
  disabled/enabled menu actions on rerender, and export/print denial despite caller flags.
- Verification: frontend Vitest 14 files / 96 tests passed; `tsc --noEmit --pretty false`
  passed; Vite production build passed. These are automated frontend checks, not browser
  rendering QA or a claim of GMP compliance. No Docker rebuild/deployment was performed.
- GitNexus upstream impact for the shared viewer: 8 direct dependants, 5 affected process
  entries, CRITICAL. User explicitly approved the narrow repair after the warning.
  Whole-worktree detect-changes includes pre-existing unrelated edits and table migration;
  it is not a scoped release assessment for this repair. No commit was made.
- The referenced governance/system/change-record-template directories are absent in this
  checkout. This existing change record is used for evidence; no new business rule is defined.

## Scope and source-confirmed as-is

The React frontend previously used `@react-pdf-viewer` with a PDF.js worker loaded from
`unpkg.com`. Its shared `DocumentPdfViewer` is used by document, revision, controlled-copy,
knowledge, publishing-workspace, and publishing-template preview surfaces.

## Implemented invariant

- EmbedPDF runs as a read-only browser renderer. It receives only the existing `blob:` URL
  returned after the applicable backend authorization check; no endpoint, actor, or object scope
  changes.
- The PDFium WASM and worker are built into the frontend artifact and served from the EQMS origin.
  No public CDN or CloudPDF service is used.
- Existing server-generated watermark policy, preview audit trail, lifecycle, e-signature,
  source/published artefact, checksum, MinIO object, and asynchronous generation are unchanged.
- Both Document Details and Revision preview endpoints render the same configured watermark text,
  optional authenticated viewer name, and optional opened timestamp into their transient PDF
  response. Neither endpoint modifies the stored artefact.
- EmbedPDF editing, annotation, redaction, signatures, stamps, forms, capture, attachments,
  history, pan and rotation are unavailable. Download/print, copy/select, search, page
  navigation, zoom, full screen and sidebar behaviour consume the saved PDF-preview policy. The
  viewer is intentionally light-only for consistent document and watermark presentation.
- EmbedPDF's Insert tab is disabled by default. An administrator can enable it as an explicitly
  session-only tool; it never writes an annotation, signature, stamp, image, or modified PDF back
  to EQMS storage.
- The Document-menu actions Open, Close, Security information, and Screenshot are independently
  configurable global viewer controls. Their defaults retain the previously visible actions.
  Hiding an action is a client-side presentation policy only: it does not grant or revoke backend
  document access, change a stored artifact, bypass a lifecycle rule, or alter preview auditing.
- Server validation accepts only the supported PDF preview booleans and the zoom values
  `page-fit`, `page-width`, or `actual-size`; a successful committed change emits the existing
  global `documents-preview-config-updated` event so connected clients re-read the saved policy.
- Migrations `V492` through `V495` persist the policy defaults in `documents_config.pdfPreview` and
  retire the previous PDF.js-only pan, rotate and theme-switch keys without overwriting any
  supported administrator value. No new database table or column is introduced.
- Migration `V494` adds the persisted, default-off `showInsertTools` policy.

## Evidence

- `npm run build` emitted `dist/assets/pdfium-*.wasm`; therefore the engine is served with the
  frontend artifact rather than from a third-party URL.
- `SystemConfigurationServiceBrandingTest` passed (6 tests), including the committed global
  preview-policy invalidation event.
- `mvnw.cmd clean -Dtest=SystemConfigurationServiceBrandingTest test` passed after adding the
  four Document-menu policy fields; `npm run build` passed with the matching viewer categories.
- `docker compose build frontend backend` succeeded; both recreated services are running and
  `GET /api/health` through the frontend proxy reports `UP`.

## Residual risk / required runtime QA

The EmbedPDF viewer package is a client-side rendering dependency; it is not validation evidence
for access control. QA must exercise each existing preview surface with an authorized and an
unauthorized account, verify no external network request is made, verify watermark/audit behaviour,
and confirm the Administrator policy hides/allows each exposed control as configured.
