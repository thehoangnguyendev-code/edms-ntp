# Approved decisions

## REPORT-TEMPLATE-APPROVAL-2026-10-14 — Every report template version is approved before it runs; names follow a rule

Owner decision, given in this conversation (2026-10-14):

- **Creation flow:** a template is created as a draft. The author submits it for approval. A person who holds the approval permission
  approves it (electronic signature) or returns it to draft with a reason. Only an approved current version runs (manual runs, schedules,
  previews).
- **Separation:** the approver is not the author of the version and not the person who submitted it.
- **Changes:** every saved change returns the template to draft and needs approval again.
- **Retirement:** a template that is no longer used is disabled, never deleted. A template marked for GMP decisions cannot be deleted.
- **Name rule:** Report Administration keeps the rules that give template names (fixed parts and parts typed per template, with a
  separator). A template chooses a rule when it is created and its name is built from the rule.
- **Existing templates** return to draft and must pass the flow again before they run.

Owner answers (2026-10-14), on the assistant choices below:

- 1 (names): accepted.
- 2 (lifecycle): Draft -> Pending approval -> Active -> Inactive. Disabling is a change; enabling again goes back through Draft and approval.
- 3 (rejection): a rejection is signed electronically (meaning `REPORT_TEMPLATE_REJECTION`) and returns the version to Draft with its reason.
- 4 (rule changes): **option A**. A template keeps the name it has. A change to a rule applies only to templates created after it, and to a
  template whose typed values are changed later. A rule change does not rename existing templates and does not need re-approval.
- 5 (example rule): removed by V583 (it was not in use).
- 6 (schedules): to be tested by the administrator.

