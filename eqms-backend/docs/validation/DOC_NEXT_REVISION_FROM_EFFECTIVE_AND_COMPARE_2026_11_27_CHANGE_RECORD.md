# Change record: next revision from the Effective file, and Compare with Effective

Date 2026-11-27. Decisions: `DEC-DOC-2026-11-27-01`, `-02`, `-03`. Plan: `docs/plans/KE_HOACH_SOAN_TIEP_TU_BAN_EFFECTIVE_VA_COMPARE_2026_11_27.md`.
Built, tried on an isolated copy of DEV, present in the running DEV containers. Not committed. Not a GMP approval.

## What changed

- A new revision may start from the Effective revision's Word file: byte-for-byte copy into its own storage object, validated and scanned, checksum compared; audit action `REVISION_SOURCE_COPIED_FROM_EFFECTIVE`. Offered in Upload Revision and, for an existing Draft, as "Use Effective File".
- "Compare with Effective" on the Document tab in Draft, Pending Review, Pending Approval: made by the Document Server builder service into a temporary cache keyed by both files' content; read only, no download or print, watermark as the viewer; audit action `VIEW_COMPARISON`; same access as viewing the revision.
- A warning with the number of tracked-change marks and unresolved comments on the Draft, Review and Approval screens. Nothing is blocked.
- New endpoints: `GET /documents/{id}/effective-source`, `POST /revisions/{id}/source-from-effective`, `GET /revisions/{id}/comparison-info`, `GET /revisions/{id}/onlyoffice/compare-config`, `GET /onlyoffice/stored-file/revision-compare/{id}` (token). Field `useEffectiveSource` on `POST /documents/{id}/revisions/upload`.
- No migration, no new permission, no change to publishing.

## Difference from the plan

The warning is on the screen, above the tab content, not inside the signature dialog: `ESignatureModal` is CRITICAL in impact analysis (101 dependants).

## Impact analysis (before editing)

LOW: `createRevisionAndUploadFile`, `uploadRevisionFile`, `buildStoredFileViewConfig`, `UploadRevisionModal`. MEDIUM: revision `DocumentTab` (7). HIGH: class `OnlyOfficeDocumentEditService` (18): only new methods were added. `ESignatureModal` CRITICAL: not edited.
`detect_changes` was not run: nothing was committed and the working tree also holds another session's work.

## Verification

- Isolated stack: 36/36 API checks (permissions, refusals, copy integrity, Effective file and record unchanged, comparison content, token scope, PDF-only legacy case) and the concurrent creation check. Browser: creation from the dialog, compare as Author, warning and compare button as Reviewer. Evidence in `evidence/doc_compare_2026_11_27/`.
- Tests: frontend `src/features/documents` 225 passed, TypeScript clean; backend 89 selected tests passed, including 4 new for the markup counter. A first full frontend run had 15 failing files and a second 6; after the test mock was completed, the documents, layout, notifications and dashboard-role subsets re-run passed (415). The full frontend and backend suites were not completed green after the change.

## Not verified

- The comparison on the DEV containers themselves (needs a DEV sign-in); DEV differs only in the host name the Document Server fetches from.
- A real SOP with images, diagrams, merged cells, sections or large size.
- Counting of comments made in OnlyOffice (unit test only); how the published PDF shows comments.
- The Approval screen in a browser; the Vietnamese texts on screen; a full publish after starting from the Effective file.
- Whether the Document Server licence terms cover the builder service (it answered without a licence error).

## Observed, for a decision

- A PDF converted from a file with tracked changes shows the markup.
- The existing read-only viewer of the Document tab showed the text BEFORE the tracked changes for such a file (seen on the test file, not changed here).
- Existing behaviour, not changed: a refused file action (`FileAccessDeniedException`) and a lost creation race (unique revision number) answer HTTP 500.

## Addition: final text without markup (DEC-DOC-2026-11-27-04)

- `DocxMarkupCleaner`: accepts every tracked change (body, headers, footers, notes, styles, numbering; text, paragraph marks, table rows and cells, formatting records), removes comments and their text, switches off "track changes". Unreadable file: error, never passed through.
- Applied to: the copy from the Effective revision (byte for byte when there is nothing to remove; the audit entry says which), every DOCX turned into PDF by the publishing composer (preview, publish, controlled copies, template component files), the legacy-import conversion, both sides of the comparison. The warning text now says the PDF accepts the changes.
- Document tab viewer: markup in Draft, Pending Review, Pending Approval; final text in later stages (it showed the pre-change text before).
- Impact before editing: `composePreview`, `convertToPdf`, `buildEditorConfig`, `requireSourcePath` all LOW.
- Verification: 8 new unit tests (85 selected backend tests: 0 failures, 11 database tests skipped); a file marked by OnlyOffice itself (12 change marks, 1 comment) came out with 0 and 0; isolated stack 15/15 (clean copy, Effective file untouched, publishing preview with the real SOP cover/header/footer template without deleted text, comment text or annotation); reviewer screen shows the markup; frontend documents tests 225 passed. DEV backend and frontend rebuilt afterwards; not signed in there.
- Not verified: the final Publish signature step and a controlled copy end to end (same composer as the preview); markup inside text boxes, charts or equations of a real SOP; viewer of comments in stages after approval (the stored file keeps them, so the comments list of the viewer may still show them).
- Not changed: published PDFs already stored; the stored DOCX of each revision (it keeps the markup that was reviewed); a new document cloned from a template.

