# Approved decisions

## DASHBOARD-HEADER-TITLE-2026-10-07 — A configurable title in the top bar of the Dashboard

Owner decisions, given in this conversation (2026-10-07):

- **What:** on the Dashboard (the ordinary user's and the administrator's), on **desktop**, the system's top bar shows the text
  "**Electronic Quality Management Software**". It **stays** when the page is scrolled; it does not give way to the page title.
- **Configurable:** the text is set in Settings > Configuration > General > **Branding** (a new field, "Header Title (Dashboard)").

Assistant choices to confirm (not stated by the owner): the field is plain text, one line, at most 120 characters (the server refuses
more, line breaks and control characters). Leaving it **empty** brings back the text above; it cannot be used to hide the title. It is
stored as `systemHeaderTitle` in the General configuration and published with the public branding (`GET /branding`), so it is visible
before login, like the display name. "Desktop" means tablet width and up (the width at which the top bar already shows breadcrumbs);
phones keep the logo and the scrolled-page title. On the Dashboard the title replaces the breadcrumbs. Other pages are unchanged. A change
is audited with the rest of "General Configuration" and reaches open sessions through the existing branding refresh. See
`../validation/DASHBOARD_HEADER_TITLE_2026_10_07_CHANGE_RECORD.md`.

## ADMIN-SYSTEM-MONITORING-2026-10-07 — System-monitoring cards on the administrative dashboard

Owner request, 2026-10-07: "add more information cards for the administrator that relate to monitoring the system". The owner did not
choose the figures; the list below is the assistant's selection, to be confirmed.

- **Where and who:** a "System monitoring" section of the administrative dashboard, served by `GET /dashboard/system-monitoring`, which
  needs `dashboard.admin.view` (checked by the server). Nothing is added for the user dashboard.
- **Figures (all counted when the request is made, never cached or estimated):** server uptime and heap use; database schema version,
  applied migrations and connection-pool use; user accounts by status; accounts locked right now; active sessions (status ACTIVE, not
  revoked, not expired); failed logins in the last 24 hours (auth audit event `login_failed`); electronic signatures applied in the last
  30 days (status SIGNED); open Access Review campaigns, open Audit Trail Review campaigns (status IN_PROGRESS) and open Controlled Copy
  batch status discrepancies (status OPEN).
- **No verdict:** the cards show counts only. There is no healthy/unhealthy threshold, because none was decided. "None open" and "n open"
  are the only wording; a count above zero is not presented as a fault.

Assistant choices to confirm (not stated by the owner): the runtime facts (uptime, heap, pool, schema version) are disclosed to holders
of `dashboard.admin.view`, who may not hold `settings.configuration.view`, the permission of Settings > System Information; the response
leaves out the operating system, JVM vendor, driver and host details that screen shows. The page reads again every minute and on
Refresh. A queue links to its screen only if the user holds that screen's permission (`security.access_review.view`,
`audit.review.view`); the discrepancy row has no link. The cards do not show service reachability (MinIO, ClamAV, OnlyOffice, Redis,
mail): the system has no such check to read, and the dashboard does not invent one. See
`../validation/DASHBOARD_PERMISSION_SETS_2026_10_07_CHANGE_RECORD.md`.

## DASHBOARD-PERMISSION-SETS-2026-10-07 — Separate Permission Sets for the user and administrative dashboards

Owner decisions, given in this conversation (2026-10-07):

- **What:** two separate Permission Sets, one for the **user** dashboard and one for the **administrative** dashboard
  (**Dashboard User**, code `DASHBOARD_USER`; **Dashboard Admin**, code `DASHBOARD_ADMIN`).
- **How they are modelled:** as **bundles of the permissions that already exist**; no new permission, no change to how the dashboard
  is protected. Dashboard User = `dashboard.module.view`. Dashboard Admin = `dashboard.admin.view` + `dashboard.module.view`
  (V403 records the first as REQUIRING the second).
- **Who gets them:** **nobody, yet.** The sets are only created; an Administrator assigns them to Access Profiles in Access Profiles.
  Nobody gains or loses a permission.

