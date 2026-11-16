# Table Excel exports — 2026-11-14

## Approved request and scope

Owner requested server-side XLSX for table Export buttons: all rows matching the table's current search/filter/sort and the current user's visibility, not just the displayed page. Include column headings, Excel sorting/filtering, timestamped filenames and mandatory audit evidence.

Registers: Documents (all/owned), Revisions (all/owned/pending), Controlled Copy batches (all/ready/distributed), Users, Notifications, Access Profiles, Permission Sets, bulk Audit Trail. Official Word/PDF training forms and single-record audit artifacts are distinct workflows, not table exports.

The referenced evidence conventions and one-change template are absent in this checkout. This record supplies request, invariants, implementation and verification evidence explicitly.

## Invariants

- Authenticated actor is resolved on the server. Existing list/export services enforce object visibility and permissions; no client record array or arbitrary SQL/column expression is accepted.
- All pages share a repeatable-read transaction. Client pagination is ignored; current search/filter/sort is retained. Only approved list metadata is exported; credentials/capability internals are excluded.
- Document/revision/copy state, parent-child relations and source files remain unchanged.
- Bulk audit export retains its existing required reason, permission and single-use electronic signature. Other table exports do not invent a signature requirement.
- Administrative Access Profile/Permission Set exports retain the administrative network gate; normal operational table exports remain operational.
- The XLSX is fully generated and hashed before mandatory audit commits. Failure during generation/audit returns no file. Audit means file generated/released for transfer, not proof of browser receipt.
- Filename: server time in Asia/Ho_Chi_Minh, `<register>_ddMMyyyy_HHmm.xlsx`; separators in display dates are deliberately omitted from filesystem names.
- XLSX uses streaming POI, numbered rows, column headings, frozen header, AutoFilter, and string cells for user text (no formula evaluation). Oversized cells/worksheet fail explicitly rather than truncate silently.
- Temporary files are removed after errors or completed/aborted streaming. No durable export database or new schema is required; existing audit storage is used.

## Source map

- `controller/TableExcelExportController.java`: finite dataset registry; adapters to existing authorized queries; former CSV endpoints redirect to the same XLSX implementation.
- `service/export/TableExcelExportService.java`: transactional generation, checksum, audit and response.
- `service/export/TableExcelWriter.java`: bounded-memory, typed XLSX generation; dates/numbers sort natively and text remains literal.
- `security/AdministrativeOperationCatalog.java`: new administrative export handler reviewed explicitly.
- `eqms/src/services/api/tableExport.ts`: file transport only; server owns filename/content.
- Table handlers/hooks: no local record filtering, serialization or page-limited export remains in the listed buttons.

## Impact

GitNexus: existing writer methods LOW (one direct controller caller each), document/revision hooks LOW (1/3 callers); user list export hook LOW (one parent workflow, UserManagementView); table views/handlers LOW. Administrative METHODS catalogue property LOW. No HIGH/CRITICAL edit identified. New additive symbols are not present in the existing index; source and tests supplement it.

## Verification

Test-confirmed: 112 BE tests passed across thirteen classes (18 new focused workbook/export/redirect/query tests, plus existing authorization/catalogue regression coverage). Workbook tests include 1,001 rows, Unicode, quotes/newlines, formula-like literal text, leading zeroes, real dates/numbers, empty results and explicit overflow rejection. Export tests cover more than 500 notification records across pages with full query forwarding, denial/rollback, mandatory audit failure, checksum/filename/criteria redaction, concurrency bounds, admin network classification, mandatory bulk audit signature and legacy URL aliases. New concurrency test included in the final 112-test run.

FE: 4 tests passed (transport tests and existing document-hook request regression). TypeScript currently reports two pre-existing missing ReportLayoutDesigner imports in ReportAppearanceView/ReportLists.test, outside this change. No export-scope TypeScript errors remain.

A shared target/classes class file was malformed (SystemConfigurationService, ClassFormatError). Tests were recompiled from source into target/table-export-validation/build using an isolated temporary POM; no user build files were deleted. Focused tests run without writing business fixtures to the DEV database.

GitNexus detect_changes on the whole workspace reports CRITICAL over 90 files / 239 symbols / 64 processes, including pre-existing unrelated edits. This is not an export-only diff; only the individually impact-reviewed export symbols, the network catalogue property and new additive symbols were changed for this request. No commit or push is performed.

Docker backend image build completed and was recreated successfully; final runtime evidence is below.


## API contract

`GET /api/table-exports/{dataset}` accepts only the listed dataset keys. Search, status, source-specific filters and sort use the existing register query names; page/limit/size do not restrict exported rows. Success: XLSX MIME, Content-Disposition with server-generated filename, Content-Length, Cache-Control: no-store. The existing CORS exposure of Content-Disposition is reused. Two workbook generations at a time are admitted; further requests receive 429 rather than building unlimited concurrent DB snapshots. FE waits for the completed download without the normal 30-second JSON request timeout.

Former `/documents/export`, `/revisions/export`, `/controlled-copies/export`, `/settings/users/export`, `/audit-trail/export` endpoints are 307 aliases with the exact encoded query preserved. Redirect Location is relative to the public origin and context path, never an internal Docker hostname. Specialized training form downloads and individual audit-record downloads keep their existing business formats.

Runtime-confirmed: backend health HTTP 200; unauthenticated table export HTTP 403. Owner unlocked the existing Chrome session; no password or token was read or stored by the agent. Positive UI/file/audit evidence is below.


