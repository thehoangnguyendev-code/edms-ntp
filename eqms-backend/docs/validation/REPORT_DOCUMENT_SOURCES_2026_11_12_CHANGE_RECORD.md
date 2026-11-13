# REPORT-DOCUMENT-SOURCES-2026-11-12 — Report phase R2: Document Control sources

Status: built and checked on DEV; **not committed**. Plan: `docs/plans/KE_HOACH_HOAN_THIEN_MODULE_REPORT_2026_11_11.md` (R2). Owner decision D2 (2026-11-11): Document Control and Training first. This is not a GMP approval.

## Change
- **Document Register** (`DOCUMENT_STATUS`): 10 new columns (sub type, current revision, author, owner, valid until, next periodic review, review cycle in months, training required, language, last updated) and 4 new filters (next review from/to, valid until from/to). The first 8 columns are unchanged, so existing templates keep their columns and output.
- **New Report Types** (category Documents), each a code-defined provider:
  - `DOCUMENT_REVISIONS` Document Revisions: status, days in the present status (since the last change of status; a save inside one status does not restart it), submitter, training, publishing and validity dates.
  - `CONTROLLED_COPIES` Controlled Copies: number, document, purpose, status, distribution, people, location, validity, expiry, recall, downloads, prints.
  - `UNCONTROLLED_COPIES` Uncontrolled Copies: number, document, status, reason, requester, approver, recipient, dates, downloads.
- `ReportQueryKit` (new): the scope-to-SQL rule, filter checks, date range checks and escaping, shared by the four providers (the Document Register now uses it too; behaviour is the same and its 11 existing tests pass).
- `ReportMetadataProvider.dateColumns()` (new, default = columns of date filters): the Report Types screen shows these as dates and a monthly trend may use them. Moments are written to the second (`to_char`), no fraction of a second.
- Screen: the text filter's placeholder is the filter's name (was "Search documents..." for every type).
- No database migration. No new permission: the data scopes of the template decide the rows, as for the Document Register.

## Invariants
- A scope is SYSTEM, BUSINESS_UNIT, DEPARTMENT or PERSONAL. A unit or department comes from the person, never from the request. No scope, an unknown scope, or a person with no department for a DEPARTMENT scope is refused (`REPORT_SCOPE_DENIED`).
- Copies take the department and business unit of the document. PERSONAL for a copy = requested, received or distributed by the person.
- Every value is an SQL parameter; a filter the type does not have, a non-text value, a search over 200 characters, a reversed or over-366-day range is refused.
- A report never drops a record silently: the revision report and the copy reports use left joins for department, unit, type and people.
- Never a column: access token, preview password, recipient signature, files, checksums, storage keys, descriptions and free-text reasons (rejection, cancel, recall, destroy). A test fails if one appears.
- Statuses and purposes are shown as their labels, never as machine codes.

## Evidence
- Unit tests: `ReportDocumentSourcesTest` 55 (scope, parameterisation, escaping, ranges, contract consistency, forbidden columns, date columns); all report tests 224 run, 0 fail, 27 skipped (opt-in database tests).
- Database test (opt-in, read-only): `ReportDocumentSourcesDatabaseTest` 3 pass on DEV: every column of every type is valid SQL; SYSTEM, PERSONAL and DEPARTMENT+BUSINESS_UNIT scopes and every filter run; every lookup answers; the revision report lists as many rows as `document_revisions` holds (8,135).
- DEV runtime (API, real templates RPT.0009 to RPT.0012 created by admin and approved by `approver.test1` with e-signatures): Document Register filtered 432 rows with all 18 columns; Revisions filtered 322 rows, Full CSV 8,135 rows, Full XLSX file produced; Controlled Copies filtered 387 rows, Full PDF produced; Uncontrolled Copies Full 4 rows. People appear as names, statuses as labels, "Days in Status" as a number.
- Frontend: tsc clean; report tests 71 pass.
- Screenshots: `evidence/dcv_2026_11_07/shots/R2__*.png`.

## PENDING_DECISION (not invented)
- **Do reports follow Document Control visibility?** A template with the SYSTEM scope lists every document, revision and copy, as the Document Register already did. The Document Control visibility work (participant / observer / operator tiers, Object Access Rules, department visibility mode) is a different rule. Today reports use only the scopes a template gives to a role. Owner and QA to say whether a report must also hide what a person cannot see in Document Control.
- Training Number and training completion are shown for a revision; the Training sources are phase R3.

## Not verified
- A report run by an account with a DEPARTMENT, BUSINESS_UNIT or PERSONAL scope on DEV (verified by unit tests and by the database test running the SQL; no such template was created on DEV).
- A chart on the new date columns; XLSX/PDF content opened in Excel or a viewer (file sizes checked only).
- GitNexus `detect_changes` (index stale).

## Test data
- Four DEV templates `RPT.0009` to `RPT.0012` ("EQMS - R2 test ...") and about ten runs "R2 ..." were created for this check. They are test data and are left in place.
- Names and numbers of DEV test documents contain identifiers (for example `ACTTEST.<uuid>`, `LEGACY-FULL.<uuid>`); a report shows them as they are. They are data, not a column; they go when the test data is deleted.