Assistant choices to confirm (not stated by the owner): both sets are ordinary (not system) sets, so an Administrator can still edit
them, and delete one while it is unassigned; they are created by migration V551, which leaves a set or item that already exists
untouched. `BASELINE_PERSONAL_WORKSPACE` still grants `dashboard.module.view` to every Access Profile, so assigning Dashboard User
adds nothing today; Dashboard Admin does add `dashboard.admin.view`, which the Administrator profiles already hold and which V278
deliberately removed from DCO. The screen picks the administrative dashboard when the user holds `dashboard.admin.view`, otherwise the
user dashboard (unchanged). See `../validation/DASHBOARD_PERMISSION_SETS_2026_10_07_CHANGE_RECORD.md`.

## DOC-REOPEN-2026-10-07 — Reopen a closed Document (Administrator)

Owner decisions, given in this conversation (2026-10-07):

- **Who:** only an Administrator, through a **dedicated permission** `documents.document.reopen` ("Reopen Document"), granted to the
  Administrator permission sets (`ROLE_ADMINISTRATOR`, `SYSTEM_ADMINISTRATION`). The grant that document-control sets (`ROLE_DCO`,
  `ROLE_DOCUMENT_CONTROLLER`) held was removed (list in `backups/reopen-permission-grants-before-2026-10-07.csv`).
- **From where:** any closed state of the Document: **Closed - Cancelled** or **Obsoleted**. Button **Reopen** in the footer of the
  Document detail screen, shown only when the server's capability says it is allowed.
- **What it does:** returns the Document to the **previous state before closure** (Obsoleted → Active, Closed - Cancelled → Draft),
  **with an e-signature (meaning `DOCUMENT_REOPENED`) and an audit entry** (action REOPEN, from/to status, reason, linked to the signature).
- **One-way for dependants:** Reopen acts **only on the Document**. Its old Revisions and Controlled Copies, already closed or
  obsoleted, are **not reopened or restored**; a **new Revision** is created and **new Controlled Copies** are issued once the Document
  is active again.

Assistant's implementation choices to confirm (not stated by the owner): the previous state is recorded when a Document is
closed (`documents.status_before_closure`, V547); for one closed before V547 it is derived from the only state each closure is
possible from (Obsolete needs Active, Cancel needs a Document with no revision, i.e. Draft). The reason is mandatory. An Active
Document with no Effective revision (an Obsoleted one reopened) may now receive its next revision: "Edit Revision for Upgrade" and
"Upload Revision" no longer require an Effective revision, only an Active document with a revision to build on; requesting a
Controlled Copy still requires an Effective revision. No notification is sent on reopen. The Revision Workflow's own
`documents.revision.*` rules are unchanged. See `../validation/DOC_REOPEN_2026_10_07_CHANGE_RECORD.md`.

## COPY-RECALL-SCAN-2026-10-06 — Recall paper Controlled Copies in bulk by scanning their QR code

Owner decisions, given in this conversation (2026-10-06):

- Paper Controlled Copies may carry a QR code (configured in Controlled Copies Policy > PDF Markings). A DCO uploads up to
  50 scans (each checked with ClamAV) on a new screen, Controlled Copies > Recall by Scan; the system reads each code and
  recalls the matching copies. Owner: **one signature for the whole batch** ("1 chữ ký cho cả lô").
