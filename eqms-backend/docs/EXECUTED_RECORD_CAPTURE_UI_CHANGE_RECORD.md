# Executed Record capture UI — 2026-10-01

## Request and scope

User requested Date filled in Record Physical Copy to use the existing DateTimePicker
without time controls and Scanned file to match Publishing Template's upload UI.
No new regulated business rule is introduced.

## Invariants

- Actor, permission and object scope: existing server authorization and source
  Controlled Copy/form identifiers are unchanged.
- Lifecycle and parent/child effect: no transition or parent validity rule changed.
- Artefact: selected File bytes remain unchanged; no conversion or pre-sign upload.
  Existing server validation, storage, version/checksum handling are untouched.
- Audit/e-signature: submission still goes through ESignatureModal and the same
  reason/signatureToken API payload. No audit or signature logic is changed.
- Async generation: none added or modified.
- Date contract: date-only picker emits DD/MM/YYYY, converted in the modal to the
  existing YYYY-MM-DD request value. No timezone conversion or implicit time added.

## Source evidence and impact

SubmitExecutedRecordModal.tsx: DateTimePicker showTime=false; ISO date adapter;
file card, outline-emerald Upload, local file removal and file-input reset supporting
reselection of the same file. PDF/JPG/JPEG/PNG accept restriction is unchanged.
PublishingTemplateEditorView.tsx upload card was used as the UI reference.
executedRecords.ts recordPhysicalCopy/submitEform and ExecutedRecordService are
unchanged. PAPER_SCAN and EFORM API paths remain separate.

GitNexus upstream impact for SubmitExecutedRecordModal is LOW: 1 direct caller,
1 affected process (DetailDocumentView). No shared picker or upload logic modified.

## Verification and limits

Full FE suite: 180 tests / 28 files passed. TypeScript noEmit and scoped
git diff --check passed.
SubmitExecutedRecordModal.test.tsx: 3 tests passed. Covers date-only configuration
and ISO request value, original File/signature/source identifiers, no API call
before signing, upload button/removal/reselection, disabled submit without a file,
and separate eForm request without paper metadata.

Tests mock picker/modal/signature adapters and APIs. They do not validate actual
signature execution, server/storage transactions or browser calendar rendering.
No backend/API/DB migration, Docker rebuild, deployment or commit performed.
Repository system/governance and 08_ONE_CHANGE_RECORD_TEMPLATE documentation
referenced by AGENTS.md is absent in this checkout; source/test evidence is recorded
here without claiming GMP compliance or approving any new workflow rule.