Assistant choices (the owner's answers above are recorded against them):

1. Permission `reports.definition.approve` ("Approve Report Template", renamed from `reports.definition.approve_gmp`); name-rule permission
   `reports.name_format.manage` ("Manage Report Name Formats").
2. Electronic signature meaning `REPORT_TEMPLATE_APPROVAL` ("Report Template Approved"), renamed from `REPORT_GMP_APPROVAL`.
3. The flow applies to every template, not only those marked for GMP decisions.
4. Rejection needs a reason and no signature; a rejected version returns to draft with its reason kept.
5. Changing a name rule does not rename existing templates; a rule change needs a reason and an audit record, not an electronic signature.
6. The seeded rule "EQMS report title" (fixed "EQMS", typed topic) is an example for testing, to be replaced or removed by the owner.
7. A schedule whose template is not approved is suspended with its own reason, `SUSPENDED_TEMPLATE_NOT_APPROVED`.

## REPORT-GMP-USE-APPROVAL-2026-10-14 — A report template for GMP decisions runs only after QA approval

Owner decision, given in this conversation (2026-10-14), confirming SDS-RP-001 section 18, item 4 (REPORT-OFFICIAL-VALIDATION-2026-10-14):

- **Choice at creation:** when a template is created (and at any later change, under the e-signature rule of REPORT-DEFINITION-SIGNATURE) the
  author can tick **"Use for GMP decisions"**.
- **Effect:** a template marked for GMP use **cannot run** (manual run, schedule, preview) until QA approves its **current** version. Any
  later change to the template makes the approval stale.
- **Approval:** by a user who holds the permission to approve GMP use; the approver must not be the author of the current version; the
  approval is signed electronically.
- **Retirement:** a GMP template that is no longer used is **disabled, never deleted**.

Assistant choices to confirm (not stated by the owner):

1. Permission code `reports.definition.approve_gmp`, name "Approve Report for GMP Use" (the owner asked for a name suited to the purpose; the
   code is the assistant's proposal). The admin ticks it for QA users when creating them.
2. Electronic signature meaning `REPORT_GMP_APPROVAL`, "Report Approved for GMP Use".
3. Approval does not change the definition version, so it cannot be used to hide a change.
4. The approver is the person who wrote the current version (recorded per version); a version with no recorded author cannot be approved.
5. Existing templates are **not** marked for GMP; no template was chosen for GMP use by the owner.

Still open: the text of the notice on each file ("Not confirmed for GMP decisions") is for QA to set (PLAN item 3.2). Schedules whose template
is not approved are suspended with the existing reason "authorization changed", which is imprecise; a separate reason is to be decided.

## REPORT-FILE-RETENTION-PERMANENT-2026-10-14 — Report files are kept permanently

Owner decision, given in this conversation (2026-10-14). It completes REPORT-FILE-RETENTION-2026-10-14, whose open item (the number of years) is closed by this entry:

- **What:** report output files are kept **permanently**. No report file expires by age. The legal hold rule still applies on top of this.
- **Consequence:** the expiry and purge path is not used for report files. The storage needed grows with every run and must be sized and backed up as part of the storage plan.
- **Why:** the owner's decision, consistent with the permanent retention already decided for backups (BR-2).

Follow-up (not built): the retention policy of the report definitions is set to permanent, and the "No period has been approved" text on the retention screen is updated. Storage sizing for permanent report files is a follow-up item.

## REPORT-NOTIFICATION-CHANNEL-2026-10-14 — Scheduled report notices go by in-app and email

Owner decision, given in this conversation (2026-10-14). It completes the open item of REPORT-DELIVERY-CHANNEL-2026-10-14:

- **Channels:** a recipient of a scheduled report is told in two places, **in the application** and **by email**.
- **Content of the email:** a notice and a link only. The file is never attached. Opening the link needs a login and the permission check described in REPORT-DELIVERY-CHANNEL-2026-10-14.
- **Record:** each notice is recorded in `report_delivery_attempts`, including failures.

Follow-up (not built): the in-app notice, the email template, the sending job and the attempt record are not built yet. Mail-server approval by IT and security is still needed before the email channel is switched on.

## REPORT-DELIVERY-CHANNEL-2026-10-14 — Scheduled reports reach recipients by notice and login, never by file attachment

Owner decision, given in this conversation (2026-10-14), confirming the recommendation in SDS-RP-001 section 18, item 1:

- **What:** a scheduled report is **not** sent as an email attachment. Recipients receive a notice inside the application; an email, if
  used, carries only a link. Opening the link needs a login and a fresh permission check, the same as downloading a file today. Each
  send is recorded in `report_delivery_attempts`.
- **Why:** an emailed file is an uncontrolled copy outside the system; access cannot be revoked and the copy cannot be recalled
  (EU GMP Annex 11, section 12). Where a file must leave the system, it goes through the Controlled Copy process.

Still open (not decided here): the e-mail channel and its content need IT and security approval. Nothing is built yet.

## REPORT-LEGAL-HOLD-2026-10-14 — Legal hold: applied by one person, released only by another, with an e-signature

Owner decision, given in this conversation (2026-10-14), confirming SDS-RP-001 section 18, item 2:

- **Apply:** a person with `reports.retention.manage`, with a mandatory reason.
- **Release:** must be a different person from the one who applied it, with an electronic signature whose meaning is "Legal hold released".
- **Status:** the hold is shown on the run history. It keeps blocking the purge of the file, as it does now.
- **Why:** releasing a hold allows the file to be deleted, and deletion cannot be undone (EU GMP Annex 11, sections 14 and 12).

Built 2026-10-14 (phase 2.1): a hold is placed or released from the run history, with the reason. Assistant choices to confirm (not stated by the owner): placing a hold needs no signature; a release needs the reason, a signature with meaning REPORT_LEGAL_HOLD_RELEASE (V579), and a person other than the one who placed it. Who placed a hold is read from the run events of the file; a release is refused when that person is unknown. Placing or releasing a hold that is already in that state is refused.

## REPORT-DEFINITION-SIGNATURE-2026-10-14 — Electronic signature for changes that alter report results or access

Owner decision, given in this conversation (2026-10-14), confirming SDS-RP-001 section 18, item 3:

- **Signature required** for changes to a report definition that alter its results or who may see data: adding or removing fields,
  filters, role data scopes, formats, the retention policy, and switching a definition on or off.
- **Signature not required** for display name and description.
- **Meaning of the signature:** "Report definition change".
- **Why:** these are changes to the change control of a computerised system and to data access (EU GMP Annex 11, sections 10 and 14). This
  matches the Backup Policy, which already requires a signature.

Built 2026-10-14 (phase 2.2): a save that changes formats, fields, role scopes or activation needs a signature with meaning REPORT_DEFINITION_CHANGE (V579), checked before any write and recorded after the save. Assistant choices to confirm (not stated by the owner): creating a new definition also counts as a change that needs a signature; name, description and layout do not; a save without a service for signatures is refused rather than allowed.

## REPORT-OFFICIAL-VALIDATION-2026-10-14 — "Official" reports: scope first, then validation before use for GMP decisions

Owner decision, given in this conversation (2026-10-14), confirming SDS-RP-001 section 18, item 4:

- **Not built now.** The first step is to list which reports are used for GMP decisions. That scope is not yet defined.
- **For those reports, when built:** a definition carries a "Confirmed" status tied to one version; the confirmer must differ from the
  author; only the confirmed version can be run; a change to the definition removes the confirmation. Runs already record
  `definition_version`.
- **Until then:** every report file states "Not confirmed for GMP decisions" so nobody mistakes it for a validated output.
  This notice is a follow-up item and is not yet in the output.

## REPORT-TEST-TEMPLATES-2026-10-14 — Test report templates are removed from production; DEV only

Owner decision, given in this conversation (2026-10-14), confirming SDS-RP-001 section 18, item 5:

- **What:** the three `TEST_` templates seeded by V533 are removed from the production path. V533 is not edited; a new migration marks them
  soft-deleted (`deleted_at`), which keeps the history.
- **DEV:** the test templates are loaded on DEV only, through a separate configuration, not through the shared migration path.
- **Why:** test output in the real catalogue could be run and look like an official record (EU GMP Annex 11, section 4: validation and
  production environments kept apart).

Follow-up: the new migration and the DEV-only loader are not written yet.

## REPORT-FILE-RETENTION-2026-10-14 — Report files follow the retention of the records they summarise

Owner decision, given in this conversation (2026-10-14), confirming SDS-RP-001 section 18, item 6:

- **Principle:** no separate number of days for report files. A file is a derived copy, so it is kept at least as long as the source
  records it summarises, under the record retention schedule approved by QA. A legal hold always overrides expiry.
- **Format:** archive copies use PDF/A. CSV and XLSX are not used for long-term storage.
- **Why:** EU GMP Annex 11, section 17 (archiving: data stays readable for the whole retention period).

Update 2026-10-14: the number of years is closed by REPORT-FILE-RETENTION-PERMANENT-2026-10-14 (permanent). Earlier open point: a check that the
current PDF renderer produces PDF/A is a follow-up item.

## REPORT-ANALYTICS-PRODUCTION-2026-10-14 — Analytics screens hidden from production until real data exists

Owner decision, given in this conversation (2026-10-14), confirming SDS-RP-001 section 18, item 7:

- **What:** the three analytics screens (Reports Overview, Quality Analytics, Run detail) are hidden from the menu in production behind
  a feature flag that is off by default. They stay available on DEV.
- **Data later:** when built, figures are aggregated on the server from the same Document Register source, and must be reproducible.
- **Why:** sample figures could be read as real figures (EU GMP Annex 11, section 6: accuracy of data).

Still open: when real analytics are built is a business priority, set by the project owner. Not decided here.

## REPORT-SCHEDULE-OWNER-2026-10-14 — Schedules keep the creator's authority, with a named owner and a notice on suspension

Owner decision, given in this conversation (2026-10-14), confirming SDS-RP-001 section 18, item 8:

- **Kept:** the schedule runs with the creator's permissions at run time, and suspends itself when those permissions are lost.
- **Added:** each schedule has a named owner. Handing it to someone else needs a reason and an audit record.
- **Added:** when a schedule is suspended, its owner and the report administrator are told. No notice exists today.
- **Why:** this is the least-privilege model and it is traceable. A silent stop is not acceptable (EU GMP Annex 11, sections 9 and 16).

Follow-up: the owner field, the handover, and the suspension notice are not built yet.

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

## UNCONTROLLED-COPY-REQUEST-DCO-2026-10-16 — Request Uncontrolled Copy granted to DCO

Reported in conversation (2026-10-16): the "Request Uncontrolled Copy" button on a Document's
detail page did not show for the `dco.test1` test account. Root cause confirmed by reading
`DetailDocumentView.tsx` (the button requires `documents.uncontrolled_copy.request`, an EFFECTIVE
revision, and a non-template document, then a server-side context check) and every migration that
ever referenced the permission: `documents.uncontrolled_copy.request` was created in V499 with a
SoD constraint (V502) and dependency rows (V511), but had never been granted to any permission
set, including the real (non-test) DCO set.

- Owner (2026-10-16): "cấp cho DCO trước đi" (grant to DCO first).
- V600 grants it to the three sets read as "DCO" by code, the same reading used in
  DOC-VISIBILITY-2026-10-06/V542: `PS_DCO_TEST`, `PS_DOCUMENT_DCO`, `PS_UAT_DOCUMENT_DCO`.
  Administrator/`SYSTEM_ADMINISTRATION` and the legacy `ROLE_*` sets are intentionally left out.
- **Open:** whether Author (or another role) should also get this permission was not asked; only
  DCO was granted. The 8 sets noted as "Open" in DOC-VISIBILITY-2026-10-06 (Approver, Quality,
  Contributor and DCO-named sets holding `documents.uncontrolled_copy.view_all` alone) are
  unaffected by this change.

## UNCONTROLLED-COPY-ALL-TYPES-2026-10-16 — Uncontrolled copies for every document type

Owner (2026-10-16): the "Allow Uncontrolled Copy" rule per document type no longer applies; any
document can be requested, the same as a Controlled Copy. The per-type flag had already been removed
(V503), but the eligibility rule matrix remained and the live database had only the default rule.

- Owner chose option 2: keep the eligibility matrix as the single default switch, default allows every
  document type, and no per-document-type rule is kept (V603). The matrix's rule editing is not removed
  by this change.
- Requesting still needs `documents.uncontrolled_copy.request`, an Active document with an Effective
  revision, a non-template document and a valid validity window (unchanged).
- **Open:** whether the matrix editing screen should be removed entirely (option 1) was not decided.

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

## CC-PURPOSE-2026-10-07 — Usage purpose of a controlled copy: read-and-comply or record-keeping (decided, not built)

Owner decisions (2026-10-07):
- A controlled copy is issued for one of two purposes, **read and comply** or **record-keeping**, for **all documents**. On the request screen the DCO ticks
  **exactly one of the two**. It is recorded in the **audit trail**, shown in the **detail**, and the tables get a **Purpose column and a filter**; the two
  Controlled Copies sub-tabs (document detail, document creation) get the column too.
- A read-and-comply copy is recalled **without a scan** (the DCO enters the Recall Date and the reason); a record-keeping copy is recalled by scan and its scan
  becomes a Record. The **Records menu and tab show no scan of a read-and-comply copy**.
- If the DCO uses Recall by Scan for a read-and-comply copy anyway, it is **recalled normally, no Record is made, and the review list says so before signing**
  (the alternative, blocking it, was considered and not chosen).
- A wrong purpose is corrected by **recalling the copy and requesting again** (or cancelling the request if it was not yet distributed); the purpose is not edited.
- **Copies issued before the change are left alone**: not classified, shown with an empty Purpose, recalled as today, their existing Records still shown.
- The **destruction of recalled paper (SOP.0015) stays outside the software**: no destruction round, no witness and no destruction record are built.
Plan for the customer: ../../../docs/plans/KE_HOACH_MUC_DICH_SU_DUNG_BAN_SAO_KIEM_SOAT.md. Technical design: ../validation/CC_USAGE_PURPOSE_2026_10_07_DESIGN.md.

### CC-PURPOSE-2026-10-07 amendment (owner, 2026-10-07)
Recall by Scan: read-only (READ_AND_COMPLY) copies found in a scan are set apart and removed by the DCO with one click; they are not recalled by scan and make no Record. Their recall stays a manual action from Controlled Copies.

## REPORT-TEMPLATE-NUMBER-2026-10-14 — A report template's number is issued by the system

- Owner request (2026-10-14): rename "Template Code" to "Template Number"; users must not type it; build a rule that numbers templates, following the Document Number mechanism.
- Assistant choice, **confirmed by the owner on 2026-10-14**: format `<prefix>.<serial>` (default `RPT.0001`), prefix and serial digits configurable in Report Administration, serial only moves forward, one rule for all templates, existing numbers unchanged.
- Closed by the owner's confirmation: the format stays `<prefix>.<serial>` and a number is never re-used.
- Change record: `validation/REPORT_GMP_DECISIONS_2026_10_14_CHANGE_RECORD.md`, section "Template Number issued by the system".

## REPORT-TEMPLATE-REVISION-2026-10-14 — Report templates are managed in revisions

- Owner request (2026-10-14): report templates lack version management; do as Document does (Revision).
- Assistant choices, **to confirm** by QA/owner: numbered revisions (Draft, Pending Approval, Effective, Superseded); the effective revision keeps running while a newer one is drafted and approved; approval stays signed and independent of the author; disabling is immediate, enabling goes through approval; released revisions keep their whole content and can be compared.
- Owner decision (2026-10-14): a new revision is started explicitly with "Upgrade Report Template"; the replaced revision is Obsoleted and stays viewable. Closed: explicit start.
- Open: whether runs of an obsoleted revision should be flagged on the report; retention of draft revisions that are never approved.
- Change record: `validation/REPORT_GMP_DECISIONS_2026_10_14_CHANGE_RECORD.md`, section "Revisions of a report template".

- Owner decision (2026-10-14, REPORT-TEMPLATE-REVISION): Disable needs only a confirmation modal and the audit trail. Assistant reading, **to confirm**: Enable works the same way. Revision function completed: Discard Revision, compare with any revision, SDS-RP-001 section 5.5.

## REPORT-COMPANY-APPEARANCE-2026-10-15 — One company appearance for every report

- Owner direction (2026-10-15): every report uses one company appearance. The look of a report (cover, header, footer, page numbers, font, stamp, watermark, logo, paper layout, Word page templates) is set once in Report Properties > Report Appearance; a report template keeps only its charts.
- Built (DEV): `report_properties.appearance` (V592); the run snapshot pins the company appearance with the template's charts, so a report already made keeps the look it was made with; saving needs `reports.properties.manage`, checks the version, and the Audit Trail names the parts changed.
- Assistant-proposed, **to confirm**: templates that held their own appearance now use the company one from their next run (their stored layout is ignored, not deleted); a stamp opacity below 30 is refused as in the Controlled Copies Policy; the stamp is a framed box laid out as the Controlled Copy stamp (REPORT-STAMP).
- Open: change record not yet written; no real run checked in a browser.

## REPORT-PLATFORM-2026-10-15 — Report Types, more sources, permission-based authoring (design, not built)

- Owner (2026-10-15): sources in this order: Document Control, Audit Trail, Backup & Restore; a user may create report templates when the Access Profile allows it, not only an administrator.
- Assistant-proposed, **to confirm** by QA/owner: code-defined Report Types enabled/disabled in administration; source permission required in addition to the template scope; Audit Trail source SYSTEM-scoped and export gated by `audit.export`; new permission `reports.template.create`.
- Owner answers (2026-10-15): non-GMP templates are approved by signature too; a person with `reports.definition.manage` sees and edits others' templates; Backup & Restore data location not known yet (Phase 3); the Audit Trail report has a mandatory, bounded date range. Assistant correction, **to confirm**: authoring is already by permission, so no new authoring permission is built.
- Open questions Q1 to Q4 are in the design: `../validation/REPORT_PLATFORM_2026_10_15_DESIGN.md`.

### REPORT-PLATFORM-2026-10-15 — phase 1 built on DEV (Report Types)

- Built (DEV, not committed): Report Types registry (`ReportTypeService`, `/reports/types`, V593 `report_types`); the provider contract gained category, description and the permissions a type needs; a disabled or not permitted type is refused when a template is created or changed and when a run starts, and a schedule of such a template is suspended as "template disabled"; screen **Report Types** (list with server-side search, filter, sort and paging, expandable row, detail page, Enable/Disable with reason and Audit Trail); permissions `reports.types.view` and `reports.types.manage`, granted to nobody by the migration (DEV test set updated by `validation/DEV_TEST_REPORT_TYPES_2026_10_15.sql`).
- Not yet built in phase 1: the simplified create stepper (Report Type, columns and filters, name and charts, access). Phases 2 to 4 not started. Change record not yet written.

### REPORT-PLATFORM-2026-10-15 — phase 2 built on DEV (Audit Trail as a Report Type)

- Built (DEV, not committed): Report Type `AUDIT_TRAIL` (`AuditTrailReportMetadataProvider`): the columns the Audit Trail screen shows (timestamp, module, action, record, from/to status, description, reason, user, employee code, department, IP address, electronic signature); old/new values, user agent and device are not columns. A person needs **both** `audit.view` and `audit.export` (checked when a template is created or changed, when a run starts, when it is rendered and when its file is downloaded again). The type can be given only the **SYSTEM** scope (refused when a template is saved, and again by the query). A run must name **From and To dates, in order, at most 92 days** (counted with both days). The contract gained `requiredPermissions`, `allowedScopes` and `validateRun`.
- Assistant-proposed, **to confirm** (QA/owner): the 92-day limit; that both audit.view and audit.export are needed; SYSTEM scope only.
- Open: the Audit Trail screen's own export needs an electronic signature and a reason at the time of export; a report run does not, and relies on the signed approval of the template and the audit entry of the run. QA to decide whether that is acceptable or a run of this type must also be signed. A schedule keeps the dates it was given, so a scheduled Audit Trail report repeats the same range until a relative range (for example "last 30 days") is built. Change record not yet written.

## TRAINING-PLAN-2026-10-15 — Training Management and its link with Document Control (plan, nothing built)

Plan: `../../../docs/to-be-sds/training/PLAN-TR-001-training-management.md` (0.3), written from SOP.0003.02 and its nine forms (`docs/training_docs/`). The Training screens now in `eqms/src/features/training/` and `.../settings/training-administration/` are the owner's trial UI and are not a basis for the design.

Owner decisions (2026-10-15):
- A Training Number is issued **to a revision**, not to a document (an upgrade may mean new training). In the Training Information tab it is read-only and appears only after a successful save.
- Un-ticking Requires Training on a revision that already has a number shows a confirmation; the number is cancelled when the user saves again. A cancelled number is never reused.
- An upgraded revision keeps Requires Training; how the training is given is set in the Training module.
- Not needing training = the user does not tick Requires Training; no reason categories.
- Completing training still needs the electronic signature of the present flow; it does not advance the revision by itself.
- The effective date of a document follows the settings already in Document Properties (separate rules for documents with and without Required Training).

Assistant proposals, **to confirm**: legacy-imported documents get no training number or activity (marked LEGACY_IMPORT, listed as read-only evidence; "Training not evidenced" when the date is missing); a failed save rolls back and never falls back to manual dates; a deliberate switch-off of the integration is a controlled setting and each revision records `INTEGRATED` or `MANUAL` at its first save; the training completion date of a revision is the date QA confirms the original activity, absentees (codes a, b, c) do not hold up publishing but are shown as untrained.
Open: the 22 questions of the plan, section 13 (D-01 to D-22, D-31).

### TRAINING-PLAN-2026-10-15 — owner agreement and detailed design

- Owner (2026-10-15): agreed the three assistant proposals — legacy-imported documents get no training number or activity (marked LEGACY_IMPORT, listed as read-only evidence); a failed save rolls back and never falls back to manual dates, a deliberate switch-off is a controlled setting and each revision records INTEGRATED or MANUAL at its first save; the training completion date of a revision is the date QA confirms the original activity (absentees, codes a, b, c, do not hold up publishing but are shown as untrained). These three are now owner decisions, not "to confirm".
- Detailed design written, not built: `../../../docs/to-be-sds/training/SDS-TR-001-training-management-design.md` (database, API, permissions, signatures, audit, front end, security, validation, work packages WP-0 to WP-10). Security, data integrity and EU-GMP come before convenience and speed (design section 1.4).
- Correction of an earlier statement: the `positions` table exists (V3); what is missing is the link from a user to a position. The `departments.code` column exists and is used as the DC part of the training number.
- Assistant choices in the design, **to confirm**: permission catalogue `training.*`; electronic-signature meanings `TRAINING_*`; immutability triggers on training records; paper evidence kept as scans with a receiver's confirmation; open questions D-01 to D-22 are listed in design section 16.

### TRAINING-PLAN-2026-10-16 — flow chart read, four open questions closed

- Owner (2026-10-16): D-01 the flow chart of SOP.0003 section 5.2 is the attached image (kept at `docs/training_docs/SOP.0003.02 Flowchart (muc 5.2).png`, read in PLAN-TR-001 section 5.0). D-02 the training matrix is **Training data**, not a Document Control document, because many trainings do not come from a document. D-05 a matrix is approved by **a person holding the matching permission**, no fixed role or number of levels; the approver is not the preparer; same for the QA matrix. D-20 **both** electronic signature and paper signature with a scanned original are supported.
- Assistant, **to confirm**: two differences between the flow chart and the text of the SOP — content approval (chart: "Departments, QM"; text 5.3.5: head of the department and head of QA) is built as two steps, department review then approval by whoever holds `training.content.approve` (D-32); a transfer (chart: transfer leads to initial training) creates an INITIAL training activity with reason TRANSFER after a person with permission confirms the topic list (D-33). The personal training record is still created when an activity is completed, not after the job assignment (chart puts "Training record" last).

### TRAINING-PLAN-2026-10-16 (b) — owner delegates the open questions; approvals are permission-based

- Owner (2026-10-16): "propose them yourself"; **every step that reviews, approves or confirms must be designed as permission-based, so that the owner can designate any user for it.**
- Built into the design (not built in code): each such step needs a permission granted through an Access Profile; the person who submits **designates** the handler among the users who are eligible (active, hold the permission on the department, not the preparer); a step can be set to "designated required" (default) or "any eligible"; the handler must still hold the permission when signing; a handler can be re-assigned with a reason; nothing is tied to a role name or an account. Tables `training_approval_assignments`, `training_default_approvers`; permissions `training.approval.designate` and `.reassign`, `training.content.review`, `training.trainer.exception.approve`, `training.job_assignment.exception.approve`. Design: SDS-TR-001 section 8.5.
- Assistant proposals accepted by that delegation, **QA to confirm**: D-03 optional Document Level attribute used only as a hint; D-04 name match with an "unmapped" report, never guessed; D-06 hybrid assessed like classroom; D-07 suffix aa, ab after z; D-08 organising is a department-scoped permission; D-09 absent with a reason category, not counted as trained; D-10 unqualified trainer blocked, exception approved by a designated holder of a permission; D-11 10 days is a warning; D-12 failed assessment raises a flag only; D-13 no on-screen tests; D-14 own non-working-day table; D-15 job assignment blocked until the matrix is complete, exception by designated approver; D-16 specimen signature kept as a scan; D-17 no automatic destruction; D-18 only a signed copy of the record for a site transfer; D-19 old permissions kept and mapped; D-21 visitors without account, no personal record; D-22 English labels, bilingual printed forms; D-32 content review then approve, both by designated permission holders (QA should align the SOP and the flow chart); D-33 a permitted person confirms the topic list, then creates the INITIAL activity for a transfer.

### TRAINING-PLAN-2026-10-16 (c) — plan and design accepted for implementation

- Owner (2026-10-16): accepted the assistant's proposals; PLAN-TR-001 and SDS-TR-001 are now version 1.0, "accepted by the owner to start implementation; QA to confirm the decisions". No question blocks WP-0.
- Next step defined: WP-0 (SDS-TR-001 section 15.1): URS, risk and data-integrity assessment, test strategy, a read-only baseline data report on DEV, infrastructure check, plan to remove the trial UI, GitNexus impact for the Document Control symbols to be changed. WP-0 changes no schema and no function. Work packages WP-1 onward need the owner's go after WP-0 is reviewed.
- QA tasks recorded in PLAN-TR-001 section 13.2 (confirm the delegated decisions by name, align SOP.0003 with its flow chart on content approval, check the EU-GMP/Annex 11 clause numbers, sign URS and risk assessment, update SOP and forms for use with the software, supply UAT people and the release approver).

### TRAINING-WP0-2026-10-16 — work package WP-0 delivered (documents and read-only data only)

- Owner (2026-10-16): "go ahead". WP-0 produced the URS, the risk and data-integrity assessment, the test strategy with traceability, a read-only DEV data baseline, an infrastructure check with the plan to remove the trial UI, and the GitNexus impact analysis. No code, schema or configuration changed. Evidence: `../validation/TRAINING_WP0_2026_10_16_CHANGE_RECORD.md`.
- New assistant proposals from the data baseline, **to confirm by QA**: D-35 (a number may be issued by the department of the document even if that department is inactive; an inactive department cannot be chosen as organizer of a new activity); D-36 (only Active users with an employee code can be trained or listed; 432 of 465 Active DEV accounts have none and are test or load accounts); D-37 (revisions already past Pending Training get no retroactive number; SOP.0017, now in Pending Training, stays MANUAL).
- Warning recorded for the owner: `DocumentRevisionRecord` (107 affected) and the screens `NewDocumentView`, `TrainingTab`, `RevisionTrainingView` are CRITICAL in the impact analysis; WP-5 will be done as small, additive, conditional slices with the full Document Control regression run before and after each.
- Pending: QA review and signature of the URS, risk assessment and test strategy; the owner's go for WP-1.

## DOCUMENT-EXPIRY-2026-10-16 — Expired documents: block requests, notify, void electronic copies

Owner decisions (2026-10-16), replying to the gap "an Active, Effective document past its Valid Until
can still be copied":

- Request Controlled Copy and Request Uncontrolled Copy stay visible for users who can see the document.
  When the document's Valid Until has passed, clicking either button shows a modal that explains why
  and does not submit the request. The server must also refuse the request (defence in depth).
- Notify **all users** of the system by **both** email and in-app notification. The email may give a
  longer description than the in-app message.
- Expired document: its electronic copies are voided and the holders of those copies are notified.
  Paper copies are not voided electronically; the DCO recalls them physically.

Assistant findings that the owner should know (not decided here):

- Current behaviour, before this change: Controlled Copy request buttons show when the user holds
  `documents.controlled_copy.request` and the document is Active with an Effective revision. Validity is
  **not** checked at request time; `ControlledCopyService` refuses only at distribution. Uncontrolled
  Copy checks validity at request time and hides the button.
- Open for QA: how "all users" is defined (every active account, or only accounts with some document
  permission), and whether the daily job or the moment of expiry triggers the notification.

### DOCUMENT-EXPIRY-2026-10-16 (b) — owner choices for implementation

- Owner (2026-10-16): **option B**: the expiry processing applies only to documents that expire from go-live onward. Documents already past their Valid Until at go-live are not processed automatically; they are listed to the DCO for review.
- Expiry instant: **start of the Valid Until day** (matches how controlled copy expiry is already computed).
- Notification language: **both Vietnamese and English**; the email may be longer than the in-app message.
- Recipients: every Active user account (email and in-app), plus the recipients of electronic copies of the document, who are also told to expect physical recall.


## TRAINING-HYBRID-2026-10-18 — Software supports the SOP; the manual part stays manual and is recorded

Owner instruction in the session (2026-10-18): the software only supports the procedure and is not 100% of it; the proposed solution must combine software and manual steps as the SOP describes. Chosen by the assistant under that instruction, **not approved by QA**:

| Item | Software does | People do |
|---|---|---|
| APD.0009 footer (TR-52) | Prints a copy of the approved PDF exam for each trainee with a cover page and a footer (Training Number, trainee name, signature line); keeps the approved file unchanged; numbers and records each print. | Sign the pages, mark, send the result for transcription. For a DOCX exam: set the footer in the document and print from Word. |
| Attendance list to QA on the day (TR-36) | Shows the day, reminds in the morning and weekly when late, records a late sending. Does not block. | Send the list to QA. |
| Absence over six months, transfers, new employee (TR-32, TR-34, TR-45) | Holds the SOP checklist, links the trainings organised, closes with a signature of a person other than the employee. | Detect the event, open the review, do each item. |
| Approved vendor list (SOP.0025) | Shows a warning when an external training has no vendor reference. | Check the approved vendor list. |

Open for QA: whether a closed review may replace the manual record of the item; whether a late list to QA needs a reason; the wording of the checklist items.

## TRAINING-FLEXIBLE-PAPER-2026-10-17 — Training Management is a supporting tool: SOP values are defaults, paper is a valid path

Design documents: `../../../docs/to-be-sds/training/PLAN-TR-001-training-management.md` section 17 and `SDS-TR-001-training-management-design.md` section 18.

**Owner decision, given in this conversation (2026-10-17):**

- The software is a tool that supports the training procedure; it does not replace it entirely. Staff in the workshop and the clean rooms often have no device, so training may be run on paper or in one meeting room, and the software must work for both.
- SOP.0003 values are **defaults, not blocks**: the screen suggests the SOP value, an authorised person may choose another, and the choice is recorded. Implemented for the way of assessment of a session (SOP.0003 5.1.2).
- What stays strict: electronic signatures with meaning, Audit Trail, no edit or delete of a closed record, segregation of duties, server-side permission and scope checks, server-side calculation of the pass result.

**Already built and in use on DEV (recorded for traceability):** a person may be removed from the attendee list only before the list is confirmed and before anything is recorded for the person, with the name and the reason in the Audit Trail; after that the person is marked absent. External persons may be added several at a time. An exam or an answer key accepts only PDF or DOCX; PDF is previewed with the project PDF viewer and DOCX with the read-only OnlyOffice viewer, nothing is converted.

**Proposals — NOT approved; each needs a named decision by the owner or QA before it is relied on** (numbers are those of PLAN-TR-001 17.7, 17.10 and 17.11):

| # | Proposal |
|---|---|
| D-39 | A session has a delivery mode: electronic, paper or mixed; changing it is recorded with a reason. |
| D-40 | A paper pack carries the Training Number on every page, a pack code, page numbers, a print counter; a reprint needs a reason. |
| D-42 | Practical training may be assessed by "Observation of actual operations", recorded with the APD.0009 checklist (case TH2); same score and 70% threshold. **Built on DEV on 2026-10-17 as an option; QA to confirm.** |
| D-43 | External training: unit or individual that trains is mandatory; no method, no assessment, no review of content; certificate as scanned evidence; record result `ATTENDED` when there is no score. **Built on DEV on 2026-10-17; QA to confirm.** |
| D-45 | Signatories of a document get the initial training record of that document automatically. |
| D-46 | A preparation checklist per session (venue, equipment, informing trainees) with a notice to the unit that has to act; it warns, it does not block. |
| D-47 | A log of copies sent to and received by the managing units. |
| D-48 | Personal training records can be exported in a batch by department and year, prepared and approved by two different people. |
| D-49 | No offline or PWA application at this stage; paper is the fallback. |
| D-51 | Results may be transcribed from paper: the scan is mandatory, a second person verifies with an electronic signature, and a late entry (after one working day) needs a reason. |
| D-52 | Two specimen signature images per version (FRM.0007 "1st" and "2nd" signature). |
| D-53 | Where the qualification and the date of joining of an employee are kept (needed by APD.0014). |
| D-54 | A position group "Management Personnel" in the matrix (APD.0011 note). |
| D-55 to D-58 | Matrix completion grid by position: every cell is calculated on the server from the personal training records, never typed; states Not required, Required, In progress, Qualified, Update needed, Due; labels may be changed by QA. |

**Open for QA (not decided):** how a training on a document version is recognised as needing "Update needed"; whether the result `ATTENDED` is acceptable on a personal training record for an external training; the evidence QA accepts as proof of an external training.

- 2026-10-19, owner instruction ("làm đi"), **QA to confirm**: D-10 revised. A trainer is qualified on a topic when trained on it, involved in its document, or holds the permission `training.trainer.qualified` that QA grants (Permission Set `TRAINING_TRAINER_QUALIFIED`, V627); GMP training is still required. Heading the organising department no longer qualifies by itself. Effect: a planned session whose trainer relied on that rule needs the permission or a trainer exception.

- 2026-10-20, owner instruction, **QA to confirm**: attendance by self check-in (V629) and list rules. (a) A trainee confirms attendance by entering or scanning the code shown by the trainer, while signed in; there is **no second electronic signature** (the session identifies the person, the code proves the room, the row carries sign mode SELF and the Audit Trail records who and when). The quick roll-call by the trainer keeps its signature and the mark TRAINER_ATTESTED. (b) The attendee list is not changed once it is confirmed: a person who comes without being on it is trained in a make-up or in a new unplanned training (SOP.0003 5.3.4 and 5.3.7, which do not say how to treat a person outside the list). (c) An attendance recorded by mistake is corrected with a reason and no signature; the old and new values and the reason stay in the Audit Trail; not possible after the person has a score.

- 2026-10-20, owner instruction, **QA to confirm**: assessment forms (APD.0009) in Training. The Word source is loaded by hand in Training Properties and made current with an electronic signature of a person who administers Training (no link to the Effective revision in Document Control, so the two copies must be kept the same by the people who maintain them). The person who prepares an activity starts from it and edits the exam template and the answer key in OnlyOffice; only before the content is sent to review. A test or a checklist may also be done on paper or in a filled Word file and uploaded as evidence with an optional note of the form version. A Word exam is converted to PDF for the paper print and the three fingerprints are recorded.

- 2026-10-21, owner instruction, **QA to confirm**: D-14 (working days = Monday to Friday minus a calendar of days off) is withdrawn. SOP.0003 uses working days once (results to QA within 7 working days, 5.3.8) and does not define them; the software no longer keeps a calendar of non-working days or a setting for that deadline, and the 7-day deadline is followed by people as the SOP says. A result typed from paper more than one calendar day after the session needs a reason (not a block).

## ESIGNATURE-DISPLAY-STYLES-2026-10-26 — Three display styles of a signed electronic signature in documents

- 2026-10-26, owner request, **QA to confirm**: a Word template can ask for a signature in one of three styles by the name of the placeholder: `{{approvedSignatureCompact}}`, `{{approvedSignatureStandard}}`, `{{approvedSignatureDetailed}}` (also `preparedSignature`, `reviewedSignature`, `publishedSignature`, `reviewerSignatureN`, `approverSignatureN`, `reviewerSignatures`, `approverSignatures` with the same endings). A placeholder with no ending keeps the full block it always had, so no existing template or released document changes.
- All three are drawn from the same electronic signature record, never from a copy. Each writes what 21 CFR 11.50 requires of a signed record: the printed name of the signer, the date and time of the signing, and the meaning of the signature. The reason, the e-signature ID and the rest stay on the record and in the Audit Trail whichever style a document uses (11.70 links the signature to the record by the record, not by the printed text).
- A signature that is not signed (pending, rejected) or that lacks the name, the time or the meaning is written in full, never shortened.
- **To confirm by QA:** owner decision 2026-10-26: all three styles write the time to the minute (dd/MM/yyyy HH:mm (UTC+07)); the signature record keeps the second. If QA wants the second in a style, it is one format change.
- **Not done:** documents already released are not re-drawn; no template of the system uses the new placeholders yet; not checked on a real DOCX/PDF output in Word (only unit tests of the text and of the placeholder names).

## TRAINING-SETTINGS-AUDIT-WITHOUT-REASON-2026-10-27

- 2026-10-27, user instruction in this task: save Training Properties after a confirmation without requiring a reason. Record the actor, time and each changed setting's previous and new value in the Audit Trail. The requester did not identify a named QA approver; QA assessment of the change remains pending. This instruction does not establish GMP compliance.
- Applies only to Training Properties updates. The existing permission, optimistic version check, validation and transactional audit remain in force. Existing API clients may still supply a reason, which remains in the audit comment; historical entries are unchanged.

## TRAINING-OPEN-DECISIONS-2026-10-28

- 2026-10-28, owner answers to the open items of the Training module (the requester did not identify a named QA approver; QA confirmation remains pending; this does not establish GMP compliance).
- **Trainer qualification (SOP.0003 5.1, requirements for the trainer):** the record "Trainer" written when a person gave a training is not counted as proof that the same person was trained on the topic or in GMP. It still counts for the matrix and for the personal training record. Applied in `TrainingTrainerService` (both checks leave out records with the result TRAINER).
- **Late sending to QA (SOP.0003 5.3.6 same day for new or revised documents; 5.3.7 within 7 working days):** unchanged. The system warns, marks the state OVERDUE and records the reason for the delay; it does not block.
- **Form APD.0011 export:** the export keeps following the template that Training Administration enabled (its footer and page setup). The template APD.0011.02 itself is portrait A4 with an empty footer; a landscape page needs a landscape template and a table width that follows the page (the width is fixed in `TrainingMatrixFormService.GRID`). Not changed. To confirm by the owner whether a landscape page is wanted.
- **Not done:** Materials Board on the Assessment and Approvers tabs: the Approvers tab lists people and signing steps, the evidence list of the Assessment tab is an audit table (who checked the scan against the paper); neither is a list of materials. Both already use the shared table with the numbered column and the three-dots menu. To confirm by the owner.
- 2026-10-28 (follow-up, same owner): the form APD.0011 stays **portrait A4**, as the template APD.0011.02 is; no landscape page is built. The Approvers tab and the evidence list of the Assessment tab stay as they are (shared table, numbered column, three-dots menu); the Materials Board is not applied to them. Both items above are closed.
- 2026-10-28 (follow-up, same owner): the calendar of non-working days stays removed (V633). The days to send the results to QA are still counted by the chosen type (Monday to Friday, Monday to Saturday, or every day); a public holiday counts as a working day. Closed.

## TRAINING-FORMS-FROM-DOCUMENT-CONTROL-2026-10-28

- 2026-10-28, owner (who is QA) decisions; no other named QA approver; this does not establish GMP compliance. Training forms (APD, FRM) are taken from the documents of Document Control instead of being only uploaded by hand.
- **D-FORM-1, enabling:** when a revision of a linked document becomes Effective, its Word file is taken as a template version and **enabled automatically, without a second signature** (the approval was given in Document Control), after a check of the structure the fillers need. A file that fails the check is kept out and the reason is recorded.
- **D-FORM-2, from when:** the new template is used **as soon as the revision is Effective** (not from a later effective date of the revision).
- **D-FORM-3, version on every form:** a form made for an activity, a session, a requirement, a job assignment or a matrix version **keeps the template it was first made with**; each form made is recorded with the template used. A preview records nothing. The living lists (personal record APD.0014, specimen list FRM.0007, number log FRM.0044) always use the template in force.
- **D-FORM-4, paper:** the blank paper to be filled by hand does **not** go through Document Control controlled copies. The Training paper pack (numbered, with the states Issued, Returned, Lost, Voided) stays; the person downloads or prints, signs by hand, and uploads the scan as a record. Anything the software can fill is filled by the software.
- **Reverses** the earlier decision "keep the enabling by hand with a signature" for the forms that are linked. A form that is not linked keeps the upload and the signed enabling.
- **Limits stated at the decision:** APD.0009 is read by the assessment form, whose structure the system does not check, so a revision of APD.0009 is taken but stays Disabled until a person enables it with a signature. A refusal is shown on the screen and in the Audit Trail; no notification is sent. Documents are linked by the person who administers Training (the document is chosen, not looked up by number: on DEV the numbers APD.0001 to APD.0030 belong to test documents).
- **To confirm by QA:** the automatic enabling without a Training signature, and the effect of using a form the moment it is Effective.

## TRAINING-ANNEX-2026-10-28

- 2026-10-28, owner (who is QA) decisions; no other named QA approver; this does not establish GMP compliance. **Reverses TRAINING-FORMS-FROM-DOCUMENT-CONTROL-2026-10-28**: the APD annexes are reference files that Training Administration uploads and manages in Training; they are **not** taken from Document Control and not made Effective there. The FRM forms (FRM.0007, FRM.0044) are requested as controlled copies in Document Control and are **not** managed or filled in Training Annex.
- **D-ANNEX-1, name and place:** a separate sidebar item **"Training Annex"** under Training Administration, with a complete screen (list, details with tabs), not a tab of Training Properties. The Forms tab and the "Forms taken from Document Control" table of Training Properties are removed.
- **D-ANNEX-2, own permissions:** `training.annex.view`, `training.annex.manage` (upload, disable, signature styles), `training.annex.enable` (the electronic signature that puts a template in force). They were given (V698) to every permission set that held `training.admin.manage`, so nobody gains what they could not do before; QA may now separate the three.
- **D-ANNEX-3, how a template says where things go:** the Word file is written with tokens (`{{NAME}}`, `{{GROUP.FIELD}}`, `{{#EACH:..}}`, `{{#CASE:..}}`, `{{#OMIT}}`, `{{CHECK:..}}`, `{{SIGNATURE:SLOT}}`, `{{BLOCK:..}}`). The system, not the user, fixes the fields, the cases, the stages and the order of signing of each APD code (`TrainingAnnexContract`). Users place tokens and choose the display style of each signature slot (Compact, Standard, Detailed, the three of Publishing Template).
- **D-ANNEX-4, safety of the output:** after a form is filled the file is read again and compared with what was written; a form with a token left, a value missing, or a token the data does not know is **refused**, never given.
- **D-ANNEX-5, transition:** a template without any token (an earlier one) keeps working through the old fillers that find a place by its printed words, with the warning "Legacy template: tokens are not checked". A template with tokens that does not agree with its contract **cannot be enabled**.
- **D-ANNEX-6, scope:** the six APD files that have a token contract were all given tokenized starter files built from the real APD files (APD.0011, 0014, 0024, 0108, 0117, 0118). APD.0009 stays on its assessment form builder: it is managed and enabled in Training Annex, its structure is not checked.
- **Limits stated at the decision:** the starter files and the check were verified by unit tests only; filling by a real record, the Word and PDF look, the preview, and the screens were **not** verified on a running system (no login in the shell). Milestone PDF snapshots, the "Forms" panel of an activity and the preview of a live record are not built. FRM.0007 and FRM.0044: whether FRM.0044 is replaced by the electronic log and how FRM.0007 is scanned and numbered were asked and **not answered**; the existing fillers for them still read a template if one is enabled.
- **To confirm by QA:** the display style of each signature slot (the system uses the Electronic Signature configuration until a style is chosen); that a legacy template may stay enabled; that the three permissions are given as the backfill did.

## TRAINING-FRM-PAPER-2026-10-28

- 2026-10-28, owner (who is QA) decisions; no other named QA approver; this does not establish GMP compliance. Completes TRAINING-ANNEX-2026-10-28 for the two FRM forms.
- **D-FRM-1, FRM.0044 (Training Number log):** option B. The form stays on paper under the controlled copy of Document Control; the system only issues the Training Number. The system **no longer writes FRM.0044** (export removed). The on-screen Training Number Register stays as a list.
- **D-FRM-2, FRM.0007 (specimen signature):** the original is the paper signed by hand, then scanned and kept as a record in the system. The system **no longer writes FRM.0007** (export removed). The Specimen Signatures screen is only a place to look up, quickly, the records of each user.
- **Not decided:** whether the confirmation of a specimen signature by the head of the department with an electronic signature (Pending Confirmation, Approved, Obsoleted) stays, and whether the number of the controlled copy of the signed paper is entered with the scan. Until the owner answers, that workflow is unchanged.
- The enabled templates FRM.0007 and FRM.0044 that exist on DEV are now unused; they are not deleted (a template file is never deleted) and cannot be uploaded again in Training Annex.

### TRAINING-FRM-PAPER-2026-10-28, answer on the specimen workflow
- 2026-10-28, owner: **option A.** The confirmation of a specimen signature by the head of the department with an electronic signature is **removed**. A scan uploaded is the **current record** of the person at once; the earlier one becomes **Superseded** and stays on record; a reason is needed to replace a current record. The screen is for quick look-up of the records of each user.
- Records confirmed under the earlier workflow keep their confirmer and electronic signature (the history is not changed). A scan that was still waiting for a confirmation (6 on DEV) is left as it is, shown as "Not confirmed (earlier workflow)", and its request for a confirmation is cancelled (V699) so that it leaves the work queue.
- The controlled copy number of the paper is **not** entered with the scan (not asked for by the owner; the paper is controlled in Document Control).
- Machine values are unchanged (APPROVED shown as Current, OBSOLETED as Superseded). The permission `training.signature.confirm` and the step `SPECIMEN_CONFIRM` stay in the database and the code for the history; they confirm nothing any more.

## TRAINING-SELFREAD-DEPT-2026-10-29

- 2026-10-29, owner (who is QA) decision; no other named QA approver; this does not establish GMP compliance. The form APD.0108 has one field "Department" and one box "Confirmed by head of department", and SOP.0003 5.3 puts the training of a unit on the head of that unit; the SOP does not say how to proceed when a training covers several departments.
- **D-SR-1:** a self-reading training that covers people of several departments has **one list (APD.0108) and one confirmation of the head for each department**. The department of a person is the department written on the participant; the list of a department holds only its people and names that department.
- **D-SR-2, who is the head (proposed by the assistant, to be confirmed by QA):** the **Department Head of the master data of departments** (Settings, Departments, field Department Head). A person who is the head of no department that has people waiting cannot confirm (`TRAINING_NOT_DEPARTMENT_HEAD`). A head confirms only the people of their own department, in one electronic signature (`TRAINING_READ_VERIFIED`); a person cannot confirm their own reading. A department without a Department Head has **nobody who can confirm**: the master data must be completed first.
- **D-SR-3, visibility:** the head of a department that has people in the activity may **open** the activity (read) to confirm their people, even when the activity is organized by another department. Nothing else is opened to them by this.
- **Export:** one list for each department; a ZIP when a session has several departments and none is chosen. A paper copy is numbered for each department (new column `department_id` on the confirmation and on the paper pack, V702). A confirmation made before this change has no department and is shown on the list only when the session has one department.
- **Not decided / open:** who confirms a department that has no head, or when the head is absent (a deputy); whether the list of activities shows an activity to a head of another department (only the link and the activity page are opened now).

## TRAINING-POSTPONE-DUE-2026-10-29

- 2026-10-29, owner (who is QA) decision; no other named QA approver; this does not establish GMP compliance. SOP.0003 5.3.6 says a training that cannot be completed in the month of the annual requirement must be postponed to the immediately following month; 5.2 keeps the Training Number and records the reason. The SOP does **not** say whether the approved requirement (APD.0118) is updated, nor what to do for a postponement of more than one month.
- **D-PD-1:** when a session is postponed to a day after the Due Date, the user is told and chooses Move the Due Date (to the end of the month of the new date) or Keep it. Nothing changes without that choice. The change is an Audit Trail entry (TRAINING_DUE_DATE_MOVED) and an event.
- **D-PD-2:** an activity opened from a line of the approved requirement: when the Due Date is moved, the **line moves to the new month**; the month it was approved for stays in `postponed_from`, the reason on the line. The requirement is **not** approved again; the move is an Audit Trail entry on the requirement (TRAINING_REQUIREMENT_LINE_POSTPONED). A move of more than one month is allowed (the SOP names only the following month).
- **D-PD-3:** an activity is still **opened by hand** from a line (not automatic): it needs an organizer and a Training Number allocated by a person with the right.
- **Open for QA:** whether a move of more than one month needs a QA word; whether the approved requirement should show the change to the departments that received its copy.

## TRAINING-REQ-LINE-MOVE-EUGMP-2026-10-29

- 2026-10-29, owner (who is QA) accepted the assistant's proposal for the two open points of TRAINING-POSTPONE-DUE-2026-10-29; no other named QA approver; this does not establish GMP compliance. Basis: EU-GMP Chapter 2 (training is recorded and continuing), Chapter 4 (a changed record keeps the original information readable), Annex 11 section 9 (audit trail of GMP-relevant changes, with the reason), Chapter 1 (a departure from an approved procedure is recorded). Quoted from memory, section numbers not checked against the text; QA to confirm.
- **D-RL-1, a move of more than one month is not blocked.** It is marked **"Beyond SOP window"** on the line (a move later than the month after the one the requirement was approved for), the reason stays mandatory, QA is told, and the site decides whether it is handled as a deviation in its own Deviation process. A QA e-signature before the move was considered and not chosen (slower; no GMP text found that requires it).
- **D-RL-2, who is told:** every time a line moves, the in-app notification (and e-mail by the usual settings) goes to the QA who prepared and the person who created the requirement, and to the head of the department that organizes the training; the person who moved it is not told. The people who received the printed copy are **not** told: the system does not keep who received a copy. **Open:** if QA keeps a fixed list of receiving departments, add it and tell them too.
- **D-RL-3, the approved record is not made to look unchanged:** the requirement screen shows "Approved month" and "Current month" with the reason, and the export of APD.0118 writes the month as "MM/YYYY (approved MM/YYYY)" for a moved line. The Audit Trail has the old and new month.
- **Not done:** "Beyond SOP window" is not yet counted in the Compliance screen (only on the requirement).

## TRAINING-OWNER-ACCEPT-2026-10-29

- 2026-10-29, owner (who is QA) decision; no other named QA approver; **this does not establish GMP compliance and does not replace the signature of a QA on each line of the decision sheet** (TRAINING_SOP0003_TRACEABILITY_AND_QA_SIGNOFF.md, section 3).
- **D-OA-1:** the owner accepts the present behaviour for the lines D-10, D-11, D-12, D-17, D-21, D-35, D-36, D-37, D-43, V633 (working days), the way of taking part, the scoring of tests and the saving of Training Properties. The risks are not the same for all of them; the assistant advised ticking each line and the owner chose one common acceptance. The boxes of the sheet are left empty.
- **D-OA-2 (update of D-SR-2/D-SR-3):** a department that has no Department Head in the master data (or a name not in the master data) is confirmed by a person who holds `training.activity.close`, in place of the head; the confirmation remark says so. A department that has a head is confirmed only by that head. The head of a department that has people in an activity sees the activity **in the list** of activities as well as by link.