- It applies to **every** controlled copy, whatever the document type: no Form/SOP distinction ("Bất kể controlled copy
  nào cũng có thể thu hồi theo lô"). **One scan file is one copy, so each copy's code is unique.**
- Copies printed before this change have no code and keep the existing single Recall ("Bỏ đi, áp dụng mới từ bây giờ").
- Each scan is shown in the document's Records tab (previously "Executed Records") and in the Document Control menu
  **Records**, which lists every scan; clicking a row opens a preview modal of the scan.
- Removed as a leftover of the retired electronic-form design: the "Record Physical Copy" button/description on a Form's
  Records tab and its whole chain (modal, FE API call, REST endpoint, public service method). Returned Form copies are still
  recorded through the copy's own Recall action.
- **Recall date (owner, 2026-10-07):** "Ngày thu hồi chính là ngày nhận giấy, không được ở tương lai và không được trước ngày
  phân phối; giờ ký ghi riêng." The date is entered by the DCO; the signing time is recorded separately.
- **Retired eForm tables deleted (owner, 2026-10-07: "xoá các bảng eForm cũ"),** superseding the "no data purge" clause of
  EFORM-RETIRE-2026-10-03: `form_settings` and the seven `eform_*` tables (V543). Their rows were exported to
  `backups/eform-tables-2026-10-06.sql` first. Not deleted: files already in storage, electronic signatures, audit entries,
  executed records, controlled copies and the paper-only guard triggers. The read-only
  `controlled_copies.eform_signing_protocol` column was not part of the request and remains.

Design points proposed by the assistant, built as proposed and **pending QA review** (not separately approved by the owner):
the code carries only an opaque random per-copy token; two steps (draft review, then commit) because a QR code identifies
the copy but cannot prove the paper is original, complete and correct, which the DCO attests by signing;
commit is all-or-nothing and consumes no signature if any scan is not recallable; an enabled but unreachable virus scanner
fails the upload instead of skipping the scan; only PDF/PNG/JPEG (by file content) up to 25 MB; a draft belongs to its
creator and a discarded draft keeps its uploaded files; the scan records follow the visibility of the copy (blanket copy
viewers, or the named recipient).

Open risks and evidence: ../validation/COPY_RECALL_SCAN_2026_10_06_CHANGE_RECORD.md.

**One scan of many copies (owner, 2026-10-07).** The DCO may scan a pile of loose pages of several copies as ONE file and
the system recognises, classifies, orders and splits it into one file per copy ("tự động nhận dạng, phân loại, sắp xếp và tự chia
lại đúng file"). The paper shows only the QR code and the controlled copy number ("không thêm gì khác"); page order must be exact.
A page that cannot be recognised is listed and previewed to the DCO, who MUST type the exact controlled copy number by hand.
This supersedes "one scan file is one copy" above. Assistant-proposed, pending QA review: the page number and page count live
*inside* the code of each page (a code identical on every page cannot give an order); the DCO also types the page number of an
unrecognised page (a copy number alone cannot place it); a copy with a missing page is blocked; a duplicate page is excluded by
the DCO; copies printed before this change keep the old first-page code and cannot be sorted page by page.

## DOC-VISIBILITY-2026-10-06 — Record visibility for Document Control

Owner decisions, given in this conversation (2026-10-06), replacing the environment flag
`APP_SECURITY_PARTICIPANT_VISIBILITY_STRICT` and the unresolved "D2" question:

- A system-wide setting in Document Properties, **Record visibility**, with two values.
  `PARTICIPANTS_ONLY` (default; owner: "Bật"): a user sees a Document/Revision only as its Author,
  Co-Author, Reviewer or Approver (document or revision level; roles may differ per document or
  combine on one); a Controlled/Uncontrolled Copy only as a named recipient. `ALL_WITH_VIEW_PERMISSION`
  (owner: "Nếu tắt thì xem được hết mọi thông tin"): every holder of the base View permission
  sees every record in lists and detail, including drafts, in-review content and review snapshots.
- Dedicated blanket-view permissions that no setting affects, assigned only through Access Profiles
  and never by profile name (owner: "không được hard code"): `documents.document.view_all`,
  and two new ones for copies, `documents.controlled_copy.view_all` and
  `documents.uncontrolled_copy.view_all` (owner: "Cần 2 quyền, vì phạm trù 2 cái đang khác nhau").
  `documents.document.view_all` becomes the only document blanket grant; the administration permissions
  that used to imply it were migrated to it (V540) so no account's effective access changes on upgrade.
- Copies (owner: "chỉ xem được ... nếu họ có tên trong danh sách người nhận"): Document-flow
  participants, requesters and people who acted on a copy no longer see it unless they are the
  recipient or hold the blanket copy permission. Recipients are matched by account id, never by
  display text. Batches list every recipient, so only blanket viewers open them (owner: "đồng ý").
- The Report Platform follows the new document visibility rule (owner: "đồng ý").
- **Blanket visibility belongs to DCO and Administrator sets only (owner, 2026-10-07: "Gỡ quyền xem-tất-cả khỏi 16
  permission set không phải DCO/Admin").** Of the 16 sets that V540 had granted the three view-all permissions, 8 were
  kept as DCO/Administrator (`PS_DCO_TEST`, `PS_DOCUMENT_DCO`, `PS_UAT_DOCUMENT_DCO`, `PS_DOCUMENT_VIEW_ALL`, `ROLE_DCO`,
  `ROLE_ADMINISTRATOR`, `ROLE_DOCUMENT_CONTROLLER`, `SYSTEM_ADMINISTRATION`) and the grants were removed from the other 8
  (V542; the removed rows are in `backups/removed-view-all-grants-2026-10-06.csv`). Which sets count as DCO/Administrator
  was the assistant's reading: `ROLE_DOCUMENT_CONTROLLER` (profile "Document Controller") was kept as DCO-equivalent.
- **Open:** 8 further sets (Approver, Quality, Contributor and DCO-named sets) still hold `documents.uncontrolled_copy.view_all`
  alone, kept by V540 because those sets approve/reject/distribute uncontrolled copy requests and used to see every copy
  through those permissions. They were not in the 16 and have not been changed; an approver without it would see only
  the copies they are the recipient of, not the requests they must decide. Owner decision needed.
- Training is out of scope; Knowledge Base department scoping is unchanged.

Open risks and evidence: ../validation/DOC_VISIBILITY_2026_10_06_CHANGE_RECORD.md.

## REPORT-TEMPLATE-UI-DELETE-2026-10-04 — Shared UI and reversible removal

Owner requests shared policy-style tabs/layout, table/filter/drawer/action components,
server filtering/sorting/pagination and a shared Create Report stepper. Owner explicitly
approved: "Đồng ý, xóa mềm và giữ lịch sử". Deletion requires existing configuration
manage permission, current version and an audit reason; hide deleted templates from
catalogs and prevent new runs/edits. Preserve role grants, definition versions, existing
run snapshots, files/checksums and audit history. Existing artifact access remains subject
to current role scopes; deletion must not grant or revoke unrelated document access.
Evidence: ../validation/REPORT_TEMPLATE_UI_2026_10_04_CHANGE_RECORD.md.

## REPORT-WORD-LAYOUT-2026-10-04 — Report presentation, not electronic signing

Owner requests an always-visible placeholder catalog with explanations, portrait/landscape,
movable logo, and DOCX cover/header/footer uploads with server inspection/filling. Owner
explicitly chose: "Chỉ hiển thị tên người lập/thời gian, không coi là chữ ký điện tử".
Do not reuse Document/Revision signature identities or create report approval/signing flows.
Existing scopes, versioned Save Changes/audit, immutable run snapshots/files and retention stay.
Existing layouts without an orientation retain landscape. Uploaded components are immutable,
bounded DOCX files with checksum/placeholder inspection; no macro/external linked resources.
Evidence: ../validation/REPORT_WORD_LAYOUT_2026_10_04_CHANGE_RECORD.md.

## REPORT-ANALYTICS-2026-10-03 — Server charts and report presentation

Owner approved the proposed scope with "đồng ý làm": server-computed column/pie/line
charts over authorized metadata; administrator-defined reusable layouts with logo,
custom text marks and positions; request-specific report titles; automatic EmbedPDF
preview; consistent catalog/run/history/schedule UI. Presentation changes apply only
after versioned Save Changes. Existing artifacts, scopes, retention, signatures and
source-document access remain unchanged. Preview does not create a report run.
Image uploads are bounded PNG/JPEG bytes, never external URLs or executable SVG.
Charts use the same authorized full dataset as the report, not FE pagination; grouped
counts/percentages and monthly trends are available without user SQL/formulas.
Evidence: ../validation/REPORT_ANALYTICS_2026_10_03_CHANGE_RECORD.md.

## REPORT-LAYOUT-2026-10-03 — Shared administrator presentation templates

Owner explicitly chose: "Admin sẽ tạo và áp dụng cho các báo cáo về sau" and
"Admin với full quyền" for TEST report access. Administrators with existing report
configuration permissions define shared future-report layouts. TEST templates grant
SYSTEM metadata scope only to the active ADMINISTRATOR Access Profile; no unrelated
role or source-content privileges are added. Executor and creation time are server-derived.
Each request pins the accepted layout; completed reports remain immutable. Presentation
stamps/watermarks do not substitute for signatures or approval. Existing retention stays.
Evidence: ../validation/REPORT_LAYOUT_2026_10_03_CHANGE_RECORD.md.

## REPORT-TEMPLATE-2026-10-03 — Role-scoped metadata reports

Owner approved UI variant B and implementation of Report Templates in this conversation:
"cấu hình theo role như bạn nói. Bây giờ hãy bắt tay vào xây dựng hoàn chỉnh chức năng Report Template trước".
Report metadata visibility is independent of document-content access. Administrators configure
personal, Department, Business Unit or system-wide metadata scope per active Access Profile
(the existing `roles` / `user_access_profiles` model). Report access must not grant document
preview, source-file download, edit, workflow, or electronic-signature privileges.
Server owns filtering, sorting, pagination, validation and generation. Each module exposes
an allowlisted metadata provider, never arbitrary SQL or user-authored joins. Preview,
generation and artifact download re-evaluate report scope. Existing retention policies and
historic records/files are preserved; no new purge period is approved.
Initial implemented provider is Document Register. Future modules register providers against
the same template/run contract rather than adding document-specific privileges to the platform.
Evidence: ../validation/REPORT_TEMPLATE_2026_10_03_CHANGE_RECORD.md.

## EFORM-ENGINE-2026-10-03 — Reviewed Draft field conversion

Owner approved immediate implementation, then explicitly approved the HIGH-impact
design-session guard change ("đồng ý"). Authors review recognition proposals before
converting them; ordinary document edit authorization remains authoritative.
DOCX source and Effective templates remain unchanged. A replacement DESIGN session
invalidates its predecessor, including late callbacks and commit requests.
New sessions pin the Draft revision. Existing unpinned sessions retain their prior
authorization rules but cannot use the new engine: reopen to create a pinned session.
Signature slots use generated `esignN` identifiers and `{{esign:esignN}}` tokens;
labels are independent of positions, assigned users and signing order. No automatic
signer assignment or activation of the unfinished PDF execution protocol.
Evidence: ../validation/EFORM_ENGINE_2026_10_03_CHANGE_RECORD.md.

## EFORM-PDF-2026-10-03 — Lock content before sequential EQMS signing

Owner approved the proposed workflow and `{{esign:Role}}` syntax in this conversation
("tôi đồng ý", followed by "Bạn làm đi, làm xong phải test lại").

- Configure placeholders against the pinned Effective template at Ready for Distribution.
- Every signing slot is assigned to an Active internal user; the first signer is the copy recipient.
- Saving assignments does not distribute the copy. Existing signed Distribute and email remain separate.
- Recipient fills DOCXF, explicitly confirms Save & Lock, and reviews the converted PDF before signing.
- Lock only after successful conversion, slot validation and persistent PDF storage. After lock,
  no DOCXF edits/callbacks or further data entry may modify that execution.
- All signing happens through EQMS credentials, never OnlyOffice Signature Field. Each successful
  step stamps the PDF, persists the signature/checksum/version and only then advances the chain.
- Last signature produces an Executed Record and invokes the existing automatic recall mechanism.
- Do not rewrite historic completed records or signatures. Owner explicitly approved retaining
  the old DOCXF workflow for in-progress runs: "Giữ luồng cũ cho bản đang chạy; bản bắt đầu mới
  dùng luồng PDF". Snapshot the protocol on each run; never derive it from mutable copy settings.
- Owner approved the HIGH-impact working-session guard change and regression testing:
  "Đồng ý sửa guard, giữ tương thích bản đang chạy".

Evidence: ../validation/EFORM_PDF_2026_10_03_CHANGE_RECORD.md.

## REVIEW-2026-10-02 — Optional review for newly created documents

Approved by owner in this conversation: "áp dụng cho các tài liệu tạo mới kể từ bây giờ".
Only new documents created after deployment use OPTIONAL; legacy records and their
future upgrades retain the existing Sub-Type snapshot policy. For new documents,
Reviewer is optional, Approver remains mandatory, and reviewer assignment determines
Draft -> Pending Review or Draft -> Pending Approval on Submit. The policy is
inherited by upgrades of those new documents. Existing role independence, scope,
signature and audit requirements remain. No reviewer-signature block is rendered
when this policy skips review; absent reviewer information displays "-".
Evidence: ../validation/OPTIONAL_REVIEW_2026_10_02_CHANGE_RECORD.md.

Follow-up owner decision: "Bây giờ sub-type chỉ đánh dấu phân loại tài liệu thôi,
không còn liên quan gì đến review nữa". Selecting/clearing Sub-Type never rewrites
the persisted document policy, including legacy documents. Sub-Type administration
can no longer configure Review; obsolete API write values are rejected. Legacy
document snapshots remain unchanged, consistent with the new-document-only cutoff.

## FORMS-2026-10-02 — Form execution workflow

Status: approved by project owner in the current development conversation ("đồng ý, làm đi").

- Form design/edit follows existing document/revision edit authorization; DCO assigns Author/Co-Author through the ordinary document workflow.
- New paper/eForm executions do not require another approval after submission. Existing pending executions and their resolution/signature/audit history are retained.
- Paper is issued as PDF through Controlled Copy; DCO checks returned paper before scanning/uploading.
- Electronic execution uses online filling. The final execution artefact must be an actual converted PDF, not renamed DOCXF bytes.
- Authors define structured OnlyOffice field roles. DCO scans the committed template of the copy's pinned Effective revision and maps those roles to users and signing order at Ready for Distribution. Ordinary title text is not a role declaration.
- The recipient fills and electronically signs Submit for Signature before any subsequent role can start. Subsequent signing is sequential and scoped to that Controlled Copy.
- Existing recall/Obsoleted mechanisms remain authoritative. Invalid copy/source lifecycle must reject subsequent eForm configuration, source-file, save callback and submit requests.

This is an approved product decision, not a statement of regulatory compliance. Validation status and runtime limitations: [change record](../validation/FORMS_2026_10_02_CHANGE_RECORD.md).

## FORM-EDITOR-2026-10-02 — Separate authoring artefacts

Owner approved: "mở hai bản riêng như hiện tại". The revision workspace exposes
DOCX content editing and DOCXF field design through the same standalone editor
page. These remain separate artefacts; changing the selected editor does not
convert or overwrite either artefact. Confirm switching the user's last selected
editor for that revision. Existing stale-template confirmation, document edit
authorization, Draft locks and signed template commit remain authoritative.
The DOCXF request must refer to the selected Draft revision, not another revision
of the same document. See ../validation/FORM_EDITOR_2026_10_02_CHANGE_RECORD.md.

Follow-up defect reported by owner: opening DOCXF stops at "Configure Form
Settings before designing eForm fields". Draft authoring is independent of the
paper/electronic execution opt-in configuration, consistent with FORMS-2026-10-02.
Remove only the configuration-existence prerequisite for DESIGN; do not create
settings implicitly or relax execution opt-in, edit permission, lifecycle,
checksum or signed-commit guards.

## EFORM-RETIRE-2026-10-03 — Paper-only Form execution

Owner explicitly approved removal of electronic Forms and FormSettings, invalidation of current
eForm sessions, preservation of data/files/audit, and retention of ordinary DOCX online editing,
paper Controlled Copies, scan/upload and electronic signatures for all other workflows.
This supersedes active eForm design/execution and separate DOCXF editor decisions above; historical
decisions and records remain. No file deletion, data purge or historical-copy reclassification is approved.
See ../validation/EFORM_RETIRE_2026_10_03_CHANGE_RECORD.md for implementation/test evidence.

## PUBLISHING-PARENT-FOOTER-2026-10-07 — Footer line of a related document (form, appendix)

Owner decisions (2026-10-07): the footer of a related document prints *Issue and append to the document "<parent document name>"/
code : <parent document number>*. It is made when the **revision is published** (publishing template), not when a controlled copy
is issued. A related document has **one** parent document ("chỉ có 1 tài liệu cha"); only relation type **RELATED** counts (not
CORRELATED); the code is the parent's **document number only, for example SOP.0002**, never with a revision number; name and
number are those of the parent at publish time.
Built: placeholders `{{parentDocumentLine}}`, `{{parentDocumentName}}`, `{{parentDocumentNumber}}` (aliases with underscores),
empty for a document with no parent so one template footer fits every document type. The parent of a document is the document
that lists it as RELATED. Assistant-proposed, pending QA: should data ever hold several parents, the lowest document number is
used so the result never depends on database order. A template must be edited to use the placeholder (no template is changed by
this decision). Evidence: ../validation/PUBLISHING_PARENT_FOOTER_2026_10_07_CHANGE_RECORD.md.

## MARKING-PREVIEW-BASE-2026-10-07 — PDF Markings are previewed on one sample paper

Owner decision (2026-10-07): the PDF Markings tab of the Controlled Copies Policy and of the Uncontrolled Copies Policy does not configure
marks on a page taken from a Publishing Template, and does not ask for a document either ("chỉ là cho 1 bản giấy mẫu là được, không cần
chọn cụ thể tài liệu"). Built as: one A4 sample page drawn by the server (the same for every document); the selectors "Preview on
template", "Paper layout", "Preview on document" (an intermediate version of this decision) and "Position for" are gone. Because there
is one page, a dragged stamp or watermark position is stored for the first page and for the following pages alike; the existing
"Pages" choice (every page / first page only) decides where each mark appears. Positions saved earlier with different values for page 1
and for page 2+ stay as saved (page 1 is what the preview shows) until the position is reset or dragged again.
**QR code "Pages" (owner, same day):** the QR code gets the same Pages choice: Every page (default) or First page only (V549,
qr_code_pages). Assistant note for QA: with First page only, loose pages scanned together cannot be sorted back into their copies (only
the first page carries a code); the screen says so.
Correction recorded for QA: a **controlled** copy is not just the effective PDF. When the revision has a publishing template, the copy
is re-rendered through it so that copy-specific placeholders ({{copyNo}}, {{issuedBy}}, {{date}}, {{distributionList}}) are filled, then
the marks are drawn (composeThroughTemplate). That composition was **not** removed or changed. Whether to retire it is a separate
decision: it would drop those footer placeholders and the admin-defined placeholder fields from controlled copies.
Evidence: ../validation/COPY_RECALL_SCAN_2026_10_06_CHANGE_RECORD.md (follow-up 2026-10-07).

## CC-EXPIRY-2026-10-07 — A controlled copy expires with its document; Expiry Duration limits only the e-mail link

Owner correction (2026-10-07): the expiry of a controlled copy depends only on its Document (for example SOP.0037 valid until 23/10/2027
gives a copy valid until the same date). The Expiry Duration setting of the Controlled Copies Policy was a misunderstanding of this: it is
only the validity of the download link in the distribution e-mail.
Built as: a new copy's expiry date is the Valid Until date of its effective revision (else of the document), valid through the end of that
day; a document without one gives a copy without an expiry; a request may ask for an earlier date, never a later one. The rules (document
type / department / Global Default, unchanged data) are now "Download Link Expiry": a guest (no eQMS session) opening the link after the
resolved duration, counted from distribution, is refused and told to ask the DCO for a new link; a user signed in to eQMS is not bound by it.
Assistant-proposed, pending QA: end-of-day reading of the Valid Until date (as the existing expiry check already does); signed-in
recipients exempt from the link limit; no stored data was changed, so copies already issued keep the expiry they were given, and copies not
yet distributed take the document's Valid Until when distributed. Open: there is no "send a new link" action yet, so an external recipient
whose link has expired cannot recover it by themselves; and whether the expiry of already-issued copies is to be aligned to their documents.
Evidence: ../validation/CC_EXPIRY_2026_10_07_CHANGE_RECORD.md.

## UC-VALIDITY-2026-10-07 — Uncontrolled copy validity: hours after distribution, or the document's Valid Until plus hours

Owner decision (2026-10-07), after the Controlled Copy expiry correction (CC-EXPIRY-2026-10-07): the validity of an Uncontrolled Copy
becomes a choice in the policy. Either the existing "hours after distribution" (the default, so nothing changes until an administrator
chooses otherwise), or the document's Valid Until date plus an extra number of hours, 0 by default for that choice ("27/10/2027 + 72
hours"). When a copy is requested the system works the date out and the request screen shows it exactly.
Built as: the Valid Until date counts through the whole of that day, then the hours are added (27/10/2027 + 72 hours ends at 23:59:59 on
30/10/2027; 0 hours = that day only). The revision's Valid Until is used before the document's. Hours: 1 to 8760 after distribution,
0 to 8760 from the document. Choosing the other basis in the screen resets the hours to that basis's default (72 / 0).
Assistant-proposed, pending QA: a document with no Valid Until date, or one whose date plus hours has already passed, cannot be requested
or distributed under the document basis (the request screen says why) rather than getting an unbounded or already-expired copy; the date is
worked out at request time for display and again at distribution, so if the document's Valid Until changes in between, the distribution
value counts. Copies already distributed keep the validity they were given. Evidence: ../validation/UC_VALIDITY_2026_10_07_CHANGE_RECORD.md.
