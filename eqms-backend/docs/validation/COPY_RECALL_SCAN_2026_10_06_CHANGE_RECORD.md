# Recall paper Controlled Copies in bulk by scan (QR code)

## Request and scope

Owner request, 2026-10-06 (decisions in `../governance/DECISION_LOG.md`, COPY-RECALL-SCAN-2026-10-06). Recalling returned paper
copies one by one (open the copy, sign, upload a scan) is too slow for a DCO with many copies. New: each paper copy issued
from now on may carry a QR code with a unique, random token; the DCO uploads up to 50 scans, the system reads the codes, shows a
review list, and ONE signature recalls the whole reviewed list. Applies to every controlled copy, whatever the document type;
one scan file is one copy. Each scan is filed as a record, shown on the document's Records tab and on the Document Control
menu **Records**, with a preview modal. Also removed: the "Record Physical Copy" button and its whole chain (see Removals).

## Invariants

- **Actor and permission:** the DCO needs `documents.controlled_copy.recall` and permission to see every controlled copy
  (`documents.controlled_copy.view_all`, or open visibility). Each copy is also checked with the same per-copy recall
  authorization as the single Recall (permission, document scope, lifecycle, actor policy).
- **The code is only a lookup key.** `EQMSCC1:` + 26 random characters (130 bits), stored in `controlled_copies.scan_token`
  (unique index). No document data, status or recipient is in it, so a stale, copied or edited code cannot carry false facts:
  everything is read from the server at confirmation. A photocopy carries the same code: the code says WHICH copy a scan is,
  not that the paper is original, complete or right. That physical check is the DCO's, attested by the signature.
- **Two steps.** Draft: upload, malware scan, QR read, match; nothing about any copy changes. Commit: every included scan is
  re-validated against the CURRENT state of its copy, then one signature is consumed and each copy is recalled.
  Commit is all-or-nothing: if any included scan is no longer recallable, nothing changes, no signature is consumed and the
  recomputed statuses are kept so the screen shows what to fix or exclude (`RecallBatchNotReadyException`, 409).
