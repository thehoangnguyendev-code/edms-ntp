# Report presentation and TEST templates — 2026-10-03

Decision: REPORT-LAYOUT-2026-10-03 in governance/DECISION_LOG.md.

Invariants: active authenticated actor and fresh existing report configuration permissions;
explicit Administrator-only SYSTEM metadata grants for TEST templates; no source document
content access change. Layout saves share the existing reason/version/audit transaction.
Future requests pin layout in their definition snapshot; edits never rewrite completed files.
Worker identity/time are server-derived. Existing publication lease/checksum journal,
reauthorization and retention remain authoritative. Stamps are decorative, not signatures.

Scope: bounded text cover/header/footer/stamp/watermark, server PDF draft preview,
PDF full presentation, XLSX information sheet/print headers, CSV data only. No arbitrary
HTML, SQL, external URL or image upload. A4 landscape remains the supported paper size.
Three TEST templates use live document metadata and migration provenance, not invented
business documents or user-impersonated run records. Admin still explicitly requests runs.

Source: ReportLayout, ReportPresentationRenderer, ReportLayoutController,
ReportTemplateService, ReportPlatformService, ReportLayoutDesigner; V532/V533.

Test-confirmed: 41 backend tests passed (16 real PostgreSQL template/worker tests,
11 provider, 3 layout, 2 layout API, 2 template API, 2 Unicode PDF, 1 permission
boundary and 4 schedule ownership tests); 6 frontend tests passed. TypeScript and
Vite production build passed. Negative evidence covers unknown tokens, length/control
characters, permission-denied preview, atomic failed saves, immutable layout snapshots,
Admin-only repeatable seed, formula-safe XLSX, current-scope download and checksums.
PDF cover/data pages were rendered and visually inspected; Unicode and headers on
every page are asserted. MinIO external-object round trip is mocked in automated worker
tests and additionally verified with the authenticated runtime generation/download below.

Runtime-confirmed: Docker backend healthy, V532/V533 applied successfully, all three
TEST templates present with one active ADMINISTRATOR SYSTEM grant each. No isolated
test schemas remain. Authenticated Administrator browser checks covered the layout
designer, server PDF preview, desktop and 375 px mobile viewport (no horizontal page
overflow). A real TEST_DOCUMENT_REGISTER request filtered FORM.9904 on the server,
returned one live record, and completed PDF generation. No fake requester identity/run
was seeded. Runtime evidence:

- Run: b7464dc3-4d21-4abe-a363-4c6313fa819c; artifact: c025e49d-f37f-44ee-83d8-3acb84018e58.
- MinIO object version: 4c90506e-6821-4ce0-9632-3619c04ddcd6; PDF size: 18,746 bytes.
- Pinned presentation contains server-derived executor Nguyen The Hoang and enabled cover.
- QUEUED and COMPLETED events recorded; authorized browser download succeeded.
- Downloaded file SHA-256 matches the persisted artifact SHA-256 (database comparison true).
- Download: C:/Users/theho/Downloads/report-b7464dc3-4d21-4abe-a363-4c6313fa819c.pdf.
- Both downloaded PDF pages rendered and visually inspected: cover identity/time,
  one-record table, TEST watermark/stamp and page numbering; no data/stamp overlap.

Owner acceptance testing and broader regulated validation remain outstanding.
GitNexus compare-main
reports CRITICAL across preexisting eForm retirement/Document Control changes, not
isolated to this layout work; no commit/push performed. New report symbols are not
yet indexed (UNKNOWN impacts); indexed worker has one direct caller and LOW impact.

Source-backed As-Is assurance
files and the change-record template referenced by AGENTS are absent in this checkout.
This record is implementation evidence, not a claim of EU-GMP validation/compliance.
