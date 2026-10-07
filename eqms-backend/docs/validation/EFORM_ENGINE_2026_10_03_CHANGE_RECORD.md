# EFORM-ENGINE-2026-10-03 — reviewed Draft design conversion

Status: implementation and focused verification; NOT production-released or fully validated.
Approved decision: [EFORM-ENGINE-2026-10-03](../governance/DECISION_LOG.md).
The referenced one-change-record template and docs/system evidence baseline are absent
in this checkout. This record is source/test evidence, not a GMP compliance assertion.

## Invariants and scope

- Authenticated session owner with DESIGN permission AND current Draft file-edit/object
  permission can scan/apply. Server checks these again after locking the session/revision.
- New DESIGN sessions pin the selected Draft UUID. No guessed backfill of old sessions.
  Legacy unpinned DESIGN sessions retain existing editing behavior but must reopen for engine use.
- Original DOCX, committed/Effective templates, FILL runs and signing protocols are not
  converted or migrated by this engine. Generated fields are an uncommitted DESIGN artifact.
- Author explicitly selects proposals and field definitions. Keys are unique generic fieldN
  or esignN, independent of positions/user IDs/order; signatures are explicit text tokens,
  NOT OnlyOffice signature widgets. DCO/PDF execution integration remains incomplete.
- Applying requires the exact scan saveVersion/checksum and verified stored bytes. A new
  session/file replaces the old session atomically; old callbacks/commits are rejected.
- DESIGN callback, engine replacement and signed commit take the same session row lock.
  The engine also locks/refreshes the Draft. Existing signed commit remains mandatory for
  saving the fillable template. Audit is mandatory in the apply transaction.
- Durable external-write journal precedes storage. DB rollback does not delete retained
  objects; unresolved writes remain discoverable. No automatic cleanup or policy change.
- Force-save uses the MOUNTED editor generation, not the changing callback saveVersion.
  Frontend waits for a newer saved callback or explicit no-change response before scanning.

## Implementation

Server: EformDesignFieldEngine, EformDesignEngineService, EformDesignEngineController,
EformDesignSessionLockService, EformDesignEngineJournal; EformEditSessionService guards.
API: GET /eform-sessions/{id}/design-engine, GET .../state, POST .../flush, POST .../design-engine.
Polling reads authorized state metadata only; decompressing/scanning the artifact happens once after acknowledgement.
DB: V527 revision pin/FK/index; V528 external-write journal/index.
FE: EformDesignFieldsModal, EformSessionFrame, eformDesignEngine API helper.

Scanner only proposes simple square glyphs, native checkboxes without form metadata,
and simple empty table cells. Unsupported/ambiguous layouts remain manual. Checks include
archive/XML bounds, external-entity rejection, invalid/duplicate selections/options,
key collisions and checked-checkbox preservation. Other ZIP parts remain byte-identical.
Author may choose Text/Checkbox/Dropdown/ComboBox/Signature for a blank cell and set label,
required flag and choices. Glyph/native checkbox proposals only permit Checkbox conversion.

## Impact assessment

requireWorkingSession HIGH: 5 direct/10 total dependants, sourceFile flow; owner explicitly
approved this change. EformSessionFrame LOW: 2 direct/4 total, ControlledCopyDetailView flow.
EformEditSession MEDIUM: 7 direct. applyCallback and commitDesign LOW, one direct each.
Test fixture setUp LOW, no callers. New engine symbols not present in the existing index:
impact calls return NOT FOUND; their local callers are the new controller/service/frame.
No shared signature authentication, FILL submit or sign implementation modified by this increment.

GitNexus compare/main on 2026-10-03 reports aggregate CRITICAL: 46 tracked files,
157 symbols, 27 flows. This includes extensive pre-existing owner edits and does NOT
cover new untracked files. No commit/push or broad staging was performed.

## Verification evidence (2026-10-03)

- Backend focused command: mvnw -q -Dtest=EformDesignEngineServiceTest,EformDesignFieldEngineTest,
  EformEditSessionServiceTest,EformExecutionProtocolTest,EformDocxfWriteLockServiceTest,
  EformSignaturePlaceholderServiceTest,OnlyOfficeDocumentEditServiceTest test.
  66 tests passed; zero failures/errors/skips. XML rejection tests intentionally print parser errors.
- Scope tests cover ownership, permission revocation, wrong Draft, unpinned session,
  checksum mismatch, ended-session callback/commit, refresh-after-lock, storage failure
  before session replacement, audit/write ordering and replacement revision/checksum.
  These are unit/mock tests, NOT proof of a live concurrent DB/storage rollback scenario.
- TypeScript noEmit and production Vite build passed (existing large-chunk warning).
- Frontend focused Vitest: 18 passed across five suites (modal, frame integration,
  engine API polling, existing OnlyOfficeEditorPage and FormSettingsCard). Explicit
  selections, stale apply, replacement mounting and exact API payloads verified.
- OnlyOffice 8.2 Document Builder runtime: generated.docxf opened/re-saved as DOCXF.
  GetAllForms reported five native fields: two original + three generated Text/Dropdown/
  ComboBox. The signature marker is deliberately excluded from native fillable fields.
  Runtime type output confirms textForm/dropDownForm/comboBoxForm for new keys.
  A supplementary probe using the current-docs GetPlaceholderText API failed because that
  method is absent in installed 8.2; it is NOT used by application code. The corrected
  probe uses installed GetFormType/GetText and succeeds. No OnlyOffice upgrade performed.
  Probes/artifacts: target/form-engine-probes (not source-controlled).
- V527/V528 executed against temporary PostgreSQL 17 schema with matching UUID table
  stubs, FK-backed pin inserted and 13 journal columns verified, then transaction rolled back.
  No live application schema migration/deployment was performed.
- UI harness uses the real component/shared library at 375/768/1440/1920. No horizontal
  overflow or console errors in styled run. Initial unstyled harness was invalid and discarded.
  Skill ui-ux probe records/screenshots: target/form-engine-probes/ui-final.
  Shared-component differences retained deliberately: faint hover (P1 Next, P2 Cancel,
  P3 numbered page), 28px mobile close/pager targets, existing focus rings/scrollbars/borders.
  Pager text-only warning is a false positive: TablePagination includes page numbers/icons.
  No global FormModal/Button/TablePagination redesign is included.
  Visual review at small/wide sizes: consistent detected rows, no clipped action footer,
  five proposals per page to keep settings reachable, key catalogue collapsed by default;
  empty settings column is intentional until the Author selects a location.

## Operational recovery and release gaps

Query eform_design_engine_writes for PENDING/WRITTEN. Use replacement_session_id to
locate objects under forms/eform-sessions/{UUID}/ (local-storage root likewise), then inspect
recorded object/version/checksum and session/audit state. Do not delete retained objects
or promote a journal row automatically. Interrupted storage before written() may leave
PENDING with only that deterministic session prefix; manual reconciliation is required.
Production release must include a reconciler/runbook exercise, real permissioned browser
workflow, live PostgreSQL concurrency/rollback test, full Flyway sequence and signed commit
to publishing regression. Current migrations are source changes, not applied to the running DB.
Full PDF sequential signing and DCO generic-token mapping remain tracked separately in
[EFORM-PDF change record](EFORM_PDF_2026_10_03_CHANGE_RECORD.md); do not enable PDF_V1 yet.