- **Lifecycle:** only a Distributed copy, or an Obsoleted copy never retrieved (`recalled_at` empty, e.g. obsoleted by its
  document's lifecycle), can be recalled; one already recalled is blocked. Same status machinery, audit entry and
  after-commit notification as the single Recall. A copy cannot be in two scans of one batch or in another open draft.
- **Signature and audit:** one e-signature (meaning `CONTROLLED_COPY_RECALLED`, entity `ControlledCopyRecallBatch`) over the
  list; each copy's audit entry and each scan record's submit signature point at it, so no second token is consumed. Batch
  creation, additions, manual matches (with the code read on the scan), exclusions, discard and commit are audited.
- **Dates:** the recall date is the date the paper was received (default now; not in the future; not before the copy was
  distributed). The signing time is recorded separately and cannot be changed.
- **Files:** type decided from the file's own bytes (PDF/PNG/JPEG only), at most 25 MB each, 50 per batch, 150 MB per request
  (proxy limit). ClamAV scans every file; an enabled but unreachable scanner fails the upload (never skips); an infected,
  unsupported, empty or oversize file is recorded as blocked and is not stored. Each file has a SHA-256. A draft can only be
  changed, committed or discarded by its creator; a discarded draft keeps its uploaded files.
- **Records visibility:** a scan record follows the visibility of its copy: blanket copy viewers see all; everyone else only
  records of copies they are the named recipient of (list, detail, preview and download). Preview needs only the view
  permission, serves the bytes with the sniffed type, `nosniff` and `no-store`.
- **Paper only (owner reminder 2026-10-07):** recall by scan, QR codes and scan upload apply to PAPER copies only; the batch service blocks any non-paper copy (even one carrying a code). Electronic copies keep their normal automatic or manual Recall, unchanged.
- **Copies printed before this change** have no code: they cannot be recalled by scan (even by naming them) and keep the single
  Recall. Manual matching by copy number exists only for copies that carry a code (for a damaged/unreadable QR).

## Design and changes

- **DB (V541, applied to the dev database by the Spring tests):** `controlled_copies.scan_token`; policy columns
  `qr_code_enabled` (default true), `qr_code_position` (BOTTOM_RIGHT), `qr_code_size_mm` (20; accepted 15 to 40);
  `controlled_copy_recall_batches`, `controlled_copy_recall_items`; `executed_records` gains `recall_batch_id`, `file_name`,
  `content_type`, `file_size`. The existing `executed_records` table is now the register of returned-copy scans for any
  document type (its `form_*` columns name the document and revision).
- **Backend:** `ControlledCopyScanCodeService` (static: token, payload, ZXing encode, decode of PDF first page at 200/300 DPI
  or PNG/JPEG), `ControlledCopyPdfMarkingService.applyScanCode` (QR on page 1, white quiet zone, copy number caption,
  corner with automatic move to a free corner, recorded in the copy's marking layout so later status stamps avoid it),
  `ControlledCopyService.markAndStore` (assigns the token while composing a PAPER copy) and `recallFromScanBatch`,
  `ControlledCopyRecallBatchService` + `ControlledCopyRecallBatchController` (`/controlled-copies/recall-batches`),
  `ExecutedRecordService.recordRecalledCopyScan`/`previewFile` and `GET /executed-records/{id}/preview`, policy
  validation/audit summary, marking preview shows the QR. Dependency: `com.google.zxing:core:3.5.3`.
- **Frontend:** Controlled Copies > "Recall by Scan" screen (upload, review table, match by number, exclude, attestation +
  received date, e-signature, outcome), QR card in Policy > PDF Markings, `ScanPreviewModal` (PDF in the read-only viewer or
  image; download/print hidden), Records page (menu "Records") and document Records tab: click a row or its Scan link to
  preview. The document tab is now named "Records".

## Removals (owner: leftover of the retired electronic-form design)

"Record Physical Copy" button and description on a Form's Records tab, `SubmitExecutedRecordModal` (+ test), the
`recordPhysicalCopy` FE API call, the REST endpoint `POST /forms/{id}/executed-records/record-physical-copy`, and the public
service method (now private, reachable only through the copy's own Recall, `recordPhysicalCopyAndClose`, which is unchanged).
Follow-up, 2026-10-07, owner decision "xoá các bảng eForm cũ": migration **V543** drops `form_settings` and the seven `eform_*`
tables (10 edit sessions, 7 retirement history rows, 3 form settings, 1 design-engine write, and empty others when checked) and
the now unused `reject_retired_eform_write()`. Before it ran, all eight tables were exported with `pg_dump` to
`backups/eform-tables-2026-10-06.sql` (git-ignored). Not removed: files already in storage (now unreferenced by any table),
electronic signatures, audit entries, executed records, controlled copies including the read-only
`eform_signing_protocol` column, and the paper-only guard triggers. The manual `eform-retirement-assertions.sql` script, which
only made sense while the tables existed, was deleted. **Before deploying V543 to any other database, back it up first.**
`RecallByScanMigrationIntegrationTest` now asserts the tables and function are gone and the guards remain.

**Incident while applying V543 on the dev database:** the first attempt hung. A test JVM from 15:42 had been left with a
transaction `idle in transaction` for over 8 hours; the DROP waited for it and, queued behind it, blocked the dev backend's own
queries and a container restart. The assistant ended its own orphaned DDL session and that stale session (a test transaction,
nothing to lose); the container's Flyway then completed V543 and the backend became healthy. Applying V543 to a busy database
needs a quiet moment or a short `lock_timeout`.

## Source and impact evidence

GitNexus upstream impact before editing: `ControlledCopyPolicySetting` CRITICAL (56 impacted, 5 direct; destroy, replace,
recallBatch, distribute, cancel, preview, request flows) and `ControlledCopyRecord` HIGH (36/22); both edits only ADD fields
with defaults. The other edited symbols (`markAndStore`, `applyMarking`, `closeAfterExecutedRecord`...) were not yet in the index
when checked (UNKNOWN). Owner approved the additive entity changes. `detect_changes` was not run (nothing committed; the working
tree holds unrelated earlier changes): run it before committing.

## Test evidence

2026-10-06, Java 23 / Node (vitest, tsc):
- `ControlledCopyScanCodeTest` 13: token format/uniqueness, only a well-formed EQMS payload yields a token, print then decode in
  all four corners on pages rotated 0/90/180/270, 150 DPI JPEG and PNG scans, occupied corner moves the code, no code, foreign
  QR, two codes, garbage/truncated bytes, type sniffing.
- `ControlledCopyRecallBatchServiceTest` 24: match by code, manual match, unknown number, copy without a code, not-recallable
  states, already recalled, duplicate copy, copy claimed by another draft, denied recall authorization, unsupported/infected
  files never stored, scanner unreachable fails the upload, 50-file cap, permission checks, other user's draft, commit under
  one signature in order (consume, sign, recall each, file each), not-ready batch changes nothing and consumes no signature,
  state change between upload and commit, missing reason/signature, future/pre-distribution dates, all excluded, committed batch
  immutable, discard.
- `ControlledCopyObsoleteRaceTest` 28 (incl. `recallFromScanBatch` and a paper copy getting its token), `ExecutedRecordServiceTest`
  15, `ControlledCopyPolicyQrConfigTest` 5, marking tests 47.
- `ControlledCopyRecallByScanIntegrationTest` 3 on the **real schema and beans** (storage, ClamAV and the signature stubbed, all
  rows rolled back): two real Distributed paper copies matched by their codes, recalled under one signature and filed as
  records; a recalled copy is blocked in a second batch; the record is found by copy number, previewed, and visible to the named
  recipient only. `RecallByScanMigrationIntegrationTest` 5 (schema, permissions, backfill).
- Full backend suite 1169 tests, 2 failures (one fixed, one pre-existing and unrelated; see the visibility record).
- Frontend: `ScanPreviewModal` 8, `ControlledCopyRecallScanView` 14, the documents/settings/breadcrumb suites 115 in total
  at the time, `tsc` clean apart from two pre-existing `ReportLists.test.tsx` errors, `vite build` passed (existing large-chunk
  warning only; output written outside `dist/`).

## Limitations and open risks

- **Not verified at runtime:** the screens were not opened in a browser, and the Docker images were not rebuilt. Real ClamAV,
  real MinIO and a real e-signature token were not exercised (stubbed in the integration test). Do a UAT pass: issue a paper
  copy, print and scan it, run a batch.
- **Scan quality** is only tested with synthetic 150 DPI JPEG/PNG renders of an A4 page; real scanners, skew, creases and
  very low resolution may fail to read (the manual match by number covers a damaged code). The 20 mm default is unproven on
  paper.
- QR printing defaults to ON for new installs and for the existing policy row (`qr_code_enabled` default true): paper copies
  issued from now on carry the code unless an administrator switches it off.
- **A photocopy is not detected.** The signed attestation is the control; QA should decide whether the wording is enough.
- The recall date semantics were confirmed by the owner on 2026-10-07. The 25 MB / 50 files limits, the attestation wording,
  creator-only drafts and keeping discarded uploads are still assistant proposals pending QA (see the Decision Log).
- A discarded or abandoned draft leaves its uploaded files in storage; there is no clean-up job and no retention rule for them.
- The scan record's `filled_by` is the copy's recipient and `filled_at` the received date; the `form*` API field names are kept
  for compatibility.
- 50 very large scans can exceed the 150 MB request limit; the screen warns before upload and the draft can be extended.
- Reports and listings that call `canViewDocument` follow the new visibility rule (see the visibility record).

## Follow-up 2026-10-07 (owner decisions)

- **No approval step for scan records.** The DCO's one signature on the recall, with its attestation, is the control, so a record is
  filed `EXECUTED`. Removed: `POST /executed-records/{id}/approve|reject`, their DTOs, the SoD dependency of
  `ExecutedRecordService`, the Approve/Reject buttons, the Status column/filter and the Method column/filter (no eForm records
  exist; `captureMethod` stays in the data). Migration **V544** moved the one `PENDING_APPROVAL` record (EXEC-FORM.0005-001, filed
  before this change) to `EXECUTED` without a signature and deleted the permissions `documents.form.approve_executed_record` /
  `reject_executed_record` (18 Permission Set grants exported to `backups/removed-executed-record-approve-grants-2026-10-07.csv`).
  The `EFORM_APPROVED` / `EFORM_REJECTED` signature meanings are no longer used by any code.
- **PDF only.** The company scanner produces PDF, so recall by scan accepts only PDF: the type is read from the bytes, and after the
  virus scan the file must open as a PDF that is not password-protected and has at least one page; otherwise it is blocked and not
  stored. The file picker and drop zone only take PDF. (Image decoding and image preview code remain but are no longer reachable
  from this screen.)
- **"Recalled Scan" stamp and watermark.** New per-status marking key `RECALLED_SCAN` (separate from Obsoleted), configured in
  Controlled Copies Policy > PDF Markings (tab "Recalled Scan", default stamp "RECALLED", red watermark, received-date line).
  Drawn on a copy of the bytes whenever a scan record is previewed or downloaded; the stored file and its SHA-256 never change.
  Fails closed: if the marking cannot be drawn, the scan is not served unmarked. Only records of a controlled copy with a paper
  scan are marked. The policy preview has a matching scenario. Stored in the existing `status_marking` jsonb: no migration.
- GitNexus upstream impact: `ControlledCopyPolicyService` CRITICAL (271 impacted, 1 direct), edited additively (one more key in the
  list of configurable status markings); `ExecutedRecordService`, `ControlledCopyMarkingPreviewService`,
  `ControlledCopyStatusMarking` LOW. `detect_changes` not run (nothing committed).
- **Not verified in a browser or with a real scanner PDF:** the marking was tested on the synthetic integration-test PDF only; a
  real scan with an unusual page size or an embedded page rotation may place the marks differently.

## Follow-up 2026-10-07 (owner decision: the QR code no longer depends on the delivery mode)

- Delivery mode (paper / electronic) was a leftover of the retired eForm design. The QR code is now printed on every Controlled Copy
  issued from now on (when the policy has QR printing on), so that a copy that is downloaded or printed, whoever does it and
  whatever permission allowed it, always carries its code. The "paper only" rules added earlier the same day are removed: the
  batch recall no longer checks the delivery mode (a copy needs only its scan code), and `recordPhysicalCopyAndClose` no longer
  rejects a copy whose delivery mode is not PAPER. The "Paper only" invariant above is superseded by this entry.
- Viewing a copy online shows the same PDF, so it shows the code too. The code is an opaque lookup key; seeing or photographing it
  does not allow anything by itself (a recall needs a DCO with the recall permission, who attests the physical paper and signs).
  It does mean the same residual risk as a photocopy: anyone who can open the copy online could print a page that carries its code.
- The `delivery_mode` column, the request field and the front-end types are still there and are NOT removed by this change.
- GitNexus upstream impact: `ControlledCopyService` CRITICAL (276 impacted, 1 direct); the edit removes one condition inside the
  private `markAndStore`. `detect_changes` not run (nothing committed).
- **Delivery mode removed (owner decision, same day).** Migration **V545** drops `controlled_copies.delivery_mode`, the trigger
  `controlled_copy_paper_only` and its function `require_paper_controlled_copy()` (all 3017 existing copies held PAPER; nothing is
  lost). Removed from the code: the request field `deliveryMode`, the list response field, the entity field, the checks in request,
  distribution and finalisation, and the front-end types and mapping. The paper-only guard on Executed Records (`capture_method`)
  stays. Two tests of the retired behaviour were removed (a direct electronic request is rejected; a stale electronic distribution
  cannot be generated). GitNexus upstream impact: `ControlledCopyRecord` CRITICAL (277 impacted, 1 direct). **Deployment:** the
  application and the database must be changed together: an older backend image selects `delivery_mode` and fails once V545 ran.
  **Back up the database before applying V545 elsewhere.** A client that still sends `deliveryMode` is ignored by the server.

## Follow-up 2026-10-07 (owner request: drag and resize the QR code like the stamp and watermark)

- In Controlled Copies Policy > PDF Markings > Distributed Copy, the QR code can be dragged to any place on the first page and
  resized with the corner handles, in the same Konva editor as the stamp and watermark (same Group + Transformer pattern). The size
  is still stored in millimetres (15-40); a resize multiplies the stored size by the scale and is clamped. The position is stored as
  fractions of the page (top-left of the code's frame) in `controlled_copy_policy_settings.qr_code_x/qr_code_y` (migration
  **V546**, both NULL or both within 0-1, enforced by a CHECK). NULL keeps the chosen corner; picking a corner, or "Reset
  position", clears it. The server validates both values together before storing either.
- A hand-placed code is printed exactly there and is never moved (the automatic move to a free corner applies only to corners); it
  is clamped to stay on the page. Because the position is free, the administrator can place it over page content: the white quiet
  zone is still drawn so it stays scannable, but nothing warns about covering text. Existing copies keep the code where it was
  printed; only copies issued afterwards use the new position.
- The drag and resize in the browser is not covered by an automated test (canvas); the policy rules, the API request mapping, the
  PDF placement and the readability of a code placed by hand are.
- GitNexus upstream impact: `ControlledCopyPolicyService` CRITICAL (271 impacted), `ControlledCopyService` CRITICAL (276); both
  edits only pass two more values through. `detect_changes` not run (nothing committed).

## Follow-up 2026-10-07 (QR code keeps clear of the stamp and the watermark; end-to-end test)

- A QR code dropped on the stamp or the watermark (rotated watermark included: the check uses the oriented boxes) is not printed
  there: it jumps to the nearest free place on the page (grid of about 4 mm), is marked `adjusted`, and the policy preview warns
  (`QR_MOVED`). The editor then keeps that place as the saved position, so what is saved is what is printed. When no free place
  exists the configured corner is used. This supersedes the "never moved" wording in the entry above.
- `ControlledCopyEndToEndIntegrationTest` (real schema and services; storage, virus scanner and e-signature replaced; one
  transaction rolled back, so the live policy is never touched): policy with download allowed, stamp, watermark and a QR code
  dropped in the middle of the page; request; distribution; issuing; the stored PDF carries the code and the stamp, the
  watermark and the code do not overlap (the code had to jump); download is allowed and the downloaded file decodes to the copy's
  code; that download used as the scan is matched, recalled under one signature and filed as a Record found by copy and shown
  with "RECALLED"; download is refused while the policy forbids it, yet the code is still printed; the code is printed when
  stamp and watermark are off.
- Not done: the same flow through the browser and the HTTP API (no test account was available), and with real storage, a real
  publishing template, real ClamAV or a real e-signature.

## Follow-up 2026-10-07 (owner decision: no separate "Recalled Scan" marking; use Obsoleted)

- A recalled paper copy is an Obsoleted copy (reason RECALLED), so its scan is shown with the **Obsoleted** stamp and watermark
  configured in Controlled Copies Policy > PDF Markings. The separate "Recalled Scan" tab and the `RECALLED_SCAN` status marking key
  were removed (nothing had been saved under that key; the stored jsonb holds only OBSOLETED and CLOSED_CANCELLED). This supersedes the
  "Recalled Scan" entry above.
- The marking is drawn automatically, every time a scan Record is previewed or downloaded, with the same lines the obsoleted copy
  shows (its title and "Withdrawn <date>", the date being the day the paper was received). It is NOT burned into the stored file: the
  scan is the evidence, its SHA-256 must stay equal to what was uploaded, and a mark burned in could cover what the scan shows.
  Changing the Obsoleted marking therefore also changes how every scan Record is shown, past ones included.

## Follow-up 2026-10-07 (one scan of loose pages of many copies; a code on every page)

Owner decisions (DECISION_LOG, COPY-RECALL-SCAN-2026-10-06, 2026-10-07 entry): the DCO may scan a pile of pages of several
controlled copies as ONE file; the system recognises, groups, orders and splits it. The paper still shows only the QR code and the
controlled copy number. Pages that cannot be recognised are listed to the DCO, who must type the exact controlled copy number.

- **Code on every page.** A copy issued from now on prints its code on every page, not only the first. The text inside the code is
  `EQMSCC2:<token>:<page>:<pages>`; nothing else is printed. A code alone could not give the page order, so the page number lives
  inside the code, not on the paper. Copies printed earlier keep `EQMSCC1:<token>` (first page only) and are read as before.
- **Reading a scan.** Every page (up to 200) is read. Pages are grouped by copy token, put in page order and cut into one PDF per
  copy; each copy is checked for completeness against the page count in its codes. A copy with a missing page is BLOCKED, naming
  the pages. A page scanned twice, a code that belongs to no copy, a foreign code, several codes, no readable code, or an old
  per-copy code inside a paged scan becomes a *loose page* item with the reason. A scan with no per-page code anywhere stays one
  item for the whole file, exactly as before (manual match by number).
- **Loose page.** The DCO previews it and must type the controlled copy number AND the page number. The page is put into that
  copy's file at that place (page number outside 1..N, or already taken, is refused and nothing changes). A duplicate is excluded.
  Commit is still all-or-nothing under one signature, and refuses while any page item is unplaced or any copy incomplete.
- **Evidence.** The uploaded multi-page file is stored untouched (its SHA-256 and name are kept on every item cut from it, with the
  source pages); a `SPLIT_SCAN` audit entry records pages, copies and unrecognised pages; each manual placement is audited with the
  code that was read. Migration V548 adds the columns.
- **Tests.** `ControlledCopyRecallBatchServiceTest` +6 (shuffled pile of two copies is split and exactly ordered; missing page
  blocks and names the page; placing a loose page puts it between the pages that carry codes; page number out of range, taken, or
  absent refused with nothing changed; duplicate page excluded; code of no copy listed), `ControlledCopyEndToEndIntegrationTest`
  (an issued copy's every page carries token, page and count), frontend +2 (loose page needs a page number; pages of a split item).
- **Not done / limits.** Not tried in a browser or with a real photocopier scan (skewed, faint or cropped pages are what the loose
  page step is for); the pages of a copy with no stored file cannot be checked when ALL its pages are loose. Controlled copies
  printed before this change cannot be sorted page by page. GitNexus impact analysis and `detect_changes` were not run (the tool
  was not available in this session; nothing is committed).

## Follow-up 2026-10-07 (PDF Markings preview on one sample paper; QR code Pages)

Decision MARKING-PREVIEW-BASE-2026-10-07. The marking-preview requests of both policies carry only the draft marks (no template, layout,
document or page kind): the server draws them on one generated A4 sample page and returns the first page. The pane has no selectors; a
dragged stamp or watermark is stored for page 1 and pages 2+ alike. New policy field qrCodePages (ALL default | FIRST, V549) with a Pages
select next to Corner and Size; a copy is issued with the code on every page (ALL) or on page 1 only (FIRST).
Tests: ControlledCopyMarkingPreviewBaseTest (sample page), ControlledCopyPolicyQrConfigTest +2 (pages stored, others refused),
ControlledCopyScanCodeTest +1 (code on every page with its number, or first page only), MarkingPreviewPane.test.tsx (no selectors, nothing
but the draft is sent), QrCodeFields.test.tsx +1. Not changed: how a controlled copy is composed (through the revision's publishing
template when it has one). Not tried in a browser; the preview shows one QR position (page 1) whichever Pages is chosen.
