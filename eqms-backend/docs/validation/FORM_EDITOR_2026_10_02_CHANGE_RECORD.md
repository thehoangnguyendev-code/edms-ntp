# FORM-EDITOR-2026-10-02 change record

Status: source implementation complete; focused automated checks passed. Docker
deployment and live OnlyOffice end-to-end verification remain pending. Approved owner decision is recorded in
../governance/DECISION_LOG.md. The referenced 08_ONE_CHANGE_RECORD_TEMPLATE.md and
docs/system evidence conventions are absent in this checkout; this record captures
the applicable invariants, source and test evidence explicitly.

## Invariants

- Actor/object: existing authenticated document/revision editing and design
  permission checks remain server-side. UI selection is not authorization.
- Lifecycle: DOCXF opens only the selected current Draft. No published, locked or
  unrelated revision may be substituted when a stale editor URL is opened.
- Artefacts: source DOCX and fillable DOCXF remain separate. Existing checksum-based
  stale-template warning and signed template commit are unchanged. No storage
  object or historical record is deleted; no DB migration is needed.
- Parent/child: publication, copy issuance/recall and electronic execution are unchanged.
- Audit/signature/async: existing editor APIs, callbacks, audit and design signature
  remain in place. This change does not replace asynchronous save acknowledgements.
- Preference: last selected editor is a browser-local preference scoped by user
  and revision. It cannot grant permissions or modify either file.

## Evidence

Verified on 2026-10-02:

- `npx tsc --noEmit` (eqms): passed.
- `npx vitest run src/features/documents/shared/__tests__/OnlyOfficeEditorPage.test.tsx`:
  8 passed. Covers legacy URLs, DOCXF selected revision, switching in both directions,
  Cancel, per-user preference isolation, metadata failure, non-Form and invalid format.
- `mvnw.cmd -q -Dtest=EformEditSessionServiceTest test` (eqms-backend):
  19 passed, zero failures/errors/skips; see target/surefire-reports/
  com.eqms.EformEditSessionServiceTest.txt. Includes rejection of a stale selected
  revision before conversion/storage/session creation and reuse of DOCXF without
  changing source DOCX metadata.
- `git diff --check`: passed (line-ending warnings only).
- GitNexus per-symbol impact for the changed editor/API entry points: LOW.
  Whole-worktree detect_changes reports CRITICAL (43 files, 131 symbols, 27 flows)
  because it includes prior unrelated pending work. No commit or bulk deployment made.
- ui-ux probe attempted at 375/1440 px; unavailable because Playwright is not
  installed. No visual/runtime success is claimed. The existing shared Button and
  FormModal were reused without a new design system.

Remaining manual acceptance: open both real OnlyOffice editors, exercise switching
confirmation, edit/save DOCX, verify stale-template confirmation, then design and
electronically commit DOCXF; verify source and template remain separate. These
checks require deploying the matching frontend/backend changes first. Existing
DESIGN permission prerequisites remain unchanged.

## Follow-up: DOCXF blocked by missing Form Settings

Source-confirmed cause: startDesignSession required a persisted Form Settings
record before loading the Draft, though its configuration values were not used
by DESIGN. Removed only that existence check. No settings are automatically
created and FILL continues to require explicit allowEform configuration.
Actor/edit authorization, current Draft selection, stale checksum confirmation,
artefact separation, callbacks, e-signature and audit are unchanged.

Test-confirmed: focused service suite now passes 21 tests (zero failures/errors/
skips), including DESIGN without settings and negative no-Draft/no-design-
permission cases; existing edit-permission and stale-revision tests still pass.
Docker backend image rebuilt successfully; backend recreated with --no-deps.
Database inspected read-only before deployment: migration 525 already applied;
this follow-up has no DB migration or settings data modification.
Full browser editing and signed-save acceptance still requires manual execution.

Sub-Type investigation: DB read-only query confirmed the screenshot's Baseline
Consistent records belong to FORM (20 FORM subtype records). Existing creation
filter and server save validation already constrain Sub-Type to Document Type;
no data was removed or reassigned.
