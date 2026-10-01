# PDF preview annotation policy — change record

## Request and approved scope
- 2026-10-01: user requested a global annotation on/off checkbox, then explicitly approved implementation after the shared viewer's CRITICAL impact warning.
- GitNexus: DocumentPdfViewer 8 direct dependencies / 5 affected processes / CRITICAL; viewerConfig LOW (0 direct); PreviewFileTab LOW (1 direct); validateDocumentsConfig LOW (1 direct).
- The governance decision log, source-evidence conventions and standard one-change-record template referenced by the repository skills are absent. This focused record captures this change; it does not establish GMP compliance or approval for persistent record annotation.

## Invariants
- Existing administrator configuration authorization, Save transaction, signature/audit and after-commit global preview SSE remain unchanged.
- No lifecycle, parent/child state, object access, stored artefact/version/checksum or PDF generation change.
- Missing/false `documents.pdfPreview.allowAnnotations` denies annotation modification and hides annotation commands, Comments, Annotate/Shapes and Insert. Text selection/copy retains its separate policy.
- True permits session tools subject to PDF permissions; no force-allow override of embedded annotation restrictions. Insert still requires its own setting.
- EQMS does not persist preview annotations. Export/print, where permitted, can contain temporary session marks; this is not a validated electronic record/signature workflow.
- The restrictions govern this application viewer, not screenshots, developer tools or external PDF editors.

## Implementation and source evidence
- FE policy type and preview settings hook carry `allowAnnotations`; PreviewFileTab stages the checkbox through the existing Documents configuration Save.
- DocumentPdfViewer uses native `annotation` / `panel-comment` categories and `modifyAnnotations: false` for disabled policy, with content modification, assembly and form filling denied.
- SystemConfigurationService validates boolean policy values; existing whole-pdfPreview comparison triggers after-commit `documents-preview-config-updated`, and the existing hook fetches operational settings/remounts the viewer.
- V512 adds false for missing annotation policy in existing JSONB configuration, preserving all other values. New configurations without the field fail closed in the viewer.
- API remains the existing system configuration/operational configuration contract; no new endpoint or storage table.
- EmbedPDF 2.15.1 installed declarations and official docs reviewed: https://www.embedpdf.com/docs/snippet/security and https://www.embedpdf.com/docs/snippet/customizing-ui.

## Test evidence
- Viewer policy tests: 8 passed (including default/false denial, independent selection, enabled PDF-permission preservation, Insert gate and mounted-viewer policy change).
- Backend focused suite: 9 passed (PdfPreviewAnnotationPolicyTest 3; SystemConfigurationServiceBrandingTest 6). Includes invalid nonboolean rejection and both-direction preview invalidation.
- Full FE suite: 147 tests / 21 files passed, including the editor's staged-change/default-off test.
- `git diff --check` passed. GitNexus detect-changes reports CRITICAL for the entire dirty workspace (19 files, 35 symbols, 22 processes), including unrelated e-signature and concurrent Executed Records changes; no commit is being made.
- TypeScript initially blocked by unrelated concurrent Executed Records edits: DetailDocumentView missing ExecutedRecordsTab; ExecutedRecordsView EXECUTED_RECORD not in ChangedEntityType.
- Final TypeScript rerun: only ExecutedRecordsView.tsx:56 remains blocked by `EXECUTED_RECORD` not in ChangedEntityType; the concurrent missing-tab import was resolved elsewhere. No annotation-policy TypeScript errors reported.

## Remaining verification / release
- No Docker rebuild/restart, DB migration execution, live multi-user SSE/browser interaction or actual EmbedPDF rendering test performed in this change.
- Before release, apply V512 and confirm in a real browser: selection toolbar offers no markup when off; Comments hidden; annotation shortcuts unavailable; existing PDF content remains visible; enabled annotations/Insert obey respective controls; Save updates another user's open viewer.
- No commit or push requested/performed.