- Later the same day (DEC-DOC-2026-11-27-06) the warning about tracked changes and comments was removed, with `DocxMarkupCounter` and the counts of `comparison-info`.

## Addition: compare from the review editor (DEC-DOC-2026-11-27-07)

- The full-screen editor of "Open File to Comment" has "Compare with Effective" in Pending Review and Pending Approval: the person chooses a revision that is or was Effective, the comparison opens over the editor (read only), "Close Compare" returns. The file being commented on is not changed. New `GET /revisions/{id}/comparison-baselines`; `compare-config` takes `baselineId`.
- A chosen revision must be of the same document and Effective, or Obsoleted after publication, with a Word file; an obsoleted one also needs view permission.
- Verification: frontend documents tests 227 passed, backend 49 selected tests passed, isolated stack 11/11 including the browser (choose, compare, close). DEV backend and frontend rebuilt; not signed in there.
- Limit: the comparison uses the file as last saved.

## Addition: side by side (DEC-DOC-2026-11-27-08)

- `GET /revisions/{id}/onlyoffice/side-by-side-config`; pane fetch `GET /onlyoffice/stored-file/revision-side-{final|current}/{revisionId}?token&content`; `OnlyOfficeSideBySide`, `scrollSync`; `deploy/onlyoffice/eqms-scroll-bridge.js` and the Dockerfile step that adds it to the editor page.
- Guards: separate keys per pane and from the editing session; token bound to pane and revision; the fetch refuses content other than the one announced; a stored file that differs from its recorded checksum is refused; baseline must be of the same document and published; screen refuses an answer about other revisions; each pane shows its own failure; notice when the file is saved again; closed when the revision changes stage (existing lock); not offered under 1024 px; if the bridge does not answer, "synchronised scrolling is unavailable".
- Verification: frontend documents 231 passed (4 new for the scroll rule), backend 49 selected passed, isolated stack 22/22 with 7- and 8-page files (keys, refusals, wheel and programmatic scrolling both ways, toggle, stale notice, close). DEV: bridge present on the Document Server, backend and frontend contain the code; not signed in there.
- Limits: scrolling is aligned by position on the page, not by matching text: after inserted or removed passages the two sides drift apart and are re-aligned by switching scrolling off, positioning, and switching it on. Each comparison uses two more viewer connections of the Community licence. Not tried: real SOPs with landscape sections or large images, browsers other than Edge, a Document Server behind the production reverse proxy.

## Wrong-file check (asked by the owner)

- DEV, read only: no storage object shared by two revisions; no document with two Effective revisions; 210 stored DOCX hashed against their records: 209 match, 1 differs (SOP.0007 revision 1.0.0, Effective, stored 2026-06-19; cause not known; data not changed). SOP.10489 both revisions match. 25 older objects use a path without the revision id (older layout; none shared).
- Found and fixed: (1) the marked comparison did not verify the stored files and its fetch was not pinned to what was announced; (2) **an editor left open across "Replace Source File" (existing) or "Use Effective File" saved its old copy over the new file** (reproduced). Now such a save is dropped and written to the history (`ONLYOFFICE_STALE_SAVE_REFUSED`) and the old session is closed at replacement.
- Verification: isolated stack 9/9 (`wrongfile.py`, includes the control that normal editing still saves); backend 54 selected tests passed. DEV backend rebuilt.
- Open: publishing, the live viewer and controlled copies read the stored file without verifying its checksum (read from the code, not tried).

## Cause of the one checksum mismatch (SOP.0007 1.0.0) and the follow-up

- **Not a changed file.** That record holds a 32-character value, the MD5 of the object (its storage ETag), written by an older version; every other record holds SHA-256. The stored object (one version, never overwritten, locked until 2031) hashes to exactly that MD5, and its own SHA-256 metadata is intact. Re-checking all 323 stored objects with the right algorithm: 323 of 323 match. No wrong or altered file was found on DEV.
- Fix: one rule, `SourceChecksum`, compares SHA-256 and, for such old records, MD5; used by the comparison, the side-by-side view, the copy into the next revision and now **publishing, its preview and controlled-copy PDFs**, which refuse a source file that is not the recorded one (`REVISION_FILE_INTEGRITY_MISMATCH`, no PDF made).
- Past overwrites by a stale editor (the earlier fixed defect): searched the history of DEV for a sync soon after a file replacement; 11 candidates, none shows an editor opened before the replacement, so no evidence of a past overwrite (a viewer's key is shared, history of opens is partial: not proof).
- Verification: 324 selected backend tests (0 failures); isolated stack 10/10 for MD5 records, comparison, copy, and the publishing preview refusing a changed file. **Not verified:** the signed Publish itself with a changed file (the test revision lacked the PREPARED/REVIEWED/APPROVED signatures, so it stopped earlier); Publish recomposes through the same guarded composer, read from the code. DEV backend rebuilt.