## Additional parity correction — Users Last Updated

Source-confirmed: the FE had Last Updated date filters/sort, but the Users API did not accept the date parameters and its sort resolver fell back to Employee ID. The existing 18-argument service entry point is retained as a compatibility wrapper; both the paged controller and XLSX use a 20-argument overload with the same existing scope predicate plus updated_at bounds. Invalid/reversed ranges are rejected. Sorting maps lastUpdated to updatedAt with id as a stable tiebreaker. Excel's Last Updated values are loaded in one batch, only for IDs returned by that authorized page; no extra user IDs or credential columns are exported. The large UserManagementResponse contract is not changed.

Two query tests verify the actual JPA Specification's site-zone inclusive-from/exclusive-next-day bounds and updatedAt/id ordering, plus refusal of invalid ranges. Existing user guard tests remain green. DateFormatGuardTest also passes: display/zone rules are retained, with the owner-requested filename format allowed only in TableExcelExportService.


## Performance follow-up approved by owner — 2026-11-14

Owner requested optimizing export after functional completion. Runtime thread dumps confirmed repeated Hibernate dirty checks/auto-flush while the original Document export built full screen DTOs for each record. That mapper also queried action capabilities, current effective revisions and detailed relation lists that are not exported. No DB lock blocker was present. An early unoptimized all-register request generated 11,001 rows after several minutes; its old frontend request had timed out at 30 seconds, illustrating that generation audit does not imply receipt.

Individually repeated GitNexus impacts for writeDocumentsExport/writeRevisionsExport remained LOW, one direct caller each, no indexed processes. New TableExcelExportService/ReadScope are additive and not yet indexed; source confirms one controller coordinator. No shared mapper or authorization rule was edited for optimization.

Invariants retained: unchanged authorized Specifications, filters and sort with ID tiebreak; repeatable-read snapshot; no lifecycle/source artefact mutation; mandatory generated-file audit/checksum before transfer; bulk audit signature/consumption stays on the original write path. No asynchronous business job is introduced.

Implemented:
- Dedicated export row mapping for Document/Revision, avoiding full UI capability/relation/training mappers.
- LEFT fetch of required to-one labels only, excluded from count queries; document workflow participants and Effective revision numbers loaded per 500-record page. Same source fields and latest Effective version semantics as before.
- Read extraction uses scoped Hibernate MANUAL flush/default read-only, restoring the prior mode before the export audit. Completed Document/Revision pages clear the persistence context, bounding entity accumulation. No such read scope surrounds bulk Audit Trail export, whose single-use signature behavior must remain writable.
- XLSX retains streaming row window 100 and shared styles, with compressed temporary files, two concurrent generations maximum and no unbounded request queue. FE handles file transport only and does not impose the ordinary 30-second JSON timeout.

Final test-confirmed result: **115 BE tests, 0 failures, 0 errors, 0 skipped (14 classes)**. Includes added scope restoration on success/failure, clearing page context, audit write-mode restoration before audit and an explicit assertion that bulk audit never enters the read-only scope. Prior FE result remains 4/4 passed; no further FE source changes in this performance follow-up.

## Positive DEV runtime/file evidence

- Backend and feature frontend running healthy on localhost. Backend image rebuilt from final source; no new migration required.
- Existing stable frontend image was overlaid with only the new helper plus eight export callers (9 source files), rather than deploying unrelated missing ReportLayoutDesigner source. Original base image sha256:a354084f621b483c792389f67d456e0298fb9e53d693fc37dd792d15b2fa4fd5. Overlay build context is ignored target/table-export-frontend. A future full-source FE build still needs the two unrelated Report missing imports corrected; this task does not claim a full FE typecheck pass.
- Filtered UI export search SOP.10411: 1 visible matching record; audit filename All_Document_14112026_1218.xlsx, records=1, correct search/scope/sort criteria.
- Final unfiltered UI export: 11,001 matching records across all pages, about **6,913 ms** from click to observed success toast on this PC/DEV workload. This is one observation, not a performance guarantee under concurrent load.
- Downloaded bytes read from the browser's new file in Downloads (UUID .tmp staging name); valid XLSX copied for local verification to target/All_Document_14112026_1220.xlsx. Server Content-Disposition/audit filename remains All_Document_14112026_1220.xlsx.
- Workbook: 1,302,253 bytes, 11,001 data rows, 22 headings including numeric No.; AutoFilter A1:V11002; frozen header at A2; no formula cells. File SHA-256 **3753c5843fdbbff6eaaa2977601a13704ae14d780188121d15dc1e7d3da3b7a8** exactly matches TABLE_EXPORT/EXPORT audit (created 2026-11-14 05:20:34.2921 UTC). Criteria scope=all, sortBy=created, sortDirection=desc.
- Screenshot: target/table-export-runtime.png. Browser reported Export complete. Attempt to open chrome://downloads for filename inspection was blocked by browser URL policy; no workaround was attempted. Verification used the actual downloaded local file instead.
- No successful Export errors found in backend logs after final deployment. No persistent data was changed except legitimate export audit records. Existing user business data/files retained; no Git commit/push performed.

Remaining limits: worksheet limit 1,048,575 data rows and Excel's per-cell text limit are rejected explicitly. Very large exports still occupy a synchronous generation slot and a DB snapshot until generation/audit complete; no durable queued export workflow is claimed. Positive DEV browser/file verification covers Documents; the other datasets have focused query/denial/pagination regression tests, not a claim of positive browser UAT for every role/dataset.
