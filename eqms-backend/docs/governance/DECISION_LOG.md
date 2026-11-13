# Approved decisions

## PERFORMANCE-PUBLISH-SIGNED-INTENT-2026-10-31

- Owner decision in this conversation: implement continuation of Publish after backend restart from
  a persisted signing confirmation, rather than requiring a new signature solely because of restart.
- The owner explicitly authorized the HIGH-impact signature integration, limited to the confirmed
  Publish job. Other operations retain single-use JWT consumption and existing authorization.
- Confirmation is bound to the exact actor, related revision bundle, source versions/checksums,
  publishing preview/template and requested options/reason. Changed content requires a new confirmation;
  current permissions and lifecycle guards are rechecked by the worker. No raw signature JWT/password
  is persisted. Acceptance evidence is distinct from successful publication.
- Existing jobs without a persisted command are not automatically replayed. Report/preview work
  does not acquire signature authority. This is a product decision, not a GMP compliance sign-off.

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

## TRAINING-RENAME-DOC-IMPACT-2026-10-30

- 2026-10-30, owner (who is QA) decision; a naming decision of the screen, **not a GMP approval**.
- **D-RN-1:** the screen that lists the training activities of new or revised documents and records the signed assessment of their impact on the training matrix is named **Document Impact Assessment** (menu, page title, breadcrumb, link text). The old name was Document Trainings. Reason given: the screen is mainly the queue of assessments (default filter "Not done yet"), and "Training Assessments" is already the screen of the test and checklist definitions.
- **D-RN-2:** only the display text changed. The menu id `training-document-trainings`, the route `/training-management/document-trainings`, the API paths, the component and table names, the permission `training.matrix.view`, and the e-signature meaning `TRAINING_IMPACT_ASSESSED` are unchanged; no migration. Earlier records that name the screen Document Trainings (DOCUMENT_TRAININGS_NAVIGATION_2026_10_24.md, the batch change record) keep the name they had when they were written.

- **D-RN-3 (2026-10-30, supersedes D-RN-2):** on the owner's instruction ("đổi luôn") the identifiers were renamed too: menu id `training-document-impact-assessment`; route `/training-management/document-impact-assessment`; API `/training/document-impact-assessments` and `/summary`; component `DocumentImpactAssessmentView`; the page key `documentImpactAssessment`; the notification key `TRAINING_DOCUMENT_IMPACT_ASSESSMENT`; the saved-filter and column-layout keys of the screen. Kept for what already exists: the earlier route `/training-management/document-trainings` redirects to the new one (2 notifications already sent carry it), and the notification key `TRAINING_DOCUMENT_TRAININGS` is still understood. Not renamed: the permission `training.matrix.view`, the e-signature meaning `TRAINING_IMPACT_ASSESSED`, the database tables (none carried the old name; the data is in `training_impact_assessments`). Effects: the saved filters of the screen (browser storage) and a favourite of the old menu id start again, nothing is stored in the database under those keys (checked: no row in user_table_preferences or user_ui_preferences); a browser that still runs the earlier frontend gets a 404 from the old API path until it is reloaded.

## TRAINING-PAPER-RETURN-BY-SCAN-2026-10-30

- Decision: a numbered paper copy is Returned only by the upload of its scan; nobody can record it as Returned by hand. A person can still record a copy as Lost or Voided (with a reason). Owner: QA Manager, 2026-10-30.
- Why: "Returned" claimed the signed paper is filed with the record; the scan is the proof of it.
- Effect: the first scan uploaded for an Issued copy closes it as Returned (one closing event, Audit Trail `TRAINING_PAPER_COPY_RETURNED` with the code and the scan name). A copy already Returned, Lost or Voided is not changed by a later scan. A hand-made Returned is refused (`TRAINING_PAPER_RETURN_BY_SCAN`).
- Open: whether a scan must name the copy (today the copy is chosen when the scan is uploaded; a scan without a copy closes nothing).

## TRAINING-PAPER-QR-SCAN-BATCH-2026-10-30

- Decision: every page of a numbered paper copy (attendance sheet, self-reading list, exam copy of a trainee) carries a small QR code (about 14 mm, top right margin, on a white square) with the code of the copy, the trainee (first 12 characters of the participant id) and the page ("2/3"). A scanned PDF with the pages of many people in any order is sorted by the server by these codes; the person does not choose the type, the person, the copy, the form or a remark. Owner: QA Manager, 2026-10-30 (method 2 of the options offered: a small QR code in the margin).
- Rules in force without a further decision (owner may change): a page whose code cannot be read, or that belongs to no copy of the activity, is not guessed and not stored, it is listed to be scanned again; the pages of one person are put in the order of their page numbers, a missing page is reported (stored as incomplete); the same pages sent twice are stored once; the scan still has to be checked against the paper by a second person; a copy is Returned by the first scan stored for it (see TRAINING-PAPER-RETURN-BY-SCAN-2026-10-30).
- Not covered: Word exam copies (the person prints them, no code); paper printed before this change has no code; external trainings (a certificate has no code) keep the form with the type.
- Open: should a copy of many trainees (the exam pack) be Returned only when every trainee has a scan, not at the first one?

## TRAINING-SELFREAD-ELECTRONIC-2026-10-31

- 2026-10-31, owner (who is QA) decision; no other named QA approver; this does not establish GMP compliance. The self-reading of a training (APD.0108) is confirmed **by electronic signature only**.
- **D-SE-1:** each person confirms the reading with their own electronic signature (My Training, To Do, the training, "I have read and understood"); the head of the department confirms the people of the department in one signature. Both exist already and are unchanged.
- **D-SE-2:** the blank **paper print** of the list (numbered copy "/L<n>", QR code) is **ended**: the button, the endpoint `POST /training/sessions/{id}/self-reading-list/paper` and its code are removed. Copies printed before stay as records (`training_paper_packs`, kind SELFREAD, and the check constraint are not touched).
- **D-SE-3:** the list APD.0108 is only the **record of what was signed in the system**: button "Self-reading List" (PDF or Word) in the Session Workspace once the session has started; with people of several departments, one file for each department, each saved as its own file named by the department, never a ZIP.
- **D-SE-4, a person who did not read:** the trainer records "Did Not Read" with a **reason** (state Absent, the person stays on the list and is trained again in a make-up). The trainer can **never** record that a person read: Attended and Online are refused for a self-reading session (`TRAINING_SELF_READING_ELECTRONIC_ONLY`), also as a correction. This lets "Send attendance list to QA" go on (no person stays Invited).
- **Not covered / open for QA:** a person marked Did Not Read by mistake cannot be put back (a make-up is arranged); the reason of the absence is not written on the form APD.0108 (it has no column for it); who may confirm for a department that has no head is as in TRAINING-SELFREAD-DEPT-2026-10-29.

## TRAINING-SELFREAD-NO-APD0117-2026-10-31

- 2026-10-31, owner (who is QA, here the DCO) decision; no other named QA approver; this does not establish GMP compliance. SOP.0003 uses APD.0108 for the list of a self-reading and APD.0117 for the other forms of training. Option A chosen: **a training of self-reading only has no attendance, no check-in and no step "Send attendance list to QA"**.
- **D-NA-1:** an activity whose sessions (not cancelled) are all self-reading: no check-in, no roll-call (refused by the server: `TRAINING_SELF_READING_NO_ATTENDANCE`), no button "Training Attendance List" (APD.0117), no "Send attendance list to QA".
- **D-NA-2:** the trainer finishes it (Finish Training, one signature) once nobody is left Invited (each person signed, or was recorded as Did Not Read) and at least one person read and was confirmed by the head. QA, here the DCO, is then told, in the application and by e-mail, **with the list APD.0108 attached** (a PDF, or a ZIP with one list for each department or session). That message is the moment from which the revision can be completed in Document Control (Pending Training); that rule is unchanged.
- **D-NA-3:** in the Session Workspace a self-reading session has the steps Prepare, Reading and Results (no Training and no Assessment); "Did Not Read" no longer needs the session to be started.
- A mixed activity (self-reading and classroom sessions) keeps APD.0117 and the attendance list for the classroom sessions.
- **Not covered / open:** the e-mail with APD.0108 was not read in a mailbox; a person marked Did Not Read keeps the activity from finishing until a make-up exists only if the make-up is a separate activity (as for a classroom absence); the due date for QA (SOP.0003 5.3.6, "list sent to QA") is still measured as before for such an activity.

## TRAINING-SELFREAD-RESULTS-2026-10-31

- 2026-10-31, owner (who is QA) decision; no other named QA approver; this does not establish GMP compliance. The Results step of a self-reading and the form APD.0108.
- **D-SRR-1:** the head of a department signs electronically for the department **only when every person of it has signed the reading or was recorded as not having read** (`TRAINING_SELF_READING_NOT_ALL_SIGNED`).
- **D-SRR-2:** Step 3 "Results" of a self-reading shows, for each department, the head, who signed, who did not read, who is not signed yet, and the electronic signature of the head (name and time); the head signs there. **Finish Training is offered only when every department that has readers is confirmed** and nobody is left to sign; QA is then told with the lists APD.0108 of **every department that has people** (a ZIP when there are several).
- **D-SRR-3, the form APD.0108:** the cell Signature of each employee holds the real electronic signature block (name, meaning, time), not a sentence; the box Remarks of the head's confirmation holds the **reason typed in the electronic signature window** (when nothing was typed, the box stays empty). The reason is now sent for the self-reading signatures (the employee and the head); the other signatures of Training still record the plain sentence of the system.
- **D-SRR-4, download:** the button "Self-reading List" saves **one file for each department in one click** (never a ZIP), named by the department name (`TRN-QA-26-929-S1-APD.0108-Quality Assurance.pdf`); a department that is not in the master data is asked by its name.
- **Not covered / open:** a person who did not read has an empty row on the list (no remark on the form); a department that is not in the master data has no head, and it is confirmed in place of a head only when it has readers; the other signatures of Training do not yet carry the typed reason.

## TRAINING-SELFREAD-MANDATORY-2026-10-31

- 2026-10-31, owner (who is QA) decision; no other named QA approver; this does not establish GMP compliance. Self-reading is read by every invited person; reminders replace "Did Not Read".
- **D-SRM-1:** the function **Did Not Read is removed**. Every invited person must read and sign the self-reading electronically. The trainer records nothing for a self-reader: recording Attended, Online or Absent, and correcting it, are refused (`TRAINING_SELF_READING_ELECTRONIC_ONLY`). There is no "did not read" state for new work. A person who cannot read (left the company, long leave) is handled by D-SRM-5.
- **D-SRM-2, reminder before the due date:** a person who has not signed is reminded by a notice and an e-mail a number of days before the **due date of the training**, set in **Training Properties, tab Reminders** (first reminder, default **3** days; second reminder, default **1** day; 1 to 30, the first must be more than the second). Each reminder is sent once to each person (key `read-due:<participant>:<days left>`). The general "due soon" reminder no longer covers a self-reading.
- **D-SRM-3, reminder by the trainer:** in the Reading step, every line of a person who has not signed has the button **Send Reminder** (notice and e-mail to that person; the time is kept in `training_participants.last_read_reminder_at` and in the Audit Trail as `TRAINING_READ_REMINDED`). The button disappears once the person has signed. Needs the right to conduct or organize the training; the same person cannot be reminded again within 60 minutes (`TRAINING_READ_REMINDER_TOO_SOON`).
- **D-SRM-4:** Finish Training stays offered only when nobody is left Invited, at least one person read, and every department that has readers is confirmed by its head.
- **D-SRM-5, a person who cannot read (owner decision 2026-10-31, asked for the way the procedure handles it: retraining):** the person is **not taken off the list** (the list of invited people is kept, SOP.0003 5.3.4) and is **not recorded as read**. While the training is Notified or In Progress the trainer or organizer records them with **Cannot Read** in the Reading step, with a **reason** and an **electronic signature** (meaning `TRAINING_READER_EXCUSED`, V712): the person becomes **Absent** with that reason, no longer blocks Finish Training, and is a candidate of the **supplementary training** (make-up, SOP.0003 5.3.7), where the retraining is recorded. Only a person who has not signed can be recorded; the person cannot be the one who records; the trainer still records no attendance for a self-reader.
- **Not covered / open:** the overdue reminder for the organizer (existing) is the only action after the due date for a person who is Invited; people already recorded as Absent in earlier runs on DEV (for example TRN/QA/26-780) keep that record. The two points that were open here (the supplementary training made without people, and who is chased) are answered by D-SRM-6.
- **D-SRM-6, a person who cannot sign because they left the company or are on a long leave (owner decision 2026-10-31, "làm theo đề xuất, N = 14"; the owner is QA, no other named QA approver; not a GMP approval):** SOP.0003 5.3.7 says an absent person stays on the original list marked "Vắng mặt" in the signature column, is rescheduled "as appropriate", and has a separate list for the make-up (numbered per 5.1.4). The SOP does not mention a person who cannot read; the rules below are the owner's design, not text of the SOP.
  1. **Original list kept (SOP 5.3.7, ALCOA+).** The person is never removed from the list of an activity that is open. APD.0108 shows every invited person; a person who is Absent has **"Vắng mặt / Absent"** in the signature column (it was blank before this change). The Cannot Read record keeps the reason, the electronic signature of the trainer and the **state of the person's account at that time** (Active, Suspended, Terminated...) in the Audit Trail (`TRAINING_READER_EXCUSED`) and in the activity events. The state of the account is a system fact, not typed.
  2. **A closed account cannot sign, so nobody is asked to.** For a person whose account is not Active, Send Reminder is refused (`TRAINING_READER_ACCOUNT_NOT_ACTIVE`) and hidden, the scheduled reminders before the due date skip them, and the line shows "account terminated/suspended: cannot sign". The trainer records them with Cannot Read (reason + e-signature).
  3. **Make-up (separate activity, own list).** The supplementary training keeps the number of the original with the next letter (5.1.4). It now **proposes the absent people on the new activity**: when its first session is made they are listed, and the organizer still confirms the list with a signature as for any activity (the list is not confirmed for them). A person already listed in a make-up of the activity is not offered twice (`hasSupplementary`).
  4. **Left the company or suspended: no make-up until the account is Active.** A person whose account is not Active is shown as a candidate but cannot be put on a supplementary training (`TRAINING_SUPPLEMENTARY_PERSON_NOT_ACTIVE`); they stay Absent on the original list. For a person who left, the training requirement ends with the account: the compliance views, the matrix and the requirements already list only people whose account is Active (`status = 'Active'`), so nothing is chased for them. For a suspended person on a long leave the requirement comes back when the account is Active again, and the person then appears as a candidate that can be offered the make-up. A long absence is also covered by the existing review of a returning person (Training Properties, "Months of absence before retraining", default 6). People without an account (outside participants) are not affected.
  5. **The make-up is not forgotten.** Training Properties, tab Reminders, new setting **"Make-up reminder: days after the due date" (default 14, 1 to 365)**. Every week from that many days after the due date of the original training, the organizer gets a notice and an e-mail (`TRAINING_MAKEUP_PENDING`, key `makeup-pending:<year-week>`) naming how many people are still Absent with an Active account and in no make-up; it stops when a make-up lists them. The activity screen shows a notice (In Progress or Pending QA Confirmation) with the number to arrange and the number that cannot be offered now. The notice is **not a block**: the SOP does not block QA confirmation.
- **Answered (owner, 2026-10-31):** whether a person who is Absent and not yet trained on a new SOP may work with it. For general SOPs: yes, they do the general work. For SOPs in the training matrix of a Work Position: not appointed to that position until trained (rule 3 of D-SRM-7). The earlier remark that the system has no mechanism that stops work is corrected: the job assignment is that mechanism, at the appointment.
- **D-SRM-7, make-up has no fixed deadline and a revision does not wait for everyone (owner/QA decision 2026-10-31; not a GMP approval):** SOP.0003 5.1.3 gives 10 days as a preference ("nên") for new or upgraded documents only; 5.3.7 says an absent person is rescheduled "as appropriate" ("phù hợp") and gives no days. Decided by the owner:
  1. **No fixed deadline for the make-up of an absent person.** The make-up can be done at any time. The activity made by Supplementary training gets no due date from the system, and the 10-day rule is not applied to it (the days of a document training are a setting in Training Properties, not a rule of the make-up). Only the weekly reminder of D-SRM-6 (rule 5) follows it up.
  2. **A revision does not need everyone trained to be released.** The trainer can Finish Training in the Session Workspace, the revision can then be moved with Complete Training and published, while people are still Absent or in a make-up. This is the behaviour of the code today (`TrainingDocumentIntegrationService.completionGate`: the root activity is COMPLETED or Finish Training was done; Absent people and the make-up activity are not looked at). **No change was made and no warning or block was added** (the options of a warning at Complete Training, or of a block, were put to the owner and not taken).
  3. **Who may work with the new SOP is controlled by the Work Position, not by the revision (owner/QA, 2026-10-31).** A SOP of general training does not stop anyone from doing the general work. A SOP that the department head ticked in the training matrix for a Work Position must be trained before the person is appointed to that position: the job assignment (APD.0024, SOP.0003 5.3.8) can be signed only when the matrix training of the position is complete, or an exception with a reason is approved by a designated person other than the assignee and the preparer (`TrainingJobAssignmentService`, `TRAINING_MATRIX_INCOMPLETE`). An Absent person has no training record, so the matrix stays incomplete for them until the make-up is done. This is read from the code, not yet run on DEV for this case. Limits: the gate is at the appointment; a person who already holds the position is not stopped when a new revision is released (Compliance shows them as missing or due); the check of the assignment matches the record by document number, so a record of an earlier revision may count (to be checked). The system does not stop general work (SOP lines 70, 82).
  4. **A person who fails the assessment** is "tạm ngừng việc" under SOP.0003 5.3.7 (line 386). The system raises a **work-suspension flag** (`TrainingSuspensionService`, D-12; Compliance > Work Suspensions) and tells the person, the unit heads and the organizer. It is a flag and a notice: no other function is blocked (the earlier text of this line, that the system does not stop the work, was incomplete). The flag ends when the person passes a retraining (every flag of the same original activity and its supplementary activities), or when the head of the unit ends it with a reason and an e-signature. A defect found in the UAT of 2026-10-31 was fixed: a person who failed the original, failed the first retraining and passed the second kept the flag of the first retraining open (`clearOnPass` ended only the flag of the original activity).
- **Not covered / open:** the "left the company" case was tested by setting the account of a DEV test user to Terminated by SQL and putting it back (not by the user administration screen); the reminder of the make-up was run by the manual action of Training Notifications with the due date of the test activity moved 30 days back by SQL; the e-mail was not read in a mailbox; the real 06:30 run was not waited for; the personal requirement of a person who is Absent with an Active account was not looked at in the Compliance screen; the make-up list is proposed only for people with an account; a Suspended person is treated like a Terminated one (no make-up until Active) and the reason is free text, not a coded category.

- **UAT-2026-10-31 (evidence: `eqms-backend/docs/validation/evidence/uat_2026_10_31/REPORT.md`, pictures `shots/`, APD files `apd/`; DEV; run by the assistant on the instruction of the owner/QA; not a GMP approval):** five scenarios were run on DEV with 19 new test accounts (`uat31.*`): (1) a document revision upgraded 1.0.0 to 2.0.0 and published Effective while one person was absent, one failed the test (40%) and one left the company midway; (2) an activity that does not start from a document, ten people of three departments (2 pass, 4 fail, 2 absent, 2 left); (3) a QC employee appointed to two more Work Positions (QC Microbiology, QC Physicochemistry): the signature is refused (`TRAINING_MATRIX_INCOMPLETE`) until the trainings of the matrix are passed (one failed first, retrained, passed; one test; one SOP by self-reading with e-signature), then signed by the head and accepted by the employee; (4) make-up for the absent (number + a), retraining for the failed (number + b, a person who failed again got a further retraining + c), the people who left stay Absent and cannot be put on a make-up; (5) self-reading with seven people of three departments: five sign, one left, one on long leave (Cannot Read), heads confirm per department, APD.0108 one file per department.
- **Findings of the UAT 2026-10-31:** (a) FIXED: the work-suspension flag of a person who failed the first retraining stayed open after the second retraining was passed (`TrainingSuspensionService.clearOnPass`, unit test added, regression run 11/11 on DEV). (b) FIXED: the note "account terminated: cannot sign" cut the Attendance column; it is now a second line (`TrainingActivityDetailPage.tsx`). (c) **FIXED on 2026-10-31 after the owner chose option A, "own screen for the employee" (named decision UAT31-EMPLOYEE-SCREEN-A):** an employee who holds only `training.self.view` (the DEV trainee profile; the permission is described as "See and confirm my own training") gets 403 `TRAINING_SCOPE_DENIED` when opening the training of their own from My Training, because the Participation page reads the activity with `GET /training/activities/{id}`, which needs `training.activity.view` and the scope of the organizer department; so the employee cannot sign a self-reading **on the screen** (the API `/training/me/participations/{id}/confirm-read` works). Fix: `GET /training/me/participations/{participantId}` (`TrainingRecordController`, `TrainingRecordService.myParticipation`) needs only `training.self.view`, reads the row with the id of the logged-in person in the query (another person gets 403 `TRAINING_SCOPE_DENIED`), returns only the training, document, links, due date and the person's own line (no other participant, no result of anybody), and changes nothing; the page `/training-management/participations/{id}` (`TrainingMyParticipationPage`) shows it and signs the reading with `POST /training/me/participations/{id}/confirm-read` (e-signature window); My Training sends a self-reading row to this page. The activity itself is still not opened to the employee. Unit tests: `TrainingRecordServiceMyParticipationTest` (4), `TrainingMyParticipationPage.test.tsx` (3); DEV: p5d 10/10, the employee signed on the screen. Not covered: files uploaded as material are listed by name only ("ask the trainer for the file"); there is no download for the employee yet. (d) Not covered: APD.0009 (the filled test paper of each person) was not exported; the e-mail was not read in a mailbox; the real 06:30 reminder run was not waited for; the accounts were closed by SQL, not through the user administration screen; the head of department of the test accounts cannot open Compliance (the DEV trainer profile), so the Work Suspensions picture was taken as admin.

## TRAINING-PAPER-PRINT-MERGED-2026-10-31

- 2026-10-31, owner decision (option B). The permission `training.paper.print` is **removed** (migration V711). Printing the paper packs and the numbered copies of a training (exam copies, attendance pack, reprints, marking a copy Lost or Voided) needs the right to **conduct or organize** the training (`training.activity.conduct` or `training.activity.organize`, with the scope of the organizing department); no separate right. Permission sets lose the grant with the permission (cascade). The Training access mapping and the SDS are updated.
- **Not covered / open:** a custom permission set made on another environment that held `training.paper.print` loses it silently; the people who print must hold conduct or organize.


## PERFORMANCE-CC-FENCED-RECOVERY-2026-10-31

- Owner decision in this chat: keep legacy Controlled Copy DISTRIBUTE jobs already PROCESSING
  without worker ownership for DCO reconciliation; do not automatically repeat their uncertain
  external outcomes. New owned jobs may recover after interruption using an expiring lease and
  fencing token, current actor/permissions/object scope and parent lifecycle rechecks. This is a
  recovery decision, not a new signature authorization or a compliance approval.
- Scope-approved: shared useServerTable may add stale-request cancellation and retain rows during
  refetch (GitNexus CRITICAL, 34 direct callers), keeping server-side queries, access controls and
  regression coverage. Evidence/source: PERFORMANCE_ASYNC_RESILIENCE_2026_10_31.md.


## PERFORMANCE-EMAIL-OUTBOX-ENCRYPTION-2026-10-31

- Owner explicitly approved AES-GCM encryption of queued email content with a dedicated server
  key kept outside Git/logs. Reason: Controlled Copy recipient delivery contains the access password.
- New messages encrypt subject/body/payload before DB insertion, bound to delivery ID, recipient,
  event and domain; legacy rows remain readable. A missing key blocks startup; a wrong key or
  tampered row is not sent and becomes UNKNOWN for reconciliation. This is not an automatic
  plaintext fallback, key rotation, or proof of exactly-once email delivery.

### UAT-2026-10-31 corrections after the owner looked at the pictures (11 points)
- APD.0117: the session is written `01` (the token path wrote `SS01` again: fixed in `TrainingAttendanceListService.annex` and the sample); a trainer from outside is written `External Trainer (name)`; the meaning of the signature in the column "Signature" (trainee at check-in or trainer on their behalf) is `Attendance Has Been Taken` (the stored meaning names are unchanged, part 5 still says "Attendance List Sent to QA"); a person who was ABSENT has the outcome of the make-up in "Training result" and only a further training in "Re-training result" (`resultColumns`).
- APD.0011: from 7 Work Positions the page is turned to A4 landscape (names stay horizontal up to 12 positions, upright above). Note: the columns of the form are the positions of the DEPARTMENT, so an older version of a matrix is printed with the positions that exist now.
- APD.0024: the two notes of the form under the signatures are instructions and are no longer printed; the cell "Assignor" says the head of the department of the employee when the receiver is staff, and the title of the assignor when the receiver is a head of a department, QM or QP. **Assumption to confirm (owner):** the system has no flag for QM/QP; the receiver counts as management when they are the head of a department or their position text contains QM, QP, quality manager, qualified person, manager or "trưởng". A department without a head falls back to the title of the assignor.
- APD.0014: "Qualification" is the HIGHEST degree: the order of Application Settings > Education > Degree Levels (display order); a name not in that list counts lowest; same level: the later graduation year. A person without a degree record has it empty.
- Screens: Revision Details has a `Training Details` button (outline-emerald, no icon) after Back in the header and the footer, opening the activity of the Training Number of the revision; the Supplementary Training dialog is a list of cards like the Reviewer/Approver chooser; Assessment Materials in the Session Workspace uses the same file card as the Assessment tab; a rule before the delete column of the matrix editor.
- Evidence: `uat_2026_10_31/p6a_*.py`, `p6b_*.py`, pictures and files `F-xx`. Checks that failed in a re-run were artefacts of the script (a stale expectation after the data changed), see the report of the session.


## TRAINING-COMPLIANCE-DEPARTMENT-SCOPE-2026-11-01

- Owner decision in this chat: the Training Compliance screen (Summary, Matrix Completion, Gap List, Work Suspensions, Record Retention) is seen **by department**. A person sees their own department only; a person who holds `training.scope.all` (Permission Set *Training - All Departments*) sees every department.
- The owner expects that role to be given to people outside QA too (for example a plant director), so the scope is not tied to a QA position: an Administrator assigns the Permission Set to the Access Profile of that person. The system never checks a position name. The SOP.0003.02 does not say who may see another department; this is the owner's decision, not an SOP requirement.
- Source check (2026-11-01): the five tabs all check the department (`TrainingComplianceService.department`, `TrainingSuspensionService.list`, `TrainingRetentionService.list` call `requireScope`). Retention was read with `training.record.view`; the owner decided (2026-11-01) that all five tabs use `training.compliance.view`, and `TrainingRetentionService.list` was changed to it. Resume of a suspension needs `training.job_assignment.manage` and the scope of the person's department.
- Open, not decided: (1) decided: the Trainer profile keeps *Training - View* and sees Compliance of the own department; (2) the department of a user is matched by name text, not by ID, so a renamed department or a spelling difference removes the department from the user (known limit, not changed here); (3) the Training access table (TRAINING-ACCESS-MAPPING.md) is still a draft without QA approval.


## LEGACY-IMPORT-TRAINING-2026-11-01

- Owner decisions in this chat (2026-11-01) for Document Legacy Import and its link with Training Management. Status: decided, **not built**.
- **D1:** a legacy-imported SOP counts as trained for a person only when the paper list of trainees is entered AND signed by the person who verifies it. The system never assumes a whole department was trained.
- **D2 (corrected):** the trainees are chosen from the users of the system, with the same screen as the training step of the ordinary document flow (`ProposedParticipantsField`, labelled as people who were trained on paper). A scan of APD.0108 or APD.0117 is mandatory. A person no longer in the system cannot be chosen and gets no record (known limit). The training record of a person is created only after the verifier signs, with source `LEGACY_PAPER`, the paper Training Number (or none), the document number and the revision.
- **D3:** the historical reviewer and approver stay as free text (they may have left); optionally a user account can be linked, and only a linked person gets the initial training record of D-45.
- **D4:** document impact (positions to train on the document) runs at import, only as a suggestion to the department; it creates no activity.
- **D5:** the importer needs the department scope like Training does: another department only with `training.scope.all`.
- **D6 (changes D-27):** a legacy-imported revision that has a paper Training Number gets a read-only historical activity in Training Management (origin LEGACY_IMPORT, completed, no session, no assessment) carrying that number, in the same transaction as the import. A revision with no paper number gets none; the system never invents a number. The system still issues no new Training Number for old training.
- **Shared number:** one paper Training Number can cover several SOPs (owner confirmed this happens). Several revisions of different documents may point to the same historical activity; the scan and the trainee list are entered once for the number. The present rule of the import (a number may not be used twice, or by another revision) must change for this.
- **Lost scan (option 2):** when the paper is lost, the import may still declare "no evidence" with a reason, as the Legacy Evidence queue does today. The revision is imported and marked "evidence missing"; no record is created for any person.
- **Number collision:** the number counter of Training (`TrainingNumberService.issueRoot`) does not know the numbers typed by hand. It must skip any number already used, and the counter of a department and year is raised to at least the highest hand-typed number. Open: a one-time start number set by the Administrator at go-live.
- Open, to verify before building: schema and queries of `training_activities` that assume sessions; behaviour of the double-submit and parallel import of the same document number; whether the importer's department scope exists today.

- Owner decision (2026-11-01, same entry): the scan of APD.0108 / APD.0117 is entered **inside the Legacy Import form**, not in a later step. The assistant had proposed a later step because the records bucket is Object Lock COMPLIANCE: a scan stored in the import transaction cannot be deleted if the transaction then rolls back (an object without a database row, recorded as `DELETE_BLOCKED_BY_RETENTION`). The owner keeps the form step; this risk is accepted and must be covered by a reconciliation of such objects and a warning before the upload.
- Built and checked on DEV (2026-11-01): Legacy Training Evidence table columns Training Number, Document Number, Document Name, Document Revision (sortable on the server); action "View Scan" opens the scan in a window (PDF in the project viewer, image in an image window), audited as `TRAINING_LEGACY_EVIDENCE_VIEWED`, separate from `TRAINING_LEGACY_EVIDENCE_DOWNLOADED`; download keeps the uploaded name (header in UTF-8). Evidence: `uat_2026_10_31/p6h_*.py`, pictures F-27 to F-30, 16/16 checks. The only scan on DEV is a 45-byte stub, so the viewer was shown a real PDF and PNG through the browser (the real path View Scan > blob > viewer).

### LEGACY-IMPORT-TRAINING-2026-11-01: how it was built (2026-11-01), differences from the proposal, and what is not done
- **Built and checked on DEV** (V718; `p7b_legacy_import_training.py` 32/32 checks, `p7c_legacy_shots.py` 9/9, pictures F-38 to F-42; unit tests `TrainingNumberServiceTest` 5, `TrainingLegacyEvidenceProblemTest` 13, `LegacyBatchImportFullFlowTest` 11, all 303 tests of `com.eqms.service.training`; front end tests 62).
- **Differences from the proposal (the owner may overrule):**
  1. The training record of a trainee has source `LEGACY_IMPORT` (the value already allowed by the table), method `PAPER`, result `ATTENDED` -- not a new `LEGACY_PAPER` value. The initial record of the author, reviewers and approver (D-45, only the persons chosen among the users of the system) has method `SIGNATORY`, source `LEGACY_IMPORT` (not `SIGNATORY_INITIAL`): the unique index of that source allows one record for each person and activity, and a number shared by several documents needs one for each document.
  2. A revision linked to a historical activity is `INTEGRATED` (not `MANUAL`): the table refuses a revision with an activity that is `MANUAL` (`ck_revision_training_mode_consistent`). It stays marked `LEGACY_IMPORT` in `training_origin`.
  3. D4 is a notification to the people who hold `training.document_impact.manage` in the department ("check which positions must be trained and the matrix"); the positions are not computed and nothing is created for them.
  4. D5 uses the department of the user (matched by name) and `training.scope.all` for another department; it applies to EVERY Legacy Import, not only to documents that require training. A Document Control Officer who imports for another department needs `training.scope.all`.
  5. Persons trained can be named only together with the paper Training Number (a training record needs a number and an activity). A revision without a number gets the scan or the declaration "paper lost" only, and no person.
  6. The importer needs `training.activity.organize` and `training.approval.designate` to attach the evidence (the same rights as "Attach the scan" in the queue); without them a training document cannot be imported through the form.
  7. A paper number joins an activity that exists (one paper record for several SOPs): the scan and the persons are entered once; a document that joins after the evidence is verified gets the records of the persons at once. A number issued by Training Management, or used by another record, is refused.
  8. The number counter (`TrainingNumberService.issueRoot`, GitNexus impact HIGH, 17 symbols) skips any number already used and is raised to a paper number of the form TRN/DC/YY-XXX. Revisions imported before V718 with a paper number got their activity in V718 (one on DEV).
- **Not done / not verified:** (a) the Participants tab of a historical activity shows 0 (the persons are in the training records and in the evidence queue, "Persons Trained"); (b) D5 was not run end to end with a user of another department; (c) the Administrator's one-time start number of the counter at go-live; (d) a database rule that a number cannot be on both an activity and a revision of another origin; (e) reconciliation of scan objects left in the locked store when an import rolls back after the scan was stored (accepted risk of the owner); (f) `LegacyImportView.tsx` was not split (the new block is its own component); (g) the PDF viewer was proved with a real PDF given to the browser, not with a scan read from the store, because the only older scan on DEV is a 45-byte stub; (h) `detect_changes` shows 66 files and 187 symbols for the whole uncommitted tree (risk medium, 2 flows), nothing was committed.

### LEGACY-IMPORT-TRAINING-2026-11-01: round 2 (owner requests of the same day)
- **Paper details:** the Legacy Import form asks, for a new paper Training Number whose paper is not lost, for the Training Topic, the Trainer (free text, as written on the paper) and the Mode (Self-reading, Classroom, Hybrid or Practical, the Training modes). They are kept on the historical activity (`paper_topic`, `paper_trainer`, `paper_method`, V719); the topic is what the activity and the training records of the persons say; the activity detail shows Mode and Trainer. A number that joins evidence already on file takes none of them again. The Trainer is not a user of the system (the trainer of a paper record may have left).
- **Screens:** `LegacyImportView.tsx` was split (2112 to 295 lines; the tabs, the revision card, the lookups, the number check, the validation and the request are in `document-creation/legacy-import/`). The window of the scan in Legacy Training Evidence has one Close only and no Download (download stays in the menu); `PdfPreviewModal` got an optional `showCancel`. Training Number, Document Number and Document Revision of that table are links (activity, document, revision).
- **Open items of round 1, now done:** (a) tab "Persons Trained" on a historical activity (the persons, how they were named, whether the record is written); (b) D5 checked end to end with a user without the all-departments scope (`dco.lead2`, refused for another department, allowed for the own); (c) Training Properties, tab "Number Counters": the Administrator raises the counter of a department and year to the last serial of the paper log (permission `training.settings.manage`, reason required, audit `TRAINING_NUMBER_COUNTER_RAISED`, it can only rise); (d) the rule of the database V720/V721: a Training Number belongs to one activity and a revision that carries it must point to it (checked at the end of the transaction, reading the row as it is then); (e) a scan stored by an import that rolls back is asked to be removed after the rollback, which the locked store refuses and records for the reconciliation (`DELETE_BLOCKED_BY_RETENTION`); (g) the scan window was shown with a real scan read from the store.
- **Still open:** the scan of such an import stays in the locked store after a rollback (it is recorded, not removed -- by design of the Object Lock); a number counter raised by mistake cannot be lowered (an Administrator needs the database); the Training Topic of an older historical activity (made before V719) is the document name; `detect_changes` covers the whole uncommitted tree.

### LEGACY-IMPORT-TRAINING-2026-11-01: round 3 (owner requests of the same day)
- **No second person verifies legacy training evidence any more (owner).** The field "Who verifies" is gone from the Legacy Import form and from the "Attach the scan" window; the endpoints to verify, to reject and to list the eligible verifiers are removed; `LegacyTraining`, the section of the request and `TrainingLegacyEvidenceService` no longer carry a verifier (an old client that still sends `trainingVerifierId` is ignored). The person who imports signs the import (the e-signature `LEGACY_DOCUMENT_IMPORT` with its justification) and that is the attestation; evidence attached later from the queue is signed by the person who attaches it (new meaning `TRAINING_LEGACY_FILED`). The evidence is FILED at once, read-only, and the training records of the persons named with it are written at the same moment (this changes D1, which said "only after the verifier signs"). Statuses: FILED (new), VERIFIED and REJECTED (history). V722: evidence that waited for a verifier became FILED and its records were written; the pending assignments to verify were cancelled (DEV: 5 filed, 36 legacy records in all). The step `LEGACY_EVIDENCE_VERIFY` stays defined only to describe old assignments. **Consequence the owner accepted:** nobody but the importer checks the scan or the list of persons; the control is the importer's signature, the audit trail (`TRAINING_LEGACY_EVIDENCE_FILED`) and the read-only evidence.
- **Raise the Counter window:** wider (size 2xl); the reason box is 3 lines, cannot be resized, and scrolls when long.
- **Tab Training Requirement of Legacy Import:** the list "participants in the Training" (a proposal for a training that opens) is not shown any more (`TrainingTab` got `showParticipants`, default on; Legacy turns it off) because a document imported from paper has no training that opens; the tab tells where the persons who were trained on paper are chosen (Revision History, section of each revision).
- **Evidence of this round:** `p7b` 38/38, `p7d` 16/16, `p7e` 15/15 (pictures F-47 to F-53), 307 unit tests of `com.eqms.service.training`, front end 392 tests.

### LEGACY-IMPORT-TRAINING-2026-11-01 - round 4: full test (no new business rule)

- **Scope tested on DEV:** import by API and by the real browser (calendar, file dialogs, person picker, e-signature), number counter and collisions, Document Control hardening, D5 department scope, Training Compliance (OK / MISSING), historical activity read-only, Obsolete of an imported document, views of records, odd inputs (accents and paths in file names, a person chosen twice, a person who left, lengths).
- **Defect 1 (fixed):** a record that was voided still showed "Written" in Persons Trained; the API now sends `recordVoided` and the screen shows "Voided".
- **Defect 2 (fixed, migration V723):** the year/serial of a LEGACY activity came from the day of the paper training, so `TRN/QA/26-1156` of a 2020 training was logged under 2020; they now come from the number (`yearOf`), and V723 corrects the rows already written.
- **Observation, not changed:** the source file goes through the shared upload validator (same as the single-revision flow: type, structure, ClamAV); a file with a `%PDF` header that cannot be parsed is accepted. Strengthening it touches every upload path and needs its own change record.
- **Observation, by design:** Valid Until of an imported document is counted from the historical effective date, so an old paper SOP can be already overdue for review on the day it is imported; a trainee forgotten on the paper list cannot be added afterwards (a new training is the way).
- **Evidence:** `p7b` 38/38, `p7d` 16/16, `p7e` 15/15, `p8a` 50/50, `p8b` 10/10, `p8c` 8/8, `p8d` 9/9, `p8e` 15/15, `p8f` 4/4, `p8g` 12/12; 307 unit tests of `com.eqms.service.training` and 11 of `LegacyBatchImportFullFlowTest`; front end 392 tests.
- **Left on DEV:** test documents UAT7/UAT8, their activities, the Work Position QC Analyst of `uat31.s1.pass1/pass2`, and raised number counters.

### IMAGE-WATERMARK-2026-11-01: watermark on evidence photos and specimen signatures (owner decisions, 2026-11-01)
- **Scope:** only the evidence photos of a damaged controlled copy and the two pictures of a specimen signature. Configured in Settings > Configuration > Image Watermark, separately for each of the two.
- **Original kept (owner):** the picture as uploaded is stored beside the stamped one, each with its SHA-256; the screens show the stamped picture. The assistant had weighed storing only the stamped picture and advised against it (a stamp can cover part of the evidence or of a signature and cannot be undone).
- **Where the stamp is drawn (owner):** on the server when the file is received, not in the browser, so the uploader and the time cannot be falsified and the API cannot be used to skip it.
- **Specimen signatures (owner):** stamped according to their own settings. Only a PNG or JPEG is accepted for a new specimen (WebP and BMP are refused; earlier rows stay readable). The screens show the stamped picture; the person who compares the strokes (a reconciler, an auditor) can open the original, and each opening is written to the Audit Trail as `TRAINING_SPECIMEN_ORIGINAL_VIEWED`.
- **Preview (owner):** in the Configuration screen (made by the server with the unsaved settings) and in the upload forms (the stamp the saved settings would put on the chosen picture; the time shown is the time of the preview, the real time is that of the upload).
- **Not stamped again:** a change of the settings applies to the pictures uploaded after it is saved; stored pictures are never re-stamped.
- **Defaults:** a purpose never configured keeps the earlier behaviour (evidence: system logo at the top left; specimen: no stamp). Who may open the original of a specimen: the same people who may open the picture (owner and those with the specimen view/manage/confirm rights in scope); the owner may narrow this.
- **Open:** no end-to-end check on DEV (browser, database with V724, real upload); the design of the stamp for a very small picture (text is left out, then the stamp is left out) is the assistant's choice and not yet reviewed by QA.

### ESIGN-ONE-DISPLAY-STYLE-2026-11-01 - a signature is written in one way only: the Standard frame

- **Decision (owner, 2026-11-01):** the electronic signature written on a document uses one frame only, Standard: the signer's name, "Electronically" and the meaning (Electronically approved), then the date and time (`Nguyen Van A / Electronically approved / 01/11/2026 22:54 (UTC+07)`). The Compact and the Detailed frames are dropped everywhere. This replaces the three styles of the owner decision of 2026-10-29 (forms of the Training Annex made from then on use the new styles).
- **What stays on the record, not in the document:** the reason and the signature ID stay on the electronic signature record and in the Audit Trail. A signature that is not signed yet (pending, rejected), and a signed one that lacks the name, the time or the meaning, is still written in full, never shortened (21 CFR 11.50).
- **Placeholders:** a signature placeholder has no style any more. The catalog lists `{{PREPARED_SIGNATURE}}`, `{{REVIEWED_SIGNATURE}}`, `{{APPROVED_SIGNATURE}}`, `{{PUBLISHED_SIGNATURE}}` (group "Signature") and `{{REVIEWER_SIGNATURES}}`, `{{APPROVER_SIGNATURES}}`, with `{{REVIEWER_SIGNATURE_1}}` and the like for one cell per person. The placeholders with no ending that templates already used (`prepared_signature`, `reviewer_signature_1`, `approved_signature`) now give the Standard frame, in the cover template of the system too. A name with an old ending (`..._COMPACT`, `..._STANDARD`, `..._DETAILED`) found in a template that was stored earlier is read as the same placeholder without the ending, so such a template is still filled; no such name was in a template on DEV.
- **Removed:** the enum `SignatureDisplayStyle` (now `SignaturePlaceholderName`, which only strips an old ending); the way of writing a signature as a table of its own in a Word template (a signature is lines of text in its cell or paragraph); the choice of a style for each signature slot of a Training Annex form (API `PUT /training/annex/{code}/slots/{slot}/style`, the selector and its reason window); the endpoint `GET /settings/electronic-signature/display-styles` (now `GET /settings/electronic-signature/display-style`, one sample); the tab "Signature Styles" of E-Sign Config (now "Signature Display", one frame).
- **Database:** V725 drops the table `training_annex_slot_styles` (it was empty on DEV); if a database holds rows, the table is renamed `training_annex_slot_styles_retired` and kept as history.
- **Also fixed:** the PDF preview of E-Sign Config passed its sample under a key that the engine did not read, so it always printed the label of an unfilled placeholder ("Approved signature block"); it now prints the sample signature in the Standard frame.
- **Not changed (open):** the tab "Signature Timestamp" of E-Sign Config: the Standard frame has a fixed form of the date and time (dd/MM/yyyy HH:mm and the offset of the time zone of the signature), as the other frames had.
- **Attendance list of Training (APD.0117), owner answer 2026-11-01 "bring it to Standard":** the column "Signature" of every list, made from a token template or from a template made before tokens, is the Standard frame of the signature record (the person at check-in, or the trainer on their behalf with the line that says so). The status line "Ký điện tử / Signed electronically" is removed: a person whose attendance is not signed (yet) is written "Có mặt / Present". The meaning of an attendance signature stays "Attendance Has Been Taken" whoever took it (Electronically attendance has been taken). Words in capitals in a meaning (QA, DCO) keep their capitals in the frame ("Electronically attendance list sent to QA"). Statuses that do not stand for a signature (Absent, Online, "Read, signed electronically" of self reading, "Not signed, listed only") are unchanged. Evidence: `p9b_attendance_standard.py` 4/4 on DEV.
- **Evidence:** `p9a_one_signature_style.py` 12/12 on DEV (sample, catalog, preview PDF, Annex, the cover of the system on a signed SOP); unit tests `SignatureStandardFrameTest`; related backend unit tests 339 passed (5 Spring-context tests of `TrainingAdministrationPermissionTest` do not start locally without the outbox key, unrelated); front end 428 tests, `tsc` clean.

### SESSION-UNLOCK-MFA-2026-11-02: unlocking an idle-locked session needs the second factor (owner decisions, 2026-11-02)
- **Conflict found (owner):** the system is EU-GMP and signing in needs MFA, but a session locked by Session Timeout was unlocked with the password only. That is a weaker authentication than the one that opened the session, and an electronic signature then rests on that session.
- **Decision (owner):** after the right password the second factor is mandatory (authenticator app or email code, whichever the account uses). A wrong password and a wrong code use the same mechanism as signing in: they count toward Enable Account Lockout / Maximum Login Attempts of Settings > Configuration > Security. Every wrong entry is recorded in the Audit Trail.
- **Assistant choices, to confirm:** one shared counter for the password and the code; the entry that locks the account also ends the session; a trusted device does not skip the code when unlocking; wrong codes at sign-in are now counted and recorded too (before they were not), for consistency with the rule above; an account with no second factor unlocks with the password only, as it signs in.
- **Open:** not run end to end on DEV with a real authenticator and email; the e-signature dialog was not reviewed; the maximum number of attempts is the one setting for sign-in and unlock (no separate value).

### OO-PREVIEW-SETTINGS-2026-11-02: OnlyOffice Preview settings (owner request, 2026-11-02)
- The mode of Pending Review and of Pending Approval is set in Settings > Configuration > Preview File > OnlyOffice Preview: Review Mode or Comment Only, each. Default as before (Pending Review = Review, Pending Approval = Comment Only).
- The read-only OnlyOffice viewer can carry a traceability watermark with the same settings and the same mechanism as the PDF preview watermark (text, strength, colour, angle, viewer code and name, time opened, grid), made by the server at each opening. The assistant chose: it applies to every read-only OnlyOffice viewer (revisions and training files), and the editors carry none. It is a mark drawn by the viewer, not written into the file; a person with the developer tools of the browser could still hide it, unlike the mark baked into a PDF.
- Open: Review Mode for an Approver lets the approver suggest tracked changes that are saved to the file (the save callback already accepts saves at Pending Approval); QA to confirm that this is acceptable when an administrator chooses it.

### IMAGE-WATERMARK-TZ-2026-11-02: time zone of the upload time (owner request, 2026-11-02)
- The upload time on an evidence photo or a specimen signature is printed with its time zone, UTC+7 by default, chosen per purpose (-12:00 to +14:00): 02/11/2026 11:20:43 (UTC+7).

### UCC-NUMBER-2026-11-02: number of an Uncontrolled Copy (owner request, 2026-11-02)
- New rule: UCC.<document number>.<serial>, the Controlled Copy rule with a U in front (UCC.SOP.0007.001). Before: UC-SOP.0007-001. Copies already numbered keep their number: a number is never rewritten. Open: the Audit Trail and the exports show both shapes for the copies made before and after this date.

### OO-EDITOR-COPY-2026-11-02: download and print in OnlyOffice editing sessions (owner request, 2026-11-02)
- To reduce the taking of a document out of OnlyOffice, the Download and Print buttons, the File menu entries and Ctrl+P of an editing session (Edit, Review, Comment Only) can be switched off in Settings > Configuration > Preview File > OnlyOffice Preview (Allow download, Allow print). Both are on until switched off, as before; the read-only viewer never has them. Checked on the Document Server of DEV: off, the print icon is gone and Ctrl+P starts nothing; on, Ctrl+P makes a PDF and downloads it.
- Limit, stated to the owner: it stops the buttons and the shortcut, not a photograph or a screenshot, nor copying the text; text copy is not switched here. The watermark is the measure for the picture of the screen.

### OO-PLUGINS-VERSION-2026-11-02: OnlyOffice plugins and Document Server version (owner decisions, 2026-11-02)
- **Decision (owner):** remove every OnlyOffice plugin except draw.io, and do not let a user install a plugin, to keep the data whole; draw.io works in Edit mode only; update OnlyOffice to the newest version.
- **Done:** the Document Server is now built from `deploy/onlyoffice/Dockerfile`: `onlyoffice/documentserver:10.0.0.1` (was 8.2.3), draw.io 1.0.5 installed once at build time, the Plugin Manager (folder `sdkjs-plugins/marketplace`) removed, and `PLUGINS_ENABLED=false` so a start downloads and installs nothing. The backend offers the Plugins tab only in Edit mode (`OnlyOfficeDocumentEditService`: `customization.plugins`; the read-only viewer keeps its own setting). `deploy/onlyoffice/ds-docservice.conf` is the 10.0.0.1 default with the one EQMS change (the `/info` rule for the private ranges); the old copy of 8.2 was stale.
- **Checked on DEV with a real Document Server 10.0.0.1 (Playwright):** the Plugins tab holds draw.io only, no Plugin Manager; draw.io opens and runs with no request leaving the machine; no Plugins tab in Review and Comment Only; the view watermark draws; Ctrl+P makes no print request when print is off; the backend reads `/info/info.json`.
- **Not checked:** a real login to EQMS and a real revision on 10.0.0.1 (Edit, Review, save callback, co-editing, forcesave), inserting a diagram and saving it into a stored file, the demo site behind ngrok, the other file types (xlsx, pptx). Limits of the Community Edition may differ in 10.x: not read.
- **Open:** draw.io 1.0.5 is the version the marketplace gave on 2026-11-02; there is no update path other than rebuilding the image, which is the intended change control. The text-copy and screenshot limits of OO-EDITOR-COPY still hold. A person in Edit mode can still insert any image into the file, as before.
- **Interface theme (owner, 2026-11-02):** every editor session opens with Modern Light (`customization.uiTheme = theme-white`, `OnlyOfficeDocumentEditService.DEFAULT_UI_THEME`). Limit, tested on 10.0.0.1: the editor keeps the theme a person picked in their browser (`ui-theme-id`), and that stored choice wins over the setting, so the setting decides only for a browser that has not chosen. So the owner asked (2026-11-02) that every opening starts in Modern Light while the person can still pick another theme in View > Interface Theme: `deploy/onlyoffice/ds-docservice.conf` writes `ui-theme-id = theme-white` into the editor page before the editor reads it (nginx sub_filter on the index.html of the document, spreadsheet, presentation, PDF and Visio editors; the page is sent with no-cache). Checked on 10.0.0.1: a browser that stored Classic Light opens in Modern Light. Not checked: changing the theme inside a session and keeping it until reload (by design the script runs only at load); the editors other than the document editor. The theme is reset again at the next opening, so a person cannot keep Dark or Classic Light; this edits the page of the vendor editor, so check it again after each version change.

### OO-ROLLBACK-8.2-2026-11-02: Document Server back to 8.2 (owner decision, 2026-11-02)
- **Decision (owner):** go back from 10.0.0.1 to 8.2. Reason: in the owner's normal browser the editor opened but a person could not type, format or comment, while a private window worked. The cause was not found: the server, the file, the permissions and a browser profile kept across a Document Server re-creation were all checked and worked.
- **Done:** `deploy/onlyoffice/Dockerfile` and `docker-compose.yml` default to onlyoffice/documentserver:8.2 (8.2.3); `ds-docservice.conf` is the 8.2 file again. The rules of OO-PLUGINS-VERSION stay: draw.io 1.0.5 is the only plugin, no Plugin Manager, installed at build time with PLUGINS_ENABLED=false, Plugins tab only in Edit mode. New in the image build: the 8.2 draw.io page is pointed at the scripts of the same server (it loaded them from onlyoffice.github.io); the build fails if an outside address remains.
- **Consequences, stated to the owner:** the Community connection limit of 8.2 is back (20, read from /info/info.json); Modern Light does not exist in 8.2, so the default theme is "Light" (theme-light: DEFAULT_UI_THEME in OnlyOfficeDocumentEditService and the reset script in the nginx include), which looks almost like Classic Light; the interface is the 8.2 one.
- **Checked on 8.2 (Playwright):** the Plugins tab holds draw.io only, no Plugin Manager; draw.io opens with no request leaving the machine; no Plugins tab in Review and Comment Only; a stored theme is reset to Light at each opening; typing in the real EQMS editor as author.test1 works; the view watermark draws; OnlyOfficeViewerSettingsTest passes. **Not checked:** the failing browser of the owner on 8.2 (the failure was seen on 10.0.0.1 only).

### OO-VERSION-9.4-2026-11-02: Document Server 9.4.0.1 (owner decision, 2026-11-02)
- **Decision (owner):** use Document Server 9.4 so that the editor has the Modern Light interface theme (it exists from 9.0). Built from deploy/onlyoffice/Dockerfile (ONLYOFFICE_VERSION=9.4.0.1), draw.io as the only plugin, no Plugin Manager, nginx include = the 9.4 default plus the /info rule and the reset of the theme to theme-white at each opening; DEFAULT_UI_THEME = theme-white.
- **Checked on 9.4.0.1 (Playwright):** the Plugins tab holds draw.io only; draw.io opens with no request leaving the machine; no Plugins tab in Review and Comment Only; a stored Classic Light theme is reset to Modern Light at the opening; the backend reads /info/info.json (the reported connection limit is 2147483647, not tested with more than 20 sessions).
- **OPEN, found while testing, needs an owner/QA decision:** the draw.io plugin inserts a diagram as an OLE object, which Word stores as word/embeddings/oleObject1.bin. RevisionUploadFileValidator (validateSafeOoxmlEntryName) refuses any word/embeddings/ entry (UNSAFE_DOCX_CONTENT), so the save callback of such a file fails, the Document Server keeps the edits as a "forgotten" backup copy, and the next opener sees "This file is opened from a server backup copy and is not saved to storage". Seen on SOP.10411 (revision 814e34bf…) at 17:06 on 2026-11-02: the diagram is NOT in the stored file. Options: (1) keep the rule and insert diagrams as pictures only (the plugin would have to be changed); (2) allow oleObject*.bin under word/embeddings/ produced by the editor, with limits (size, content type, no macros/ActiveX) after a security review; (3) remove draw.io. The validator was not changed.
- **Not checked on 9.4:** the failing normal browser of the owner (the failure was seen on 10.0.0.1); a real login on the owner's machine.

### MENU-COLORS-2026-11-02: colours of the dropdown menu items (owner request, 2026-11-02)
- Settings > Configuration > General > Appearance > Dropdown Menus: the colour of the text and the colour of the icons of the items of every dropdown (action) menu, one setting for the whole system and every user. Stored as appearance.menuTextColor and appearance.menuIconColor (empty = the built-in slate colour), served with the public branding, applied by CSS variables (MenuColorStyles, menu-colors.css) to the card that PortalDropdownMenu marks with data-eqms-menu. Validated on save as a six-digit hex colour only (no free CSS). A red, rose, amber or orange item (Terminate, Delete) keeps its own colour, and a disabled item keeps its dimmed look.
- Checked: unit tests of the validation (MenuColorsConfigurationTest); in the real UI the menu text and icon colours change when the variables are set. Not checked: saving the setting from the Configuration page as an administrator (no administrator credentials in the session); menus that are not built on PortalDropdownMenu (SmartDropdown, ActionDropdown, Select lists) are not covered.

### REVISION-LIST-VIEW-2026-11-02: the row menu of a Draft (owner report, 2026-11-02)
- The row menu of the revision list showed no View entry for any Draft, so a person who may see the Draft but not edit it (for example a QA manager) had an empty menu and no menu button. A Draft the person cannot edit or submit now offers View; the server still decides every other action. Unit test: revisionRowActions.test.ts.

### DEPT-VISIBILITY-2026-11-02: record visibility decided by the Department Head (owner decisions, 2026-11-02)
- Third Record Visibility mode, DEPARTMENT_RULES ("Department rules"), chosen in Document Properties. The two older modes are unchanged and the default stays PARTICIPANTS_ONLY, so nothing changes until an administrator selects it.
- Decision per record (Document, Revision; a Controlled or Uncontrolled Copy follows the Department of its Revision): visible to a holder of the view-all permission; to its participants and a copy's recipient (each switchable: departmentRulesParticipantsAlwaysSee, departmentRulesCopyRecipientAlwaysSees); otherwise only when the user holds the base View permission, the Business Unit / Department scope of their Access Profiles includes the Department, and the Department Head is the user (switchable: departmentRulesHeadSeesDepartment) or the highest-priority applicable rule is an ALLOW. No rule is a refusal (owner decision 1: closed by default). Administrators are not hardcoded: they see everything through the view-all permission.
- Rules: Object Access Rules gain owner_department_id (the Department Head manages them; VIEW only; targets whole Department, Document Type or Status; must name users) and grantee users; two new targets DEPARTMENT and BUSINESS_UNIT for ordinary rules. A Department-owned rule is excluded from the older "any ALLOW rule makes the rest a refusal" evaluator, so it cannot narrow other actions. Ordinary rules of the older targets (category, type, status by name) are not part of this decision.
- Who manages: permission security.object_rules.manage_own_department and being Department.departmentHead of that Department, or security.object_rules.manage for any Department. The permission is granted to no profile by this change; the administrator assigns it through an Access Profile. Create, update and delete are e-signed and audited like other security changes.
- User.department_id (foreign key) added to app_users and kept in step with the Department name when User Management saves a user. Backfill matched exact names only. DEV result: 52 of 62 users with a Department text matched; 10 test users carry the text "Quality", which is not a Department, and stay unlinked; 5520 load-test users have no Department. Nothing was guessed.
- Evidence (DEV, 2026-11-02): 13 unit tests (DepartmentRecordVisibilityServiceTest) and an end-to-end API run, 47 of 47 checks, as DCO (view-all), Department Head, named user and unnamed user on Quality Control: closed default, Head sees all, ALLOW, DENY by status, higher ALLOW over DENY, rule switched off, deleted, list equals detail for every Revision (13) and Document (17), 403 for a user who is not the Head, refusals for empty grantee, bad effect, unknown status, priority out of range and a forged e-signature token. DEV data used for the run was restored afterwards (mode, Department Head, permission link).
- Follow-up the same day (owner: "làm luôn"): Knowledge Base now follows the same decision in this mode (Effective documents are listed through the Document list predicate, so a Deny rule cannot be bypassed); a user's Department is resolved from the foreign key first; Effective Access shows a RECORD_VISIBILITY layer; the per-user data is read once per web request. Checked on DEV, end to end: Controlled Copies (Document Control, 9) and Uncontrolled Copy (Mechanical and Electrical, 1): closed default, Head, ALLOW, higher DENY, unnamed user, list equals detail; Knowledge Base (Quality Control): 0 before the rule, 6 after, 0 after a Deny; Effective Access layer present and false for a hidden record. DEV data restored afterwards.
- NOT checked / open: dashboard counts and search paths other than those above were not changed or reviewed (the dashboard shows aggregate counts only); a Controlled Copy batch view stays limited to view-all holders; the user interface was driven only as far as opening the screen and the form (no save through the browser); GitNexus impact analysis was not available, so call sites of canViewDocument/canViewRevision/canViewControlledCopy and the two list predicates were reviewed by hand; a record detail read can answer 409 CONCURRENT_MODIFICATION when several users open the same record at once (existing behaviour).
- Fixed the same day (owner: "sửa đi"): the Department / Business Unit / Document Type filter of GET /revisions and GET /documents answered HTTP 500 for any name or code (lower() applied to a UUID column, independent of Department rules). The id comparison is now made for text ids only. Checked on DEV: /revisions?department=Quality Control, QC and quality control each return the 13 revisions that the database holds; /documents by name returns 17; an unknown name returns 0 instead of 500. Not changed: /documents does not match a Department by code (only by name).
- Owner decisions 2026-11-03: (1) the Department Head's rules have NO mandatory expiry date; (2) the Business Unit / Department scope of an Access Profile now counts only for the permission that profile grants: in this mode the scope that limits the View of records is taken from the profiles that grant the base View permission, so an unscoped profile that does not grant View (a Training profile, say) no longer lifts the limit, and a scoped profile without View no longer narrows another that has it; profiles that all grant View are still combined as a union (one unscoped profile lifts the limit). Layers between each other stay an intersection (permission AND scope AND rule); a Deny of a higher priority still wins. Only this mode is affected: the two older modes and the other actions keep the former behaviour (ObjectAccessEvaluationService.departmentIdsWithinProfileScope takes the permission code; PermissionEvaluationService.profileGrantsPermission).
- Step 2 of the owner's plan 2026-11-03: two more kinds of grantee for a Department rule, V734: the whole Department (every user whose department_id is the owner Department, so a newcomer is covered without editing a rule) and Positions (every user whose Position name equals a chosen Position, case and surrounding blanks ignored; Positions come from the Positions dictionary, active only, at most 50 per rule). Grantees are a union (any one that fits the user is enough); a Department-owned rule must name at least one kind; the database refuses grantee_whole_department on a rule with no owner Department. The grantee decides only who the rule is for: the base View permission and the profile scope still apply to every grantee, so a Head cannot give more than the administrator allows. Evidence so far: unit tests (3 for the scope per permission, 4 for the grantees), V734 applied on DEV and the constraint checked; the end-to-end run dv_run5.py was written but NOT yet executed (the DEV password variable DEVPW was not available in the session).
- Planned, not built: Access Group (a group of users the Head makes), Document Collection, source of the rule shown in Effective Access and Access Review, a 50,000-document performance measurement, Job Role and the training-assignment read grant (when Training Management starts).
- SUPERSEDED the same day by KNOWLEDGE-SHARING-2026-11-03 (below): the Department Head no longer decides record visibility of Document Control. The Record Visibility setting is back to its two options (participants only / everyone with the View permission) and the third mode "Department rules", its screen under Security & Authorization, its API (/security/department-visibility) and its Document Control code were removed. What stays: the rule structure and tables of this entry (V727, V729, V734) as the store of the sharing below, users.department_id, the permission security.object_rules.manage_own_department (renamed, see below), and the lower(uuid) HTTP 500 fix of the Department / Business Unit / Document Type filters. The step 1 scope-per-permission change was removed with its only user (Document Control legacy scope keeps the union over all profiles, unchanged).

### KNOWLEDGE-SHARING-2026-11-03: the Department Head shares the Knowledge Base from the Knowledge explorer (owner decisions, 2026-11-03)
- Owner request: Document Control is authorized as before (Access Profiles, scope and the two Record Visibility options, including "only the people named in the document, revision or copy"). Who sees a Department's Effective documents in the Knowledge Base is decided by that Department's Head, Google Drive style, by right-click > Share in the Knowledge explorer: the Department folder, a Document Type folder inside it, or one document.
- Owner decisions (asked, answered): (1) hidden by default also in the user's own Department; the Head shares with other Departments or with "Everyone"; (2) the person only needs the Knowledge permission (self_service.knowledge.view) because only Effective documents are shown; (3) no e-signature, the Audit Trail is enough; (4) an exclusion ("Exclude this person") exists; (5) the new setting starts off (today's behaviour) and is switched on when the Heads are ready.
- Setting: Document Properties > Knowledge Base Visibility, knowledgeVisibilityMode OWN_DEPARTMENT (default; a user sees the Effective documents of their own Department, as before) or SHARING. A holder of the view-all permission always sees every document. In SHARING a user sees an Effective document only when its Department Head shared it with them (or they are that Head) and they hold the Knowledge permission. The Business Unit / Department scope of Access Profiles is a Document Control concept and does not apply here.
- Shares are Object Access Rules owned by a Department (VIEW only), shown only in the explorer (the administrator's Object Access Rules screen ignores them). Target: the Department, a Document Type of it, or one document; inherited downward, so a share of the Department reaches its types and documents. Grantees (a union): specific users, Positions, other Departments (V735), everyone of the owner Department, everyone (V735). Priority: a narrower item ranks above a wider one; an exclusion (DENY) ranks above every share. The Head sees all documents of the Department they head.
- Who may share is permission-driven: security.object_rules.manage_own_department (renamed "Share Knowledge Base of Own Department", granted to no profile by default) and being Department.departmentHead of that Department, or security.object_rules.manage for any Department. The server decides what a folder is from the Knowledge hierarchy: only a folder whose path fixes a Department (and, optionally, a Document Type) can be shared; a folder split by another field says why it cannot.
- The Knowledge preview page now opens the PDF through GET /documents/knowledge-portal/documents/{id}/preview, which follows the Knowledge Base visibility (the Document Control preview used to decide and would have refused a shared document or opened an unshared one by link). In SHARING a document the user may not see is answered as if it did not exist; the watermark and the preview audit entry are kept; in OWN_DEPARTMENT the Document Control preview rules apply exactly as before.
- Audit: creating and removing a share are written to the Audit Trail (entity OBJECT_ACCESS_RULE: item, effect, people).
- Owner decisions the same day (asked, answered), what is NOT built and why: Job Role as a grantee is not needed (a person is appointed to a position only after the training is completed; for self-reading training the Trainer shares the document with the trainees); Access Group is not needed (the Share dialog already covers users, Positions, Departments, the whole Department and everyone); Document Collection is dropped (the Department > Document Type > document folders and sharing one document cover it); the 50,000-document measurement is dropped.
- Oversight for the administrator (built the same day): Security & Authorization > Access Review > tab Knowledge Shares lists every share of every Department (filters: text, Department, effect; paged on the server) and "Check access" explains, layer by layer, why one user can or cannot see one document in the Knowledge Base (Effective Access of the Knowledge Base: listed, view-all, visibility setting, Own Department or the Head / share / exclusion that decided, and the deciding share). Viewing needs security.access_review.view; removing a share on behalf of the Department Head needs security.object_rules.manage and the Audit Trail entry says it was made by an administrator, on behalf of the Department Head. The Head is not notified (not decided).
- Owner decision 2026-11-04 (who may share for training): the person designated as DCO may share the Knowledge Base of ANY Department, so that a document can be given to trainees for self-reading training. It is a permission, not a role name: security.object_rules.share_knowledge_any_department ("Share Knowledge Base of Any Department", V736), granted to no profile by default; the administrator assigns it to the profile of the person designated as DCO. Its holder, like the holder of security.object_rules.manage, can share, exclude and remove the shares of every Department; the Department Head keeps sharing his or her own Department with security.object_rules.manage_own_department. When someone other than the Department Head removes a share the Audit Trail names that person ("by <name>, who is not the Department Head"). A share made this way is owned by the Department of the item and shows in Access Review > Knowledge Shares with the name of who made it. The Department Head is not told.
- Owner requirement 2026-11-04 (search in the explorer): the central search box finds only documents the user may see in the Knowledge Base, decided on the server. Every search path (browse, search all, search by collection, the new suggestions) reads only DocumentService#visibleKnowledgeEntries(), the same list that decides what the user can browse and open, so a document that is not visible is neither listed nor suggested, whatever its name. Auto-complete: GET /documents/knowledge-portal/suggest?q=&limit= (2 characters or more, at most 10 lines, number that starts with the text first, then a name that starts with it, then the rest), asked by the box 250 ms after the last key press (a newer request cancels the older one); a drop-down shows number, name, revision, Department and type; arrow keys, Enter (open the highlighted document, or search all documents when none is highlighted), Escape; the last row searches all documents for the typed text. When nothing visible matches the box says "No document you can open matches ..." and names none. The existing full search is unchanged (3 characters or more, paged on the server).
- Owner decisions 2026-11-04 (Head of Unit, delegates, links; asked, answered; V737, V738): (1) A Business Unit has a Head of Unit (business_units.head_of_unit_id, set on the Business Units screen like a Department Head). The Head of Unit sees all documents of the Unit in the Knowledge Base and may share the whole Unit folder and everything inside it (every Department, Document Type, document); a Department Head only his own Department. Same permission as the Department Head (security.object_rules.manage_own_department) plus being named. A share of the whole Unit is a rule owned by the Business Unit (owner_business_unit_id); "Everyone in the Unit" means the users whose Department belongs to the Unit. (2) A Head may name delegates (knowledge_share_delegates): a Department Head for that Department, the Head of Unit for the whole Unit (or a Department). A delegate shares and makes links like the Head, takes away only what he made himself, never excludes (an exclusion always wins and would undo what the Head shared), never names other delegates, and must give every link an expiry. Each share, removal or link by a delegate is written to the Audit Trail and e-mailed (type knowledge-share-notification) to the Department Head, else the Head of Unit; if neither is named only the Audit Trail and the log know. The Heads see who may share with a "Can share" badge. (3) Who removes what: a share and a link carry the level of who made them (ADMIN, UNIT_HEAD, DEPARTMENT_HEAD, DELEGATE); somebody of the same or a higher level over the owner removes it, a delegate only his own; the Head of Unit removes what a Department Head made, a Department Head never removes what the Head of Unit made, the administrator and the person designated as DCO remove everything. Shares made before V737 count as made by a Department Head. (4) Links (knowledge_share_links, link redemptions): to the folder of a Unit, of a Department, of a Document Type of a Department, or to one document, with an expiry of 1, 7, 30 or 90 days (a Head may also choose none). The token is shown once; only its SHA-256 is stored. A signed-in user holding the Knowledge permission who opens it is recorded (redemption) and given what it points to until it expires or is revoked: the visibility decision reads the usable links a user opened, so lists, search and preview agree, and an exclusion of the Heads is never undone by a link. A wrong, revoked or expired token gets the same answer. Opening, making and revoking a link are audited. A link opens nothing while Knowledge Base visibility is Own Department. A folder link opens the explorer at that folder when the hierarchy can express it (Business Unit, Department and Document Type must follow each other), else the person is told they now have it. (5) The explorer route now also accepts the Knowledge permission (self_service.knowledge.view), so a person who holds only that can open a folder link.
- Evidence 2026-11-04: V737 and V738 applied on DEV, backend and frontend rebuilt and running; 98 backend unit tests of this area (authority levels, who removes what, shares of a Unit, delegates, links, visibility with Unit and links) and 75 frontend Knowledge tests pass; the whole frontend suite passes but one earlier failure (usagePurpose). The end-to-end run dv_run6.py now has K1-K18 (K16 Head of Unit, K17 delegates, K18 links); NOT yet executed (no DEVPW). The e-mail itself was not sent or received in any test: only that the notifier is called with the Heads, and that the template exists.
- NOT done / open: the administrator's Access Review > Knowledge Shares tab lists shares but not links, so an administrator cannot list or revoke a link from there (the Heads and delegates do it in the Share dialog); no notification to the delegate when named or removed; a link to a folder does not give browsing across other folders (only what it covers).
- Evidence so far (DEV, 2026-11-03): V735 applied, backend and frontend rebuilt and running; 17 unit tests of the single-document decision, 5 of the object access evaluation, plus the related suites; 279 frontend tests (explorer sharing tests included); tsc clean. The end-to-end API run dv_run6.py (scenarios K1-K10) is written but NOT yet executed: the DEV password variable DEVPW was not available in the session. The earlier end-to-end evidence of this folder (dv_run1-4, REPORT.md 416/419) tested the superseded design and stays as a record only.
- NOT done / open: the Department Head is not told when an administrator removes a share; no expiry on a share (owner: not required); the Knowledge Base still loads the visible documents and filters them in memory (not measured; owner dropped it); Controlled Copy batches and legacy import were not exercised. Who may share for training is decided (the person designated as DCO, see above); the Knowledge Base still filters the visible documents in memory, so the suggestions read the whole visible list on every request (not measured).

### SUBMIT-BY-AUTHOR-2026-11-03: Complete Editing retired; the Author submits for review (owner decision, 2026-11-03)

- Owner request: remove the "Complete Editing" button and the permissions that belong to it; the Author submits the Draft revision for review; if the business later wants Document Control (DCO) to submit, it is done by ticking the right again, not by a deploy.
- Owner decision on the PREPARED e-signature (asked, answered "bỏ PREPARED, chỉ giữ chữ ký Submit"): the PREPARED signature is no longer collected. Submit for Review records one e-signature, SUBMITTED_FOR_REVIEW, of the person who submits. Publish no longer asks for PREPARED. The placeholder {{preparedSignature}} (and its aliases) prints the SUBMITTED_FOR_REVIEW signature when the revision has no PREPARED one; a revision that already has a PREPARED signature keeps printing it.
- What Submit for Review now does (was Complete Editing): the source file must exist, then the source is locked (editingStatus COMPLETED, sourceLocked true) in the same transaction as the signature and the status change; open OnlyOffice sessions are flushed before and closed after. The state rule is only "status is Draft"; a Draft locked by the old step can still be submitted.
- Who may submit is data: policy SUBMIT_FOR_REVIEW (Draft) has the Author as its actor (V730) and is gated by documents.revision.submit_review. Every permission set that held documents.revision.complete_authoring now also holds documents.revision.submit_review, so the Authors keep their ability. To let DCO submit, add the DCO Access Profile (or a permission) as an actor of that policy in Workflow Authorization and give DCO's permission set documents.revision.submit_review; no code change.
- Removed: action COMPLETE_AUTHORING and its policy, permission documents.revision.complete_authoring (and its links and dependencies), endpoint POST /revisions/{id}/complete-editing, the capability completeAuthoring and canCompleteEditing, the "ready for submission" notice to DCO that Complete Editing sent, the button and modal in the revision screen. Audit and e-signature history of earlier Complete Editing actions is kept as it was.
- NOT decided / open: whether an Author who submits their own revision needs a second person to check it (the reviewers still do) is unchanged; the e-mail template "document-ready-for-submission" and the notification type stay in the catalog but are no longer sent; As-Is SDS documents under docs/as-is-sds still describe Complete Editing (they record the earlier source); GitNexus impact analysis was not available in this session, so callers were found by search and compile.

### FORCE-PUBLISH-RELATED-2026-11-03: Force Publish when a Related Document is not ready (owner decisions, 2026-11-03)

- Owner request: the rule "a revision cannot publish while a Related Document has a revision in progress that is not Ready for Publishing" was the owner's own decision from the start; the owner now wants an option to publish anyway (Force Publish), and the warning must list the exact Related Documents with their revision numbers.
- Owner decisions (asked, answered): anyone who may Publish may force (no new permission); the Related Documents that are not ready are left untouched and keep their own revision in progress.
- Behaviour: in the Publishing Workspace, Publish first asks the server which Related Documents are not ready (GET /revisions/{id}/publishing-workspace/related-blockers). If there are none, the e-signature step opens as before. If there are some, a warning lists each one as "number - name", "Revision x · status", with Cancel and Force Publish. Force Publish opens the same e-signature step (title "Force Publish Revision to Effective", the not-published documents listed among the changes); the reason and the signature stay mandatory.
- The choice is part of the signed command: forcePublishRelated is stored in the command payload, the bundle that is confirmed leaves the not-ready documents out, and execution re-reads the same state; if a Related Document became ready or changed in between, the confirmation is stale and must be signed again. Without the flag, the same refusal as before is raised (now with the exact list, also on the confirmation step that used to answer only "Related documents are not ready for publishing").
- Audit: a FORCE_PUBLISH_RELATED_NOT_READY entry on the revision names every document left out (number, name, revision number, status) and the reason.
- Not changed: the direct publish of controlled document templates (RevisionListView, DetailRevisionView, DetailDocumentView) keeps the hard block; its warning now also shows the document name and revision number because the server message carries them. Which Related Documents publish together is unchanged (resolveRelatedPublishBatch).
- NOT checked / open: a full Force Publish carried through to Effective in the browser was not run (it would publish a DEV revision); it is covered by unit tests of the bundle capture (with and without force) and by driving the screen up to the e-signature step. GitNexus impact analysis was not available. A document left out stays a Related Document of the published one, so the published document can point to a Related Document that is not effective yet.

### PUBLISHING-PAGE-SETUP-2026-11-03: the body takes the page of the Publishing Template (owner report, 2026-11-03)

- Owner report: pages 2 onward of a published or previewed PDF were larger than the cover, although the same kind of file was uploaded, and the header frame was narrower than the full-width header of the template; the footer was right.
- Found on DEV with the real files: the template (header, footer, cover) is A4 (11907 x 16840 twips, left margin 1418, right 851, header table fixed at 9636 twips = its text width); the body keeps the page of the author's own file, which was Letter, so pages 2-12 were Letter next to an A4 cover and the 9636-twip header sat in a different text area.
- Rule now: when the header/footer template is merged, every section of the body takes the template's page size and left/right margins (gutter 0); a landscape section keeps its orientation (sides swapped) and its margins; a template without a portrait page size leaves the body as it is. Top and bottom margins stay the author's. Controlled copies use the same composition.
- Effect to know: an author's body written for another page size is re-flowed to the template's page (A4), so tables with a fixed width wider than the template's text width can be clipped. Already published PDFs are not changed; a revision shows it after Regenerate Preview (Draft/Ready) or Regenerate PDF (Effective).
- NOT checked: the rendered PDF of the owner's Data Integrity document (it is published; regenerating a published PDF was not done); verified with the real header/footer files on a Letter body that the merged document is 11907 x 16840 with left 1418 and right 851, and by unit test.

### MANUAL-NUMBERING-2026-11-03: Document Number and Training Number typed by hand (owner decisions, 2026-11-03)

- Owner request: the person creating a Document types its Document Number and Training Number instead of the system generating them; the screen warns at once when the number is already used; the rule of a typed number comes from the configuration; the owner asked for the design first, then answered five questions.
- Owner decisions: (1) one switch for the whole system, in Document Properties (Document Number entry and Training Number entry, each AUTO or MANUAL; AUTO stays the default and today's behaviour); (2) whoever may create a Document may type the number (no new permission); (3) a Document Number can be changed only while the Document is a Draft with no source file stored in any revision (the storage keys carry the number), and a Training Number only until the training opens (status Reserved or Planned); (4) no richer format: the only shape is the one the generator issues today, Document Type code + "." + exactly "Digits of the Serial Number" digits; (5) a Training Number of another year is a warning, not a refusal.
- Document Number rule: starts with the Document Type's short code (upper case) and ".", then exactly the configured digits; not already used by any Document in any status (a cancelled Document keeps its number), compared without regard to case. A serial more than 10 past the next one the generator would issue is a warning. The next number is suggested only when it fits the configured digits.
- Training Number rule: TRN/<department code>/<YY>-<NNN to NNNNNN> (SOP.0003 5.1.4); the department code must be the code of the department that organizes the training; not already used by a training activity or a revision (any case). A typed number raises the counter of its department and year like a number typed from a paper log, so the numbers the system issues go on after it. These rules are not configurable in Document Name Formats; the Training Number has no configuration in the two screens named by the owner.
- Where the person types and changes: New Document, General tab (Document Number) and Training tab (Training Number, when Requires Training is ticked). A saved number shows a Change action only while the server allows it; a change needs a reason, goes to the Audit Trail (DOCUMENT_NUMBER_CHANGED, TRAINING_NUMBER_CHANGED, old and new value) and updates the copies of the number held by the Draft's records. The server repeats every check at save, and the unique indexes remain the last guard against two people typing the same number. A typed number sent while the mode is AUTO is refused, and in MANUAL a save without one is refused.
- Where the system still gives a Training Number in MANUAL mode: a training created without the New Document screen (for example by upgrading a revision, or a document that goes with the Training Number of a related document) still gets its number from the system; it can then be changed by hand until the training opens.
- NOT decided / open: a Document Number or Training Number that is replaced by a change is free again (the old value stays in the Audit Trail only; the existing rule that a cancelled number is never reused covers cancelled records, not replaced ones); the numbers of Documents created by Legacy Import keep their own rule and permission; GitNexus impact analysis was not available. A DEV test Document (SOP.7778, "NUMTEST manual numbering", Draft) was created while checking and cannot be deleted (regulated record protection): cancel it.
- Follow-up the same day (owner request): the setting "How the Training Number is given" moved from Document Properties to Training Properties (tab Document Training), because it is a Training Management setting: it is saved with the other training settings (version-checked, audited as "How the Training Number is given: AUTO -> MANUAL", training.settings.manage) in the new column training_settings.training_number_entry_mode (V732, which also carries over and removes a value saved earlier under Document Properties). The document screens ask GET /training/numbers/mode. Both "how the number is given" settings are now radio buttons (Automatic / Manual). In Document Properties the Record Visibility select lost its outer border. Checked on DEV: Training Properties shows the two radios; the setting saved and read back through the API as MANUAL, then restored to AUTO.

### PUBLISHING-TEMPLATE-FREE-EDIT-2026-11-03: Publishing Templates without versions or a publish step (owner decisions, 2026-11-03)

- Owner request: Publishing Templates need no version management: create, edit and save is enough, there is no Publish, and several templates may be Active at once for the user to choose from.
- Owner decision (asked, answered): a template that was already used to publish documents may also be edited freely in place; every save is audited. Consequence accepted by the owner: PDFs already published are stored files and do not change, but a Controlled Copy created later is composed from the template as it is then, so it can differ from the published original; a Revision preview made before an edit is shown as stale and has to be generated again.
- Behaviour: a new template starts Inactive; Save Changes saves in place (no version number, no snapshot); Activate / Deactivate (list action or the Status field) works for each template on its own, with no other template being retired; a template can be Active only when it has the files its Publishing Mode calls for. Removed: Publish Template, Create New Version, version history, the Version and Published columns and the read-only banner of a published template, and the endpoints /versions, /new-version and /publish. The Publishing Workspace offers every Active template and keeps the one a Revision already used.
- Audit Trail entries (PUBLISHING_TEMPLATE_*): CREATED, UPDATED (with the fields that changed), ACTIVATED, DEACTIVATED, DUPLICATED, FILE_UPLOADED, FILE_DELETED, DELETED. A template used to publish a document can still not be deleted, only left Inactive.
- Existing data: the version snapshots and the version number of existing templates stay in the database and are no longer shown; placeholder styles stay with the version number their template has (no longer changes).
- NOT decided / open: the old PDF/Controlled Copy equality guarantee is gone (see above); the content of an edited template is not kept, only that it was saved and which fields of the template record changed (the uploaded files themselves are replaced); GitNexus impact analysis was not available.
- Database: V733 drops the unique index uq_publishing_templates_single_live (V478) that allowed one Active template only. Checked on DEV: both templates Active together; the old /publish endpoint answers 404; the list has no Version or Published column.

## KNOWLEDGE-VISIBILITY-MODES-2026-11-04 - four modes of Knowledge Base visibility; the named Head is the Head
- Owner decisions 2026-11-04 (asked, answered): (1) Knowledge Base visibility (Document Properties) has four modes: OWN_DEPARTMENT (default, unchanged), OWN_BUSINESS_UNIT (a user sees the Effective documents of every Department of the Business Unit their Department belongs to), ALL (every Effective document of the system) and SHARING (what the Heads shared; closed by default). A holder of the view-all permission sees everything in every mode. (2) Only SHARING has anything to share: in the other three there is no Share menu and the sharing API refuses (the controller answers 403 and /managed lists nothing); shares already made are kept and apply again when SHARING is switched back on; links open nothing outside SHARING. (3) Who is a Head is decided by Dictionaries alone: the person named Department Head on a Department or Head of Unit on a Business Unit may share what he or she heads, with no permission to assign. Only the administrator edits Dictionaries (settings.department.manage, settings.business_unit.manage), so naming a person is the grant. The administrator and the person designated as DCO keep their permissions (security.object_rules.manage, security.object_rules.share_knowledge_any_department).
- Removed: the permission security.object_rules.manage_own_department ("Share Knowledge Base of Own Department", V727, V735) and its use in KnowledgeShareAuthorityService; migration V742 deletes it with its set items and dependencies (it was granted to no profile by default on DEV).
- Mechanism: DocumentService#visibleKnowledgeEntries is still the one list that browse, search, suggest and preview read; OWN_BUSINESS_UNIT and ALL filter it by Business Unit or not at all, and a direct open (previewKnowledgeDocumentFile) follows the same list for those modes. Effective Access (Access Review) explains the mode and compares Business Units.
- Risk accepted: because naming is the grant, anyone allowed to change a Department Head or Head of Unit in Dictionaries decides who may share a Department or Unit; every change of a Head is already in the Audit Trail of the dictionary record.
- Evidence: unit tests KnowledgeShareAuthorityServiceTest (named Head without any permission), KnowledgeSharingControllerTest (no sharing outside SHARING), KnowledgeShareOversightServiceTest (Business Unit and All). Not exercised with real accounts on DEV.

## KNOWLEDGE-VIEW-ALL-2026-11-04 - the Knowledge Base has its own "view all"
- Owner decisions 2026-11-04 (asked, answered): (1) A new permission self_service.knowledge.view_all ("View All Documents in the Knowledge Base", V743) lets its holder see every Effective document of the Knowledge Base in every visibility mode, and it wins over an Exclude of a Head (a person who audits the system, such as the DCO or compliance, must see everything; the Heads cannot hide a document from them). It is granted to no profile by default; the administrator assigns it through an Access Profile. View Knowledge (self_service.knowledge.view) is still needed to open the Knowledge Base. (2) The Knowledge Base no longer uses the Document Control permission documents.document.view_all: that permission shows nothing more in the Knowledge Base, and the new one changes nothing in Document Control. (3) The visibility setting stays: it is the rule for everybody who does not hold the new permission; the permission is an exception for a few people, never a restriction.
- Mechanism: DocumentService#visibleKnowledgeEntries (the one list that browse, search, suggest and preview read) skips the mode filter and the sharing decision for a holder; Effective Access (Access Review) shows the permission as the first layer. The screen Document Properties > Visibility says so.
- Risk accepted: a Head's exclusion does not reach a holder; who holds the permission is visible in Access Profiles / Permission Sets and in the Audit Trail of those changes.
- Evidence: KnowledgeShareOversightServiceTest (holder sees everything in every mode; the Document Control view-all does not). Not exercised with real accounts on DEV.

## DC-VISIBILITY-TIERS-2026-11-07 - Document Control visibility by three kinds of person (DESIGN, nothing built)
- Owner decisions 2026-11-07 (asked, answered): (1) Knowledge Base is the reading channel for Effective documents; Document Control is the working channel; the Knowledge Base route no longer needs documents.module.view. (2) Three kinds of person: participant (sees only what has their name), observer (holds the view-everything bundle: sees all, acts only where named) and operator (holds operational permissions; NOT tied to the DCO profile, anyone may be given them). (3) Records follow a permission only: whoever holds documents.form.view_executed_records sees and works with all Records; a Record has no flow. (4) The 5 profiles that hold documents.uncontrolled_copy.view_all without documents.document.view_all (Approver Lead, Approver Test, Quality, UAT Approver - Quality, UAT Document Contributor - Quality; 9 users on DEV) lose that permission. (5) The three view-all permissions are one bundle with a dependency; an Access Profile shows a label computed from its permissions (never typed), named Visibility to avoid the business-unit/department scope. (6) Draft to Ready for Publishing revisions stay closed to everyone but participants and view-all holders; no switch opens them.
- Not decided / open: whether the view_executed_records permission is withdrawn from non-DCO profiles when it becomes "see all Records" (20 profile-user assignments would otherwise widen); whether approvers of Uncontrolled Copy requests still need to see other people's requests; copy requests by a person with no name in the document flow; Calendar gate. Out of scope for now: state matrix that opens Effective documents to a population, temporary inspection access, per-document sharing.
- Plan: docs/plans/KE_HOACH_PHAN_QUYEN_DOCUMENT_CONTROL.md. GitNexus impact analysis was not available when the plan was written.
- Refinement the same day (owner, asked, answered): visibility has only TWO cases, not three: a person with a name in the flow sees exactly that; a person ticked with the view-everything bundle sees everything, drafts included (accepted; someone who only needs Effective documents uses the Knowledge Base or the status filter). Operations (publish, distribute, recall...) are a separate layer of permissions, not a visibility tier and not tied to the DCO profile. Note: permission_dependencies is reference data only (only the cycle check reads it), so the bundle is delivered as a Permission Set; a mixed tick is warned, not blocked.
- Open questions answered the same day (owner): (a) view_executed_records is withdrawn from the non-DCO/Admin profiles in the same release, on a list the owner approves first; (b) approvers of Uncontrolled Copy requests see only the requests waiting for them once the view-all permission is withdrawn; (c) a person with no name in the flow does not request copies themself: an operator requests for them, as today; (d) Calendar keeps its current gate. Step 1 built 2026-11-07: (e) the Knowledge Base Explorer route needs only self_service.knowledge.view (ProtectedRoute accepts ANY listed permission, so before this a holder of documents.module.view alone could open the page); (f) the server now refuses the Knowledge Base without self_service.knowledge.view (DocumentService#visibleKnowledgeEntries and #previewKnowledgeDocumentFile, which in Own Department mode used to hand over to the Document Control preview and never asked for it); owner rule: the administrator always ticks this permission when creating a user. Effect on DEV: about 28 test/UAT accounts (Author Test, Reviewer Test, Co-Author Test, Training Trainee/Trainer, ...) do not hold it and now get a refusal if they call the Knowledge API. Evidence: KnowledgeServerPermissionTest (view-all and Document Control permissions do not replace it), Knowledge unit tests, ProtectedRoute.knowledgePermission.test.tsx. Not exercised with real accounts. Open: folder-styles, document-type-icons and default-determinator answers (names, colours) still need only a login.
- Built 2026-11-07 (deployed to DEV, not exercised with real accounts): (g) V745: the existing set PS_DOCUMENT_VIEW_ALL is the view-everything bundle (renamed, plus the four base view permissions); Uncontrolled Copy view-all withdrawn from ROLE_APPROVER_LEAD, PS_APPROVER_TEST, ROLE_QUALITY, PS_DOCUMENT_APPROVER, PS_UAT_DOCUMENT_APPROVER, PS_UAT_DOCUMENT_CONTRIBUTOR (9 users); Records permissions withdrawn from PS_UAT_CONTROLLED_COPY_REQUESTER (shared with DCO), PS_APPROVER_TEST, PS_DOCUMENT_SECURITY_ADMIN, PS_UAT_CONTROLLED_COPY_RECIPIENT, PS_DOCUMENT_READER and given to ROLE_DOCUMENT_CONTROLLER; after it only the DCO, DCO Test, Document Controller, UAT DCO - Quality, Administrator and Admin-without-maintenance-bypass profiles hold view_executed_records and the Uncontrolled view-all (checked in the DEV database). The migration ran on DEV when a Spring-context test started, before the deploy. V746: text of the four permissions. (h) Records are permission-only (ExecutedRecordService): the permission shows every Record, download needs view and download. (i) Uncontrolled Copy approvers see requests in status REQUESTED without the view-all. (j) The Document Control menu is built per person (DocumentControlMenuAccess, NavigationService): a group needs its permission AND the matching view-all or a name in that flow (author, co-author, reviewer, approver, recipient; removed roles only with the retain toggle); when the signed-in account cannot be loaded the menu follows permissions alone. (k) Access Profile list and detail carry documentControlVisibility (VIEW_EVERYTHING, INCOMPLETE, NAMED_IN_FLOW), computed from the permissions; the Permissions tab ticks the three view-all together and warns on a partial bundle; the profile wizard ticks self_service.knowledge.view by default. NOT done / limits: GitNexus impact analysis was not available; Sprint10AuthorizationHardcodeRegressionTest.navigation_withoutPermissionsGetsEmptyMenu already failed before (the Calendar entry is always present) and SelfServiceHomePageAndPermissionTest cannot start a context here (notification encryption key); the effect on a real menu and on the lists was tested with unit tests only.

## AUDIT-TAB-FOLLOWS-SCREEN-2026-11-07 - the Audit Trail tab has no permission of its own
- Owner rule 2026-11-07: by default a person who can open the screen that carries an Audit Trail tab can read the whole tab; there is no separate permission to view the tab.
- Already so before (AuditTrailService#requireEntityAuditView): Document, Revision, Controlled Copy, Controlled Copy Distribution Batch and the Training records. Added now: Uncontrolled Copy (UncontrolledCopyService#canViewAudit, the same test as its detail), Access Profile (security.access_profiles.view/update/assign), Permission Set (security.permission_sets.view/update), Restore request (backup.module.view). Any other kind of record is no longer read as a Revision (which failed for everyone with "Revision audit access denied"): it needs the global Audit Trail permission.
- NOT changed: the per-row actions of the tab, "View Details" (opens the global Audit Trail record page) and "Export", still need the global Audit Trail permission (audit.view / audit export); the owner did not ask for them. Not exercised with real accounts: unit tests in AuditTrailServiceTest only; the four tabs above were read from the code to fail before (not run).

### DC-VISIBILITY-RUN-2026-11-07 (owner instruction in the session: test every Document Control object, fix at once)
- Evidence: eqms-backend/docs/validation/evidence/dcv_2026_11_07/REPORT.md (148 checks on DEV with 7 new test accounts, DEV_TEST_DOCUMENT_CONTROL_ACCOUNTS_2026_11_07.sql).
- Fixed: visibility label on the Access Profile detail page; wizard checkbox wording.
- Open for owner decision: F1 creator/operator not ticked cannot see own document; F2 who may start a new revision; F3 generate and distribute of Uncontrolled Copy share one permission.
- Not changed: the global Audit Trail module permission (owner will rework it).
- 2026-11-08 follow-up: opening a revision follows documents.workspace.manage instead of view-everything (operation is not a visibility tier); Author may start a new revision by holding documents.revision.upgrade; Access Profiles migration banner counts active users only. 'Creator always sees own document' was considered and dropped (the creator is a DCO who holds view-everything).

- DC-VISIBILITY-RUN-2026-11-07 follow-up 2026-11-09: owner decision -- the creator of a Document always sees it and its revisions; Co-Author sees what they are named on; "view everything" is the way to see all. Evidence: `eqms-backend/docs/validation/evidence/dcv_2026_11_07/REPORT.md` (Follow-up 2026-11-09).

- SEC-CLEANUP-2026-11-09: owner approved (1) drop table permission_dependencies (V747), (2) display flag test_data on Access Profiles and Permission Sets (V748, V749), (3) one Engine Diagnostics page with four tabs, (4) Action Matrix as default tab of Workflow Authorization. Evidence: `eqms-backend/docs/validation/evidence/dcv_2026_11_07/REPORT.md` (Cleanup 2026-11-09).

## AUDIT-MODULE-FROM-MENU-2026-11-08 - the Audit Trail shows the sidebar's level-1 menu as the Module (owner instruction, DEV only)
- Owner decision 2026-11-08 (asked, answered): the Module of an audit record is the name of a level-1 menu of the sidebar (Document Control, Training Management, Reports & Analytics, Audit Trail, Backup & Restore, Security & Authorization, Application Settings, System Administration, Notifications, Self-Service). The detail page of a record is redesigned (what changed first; signature, who and where after; technical data folded).
- Built: com.eqms.util.AuditMenuModule maps every stored entity_type (all 87 found on DEV, including the old spellings) to a menu; sent as metadata.menuModule on the list and the detail response. The stored entity_type and the existing `module` field are NOT changed: the /entity/{module}/... routes and the module filter still use them; the menu name is a label only. An entity type nobody placed shows as "Other". Test: AuditMenuModuleTest (plain unit test, no database).
- Grouping rule chosen by the assistant, OWNER/QA TO CONFIRM: an object goes to the area it belongs to, not to the screen that administers it (Training vendors, codes, settings -> Training Management; Report definitions/types/name formats -> Reports & Analytics; Backup policy/target -> Backup & Restore; copy policies and Publishing Templates -> Document Control; Knowledge Base objects -> Self-Service; login sessions, users, roles, profiles, permission sets, workflow action policy -> Security & Authorization; Email Templates and System Announcements -> Application Settings; Settings, System Configuration, E-Sign settings, storage objects -> System Administration; Notifications -> Notifications). A different grouping is a one-table change in AuditMenuModule.
- Not changed: the CSV export still writes the old Module value; the list columns, filters and the hidden-by-default idea for View/Login/Email events (proposed, not built); AUDIT_TRAIL_STANDARD.md section 3 is updated to describe the new Module.
- GitNexus impact/detect_changes were not available in this session; blast radius checked by search: mapModule and the module filter are untouched, two metadata.put lines added in AuditTrailService.
- 2026-11-09 follow-up (owner instruction, asked and answered): the Audit Trail "Why" shows only text a person really typed, never the system's own comment. audit_logs.reason/comment hold system text (67,230 of 67,292 unsigned rows with a reason had reason = comment), so a new column audit_logs.user_reason (V751) holds the typed text, written through AuditTrailService#logAsWithUserReason and sent as metadata.userReason. A signed record shows the signer's reason in the signature card (the signature always carries one).
- Phase 1 (owner chose): Document Control. Wired: Cancel Document (Activity Summary). Found signed already, so their typed reason is the signature's: Obsolete, Reopen, Revision cancel, Controlled/Uncontrolled Copy request/cancel/recall. NOT wired yet (phase 2, after the owner reviews phase 1): Training, Security, Backup and the other services that write audit rows (263 call sites in 57 files). Older rows keep an empty user_reason (immutable audit log).

## BACKUP-RESTORE-SIMPLIFIED-2026-11-09 — One restore flow with no in-software approval; electronic signature; rollback until QA finalizes

Owner decisions, given in this conversation (2026-11-09). Design: `docs/to-be-sds/backup-restore/SDS-BR-003-co-che-backup-restore.md` (proposal, not yet built).

- **No approval steps in the software.** Who may restore and when is decided by the organisation on paper. The software records who did what, when and why. The request / approve / reject / second-person verify flow of SDS-BR-001 sections 9, 10 and 11.3 is not to be built further.
- **Restore needs an electronic signature** (Part 11 signature, with a typed reason), by the person who runs it. Not only a password re-entry.
- **Restore mechanism:** Database is replaced by building a new database, checking it, then swapping names (the old one is kept). Files are only added, never overwritten. The swap happens automatically only when every post-restore check passes; otherwise production is unchanged.
- **A backup set with a warning** (files referenced by the database are missing) **may be restored**, with a clear warning on the preview screen.
- **Rollback** (swap the names back) stays available until a QA user **finalizes** the restore result. Finalizing and rolling back both need an electronic signature. Admin grants the finalize permission to a chosen user. After finalizing, rollback is closed and the kept old database follows the paper procedure.
- Data created after the restore is lost from the running system on rollback; it stays in the kept database. The screens must say so.
- Not decided: the name and code of the new permissions, the electronic-signature meanings, the retention of the kept databases. This is a product decision, not a GMP compliance sign-off.

## BACKUP-RESTORE-IMPLEMENTATION-2026-11-09 (implementation record of BACKUP-RESTORE-SIMPLIFIED-2026-11-09)

- **Permissions:** `backup.restore.execute` allows restoring and rolling back; new `backup.restore.finalize` (migration V752) allows closing a restore. `finalize` is not in SYSTEM_ADMINISTRATION; the set `BACKUP_RESTORE_FINALIZATION` is granted by the administrator.
- **Electronic-signature meanings:** `BACKUP_RESTORE_EXECUTION`, `BACKUP_RESTORE_ROLLBACK`, `BACKUP_RESTORE_FINALIZATION`. The signature is recorded when the agent accepts the request; the outcome of the restore is shown separately and is not implied by the signature.
- **Rollback target:** the old database is kept as `<live>_pre_<tag>`; a rollback keeps the failed-forward database as `<live>_post_<tag>`. Nothing is dropped by the software.
- **File store:** the restore adds missing file versions only, through a MinIO account whose policy denies delete and versioning changes.
- **Still undecided (needs QA/owner):** the database role that renames the live database; owner of objects in the restored database; retention of the `_pre_` and `_post_` databases; whether the person who restored may also finalize; the bucket of the file columns listed as not checked in `MissingFileRestorer.KNOWN_UNCHECKED`.

## BACKUP-RESTORE-PARTS-2026-11-10 (what a backup holds, and what a restore covers)

- **Parts of a backup:** the person chooses one or more of: *System settings* (`CONFIGURATION`: the settings tables listed in `eqms-backup-agent/src/main/resources/backup/settings-tables.txt`), *Database* (`DATABASE`: everything, including the settings) and *Files* (`OBJECT_STORE`). A backup of nothing is refused. Scheduled backups keep the old behaviour (database, plus files when the policy says so).
- **Settings classification:** every table is either a settings table or a records table (`data-tables.txt`). A table in neither is reported as a warning alert at backup time (`SETTINGS_TABLES_UNCLASSIFIED`) and recorded in the manifest, so a new table cannot silently be left out. Decided by the owner: "all system settings" means the settings held in the database, not deployment files.
- **What a restore covers:** only parts the backup holds. *Database*: replaces the live database (swap, rollback until finalized). *Files*: adds the files the store lacks and their aliases; alone, it changes no database name and is recorded as FINALIZED at once. *Settings alone*: **not available yet** (refused with `RESTORE_SETTINGS_ONLY_NOT_AVAILABLE`); it needs table-level rights on the live database and a recorded decision on the privileges. Settings chosen together with the database are inside the database restore.
- **Removed (2026-11-10):** inspections, disaster-recovery drill records, export of backup sets, the offline media register, the backup verification-results screen, the restore rules and the old approval permissions (migration V753). The DR plan stays. Records already written (approvals, signatures, exports) stay in the control database and in the audit trail as evidence.
- **Open:** how the settings alone are applied to the live database (privileges, atomicity, rollback); who may grant `backup.restore.finalize` (the application refuses self-grants: a person cannot give critical permissions to their own access profile).

## BACKUP-RESTORE-TARGETS-2026-11-10 (where backups are kept: T1 and a NAS; the third copy is made by hand)

Owner decisions, given in this conversation (2026-11-10). Scope of this record: the software; where the NAS is and how it is mounted is for the organisation.

- **Every backup is written to T1 first.** T2 is a copy of a finished, already encrypted and signed set, read back and compared by SHA-256. Nothing else writes to T2.
- **T2 is a network share (the NAS), reached by SMB from a Windows host.** The agent writes to a folder; Docker mounts the share (`docker-compose.backup-t2-smb.yml`, CIFS volume). Not yet tried against a real NAS.
- **T3 (second MinIO with Object Lock) is removed:** its compose file, service, volume, secret and the bucket provisioning tool. The owner makes the third copy by hand.
- **The 3-copy rule accepts a declared manual copy.** A policy may declare `manualCopy` (where it is kept, who makes it, every how many days). It counts as one copy, as off-site and as the copy out of the server's reach; the agent cannot see or test it. A person's declaration, not a fact the software checked. Not yet built: a record of when the manual copy was last made, with an alert when it is late. (Proposal, for QA to accept or change.)
- **A copy missed while the NAS is off the network is made later, automatically** (every 10 minutes, newest backup first, only backups whose first check passed). One alert when a target goes away, none while it stays away; a hung share is given up after 60 seconds. Each attempt stays in the append-only location table (migration V25, the key now includes the time of the attempt).
- **Export Backup Set is not coming back,** and neither is a snapshot feature (owner, 2026-11-10). The old folder `backups/dev/export` was deleted on the owner's instruction.
- **Open:** the decryption key and signing key must be kept apart from every target and copied offline by hand; the retention of `_pre_`/`_post_` databases; the 3-2-1-1 wording in SDS-BR-001 still names T3.

## BACKUP-LEDGER-ORDER-2026-11-10 (the ledger file copy was written after the commit; two writers could swap two events)

- **Fault:** `LedgerService.append` wrote the line in `ledger.jsonl` after the database transaction had committed, outside the advisory lock. The agent and the restore worker both write; on 2026-11-09 events 626 and 627 (5 ms apart, one from each side) reached the file in the opposite order. The database chain (hashes) was intact; the daily check reported `LEDGER CHAIN BROKEN` (CRITICAL) because the two copies differ in order. Found on 2026-11-10 when the agent was restarted.
- **Fix:** the file line is now written inside the transaction, while the lock is held. Test `aSlowFileWriteNeverPutsTheFileCopyOutOfOrder` fails before the change and passes after. If the commit fails after the file write, the file has a line the database lacks, which `verify()` reports; the reverse (a database event without its line) would have been a silent gap.
- **Repair of the existing file (DEV):** lines 626 and 627 were swapped back to the database order, after checking that they were the only lines out of place. The original file is kept as `backups/dev/ledger/ledger.jsonl.before-repair-2026-11-10`. No event was changed, added or removed. This was done by hand, outside the software, on the owner's instruction to fix the fault; it is recorded here and not in the ledger itself.

## BACKUP-POLICY-SCREEN-2026-11-10 (what was removed from the Backup Policy screens, and a limit found by testing)

- **Removed from the propose form:** the per-target "Immutable" switch and the "Configured as immutable" badge (the only immutable target was T3, which is gone) and the read-only "Retention" box (fixed by BR-2, not a setting). The 3-2-1-1 preview no longer has "Immutable targets are locked". The one-copy-out-of-reach condition is met by the manual copy. Old versions keep their recorded results and the labels still explain them.
- **Kept on purpose:** schedule (daily time, on/off), documents on/off, targets with medium and off-site, the manual copy, reason, the history list with search and status filter, discard of a draft.
- **Found by testing, needs the owner:** a policy version needs a second person with `backup.admin.policy.approve` and view access. Since backup and restore permissions are held by the administrator only, the DEV approver account (`approver.test1`) is refused the screen ("Access Denied"), so a proposed version cannot be activated. Version 7 (T1, T2, manual copy, no T3) is a draft waiting for that. Either a second administrator account exists for approvals, or the owner decides that the two-person rule for policy changes is relaxed; the software must not decide that. Until a version without T3 is active, every backup reports a failed copy to T3.

## BACKUP-POLICY-SIGNER-2026-11-11 — The proposer may activate a backup policy
- **Decision (owner, 2026-11-11):** a backup policy version needs no second person. Backup and restore are administrator-only, so the administrator who proposes a version may activate it with their own electronic signature (meaning `BACKUP_POLICY_CHANGE`).
- **Control that remains:** the electronic signature (required, its reference stored), the 3-2-1-1 gate, the append-only versions and the ledger. The `POLICY_ACTIVATED` ledger event now carries `sameActor` so the audit shows when proposer and signer were the same person.
- **Removed:** the `POLICY_SAME_PERSON` refusal in the Backup Agent, the "Waiting for another person" banner and the disabled Approve button for the proposer.
- **Not changed:** the proposer/approver split for other regulated functions.

## BACKUP-LISTS-VERIFY-2026-11-11 — Integrity check window, Backup History columns and server-side lists
- **Integrity check window:** Verify Integrity opens a window that starts the check and shows a progress bar from 0 to 100% and, when the check ends, the result of every check. The progress is reported by the Backup Agent (`backup_job.progress`, migration V27): by bytes read while the files are hashed, by step for the other checks. It is never estimated on the screen. The result still goes to the ledger and the Verification History as before; closing the window does not stop the check.
- **Backup History:** new columns (Trigger, Duration, Contents, Schema, Last Checked, Reason) and new filters (Trigger, Contents, Last Checked range). Filtering, sorting and paging stay in the database; trigger and contents are exact values, never typed text.
- **Alerts:** sorting and a "raised" date range now run on the server like the other lists.
- **Lists that are not paged on purpose:** alert rules, backup targets, disaster recovery scenarios and kit, the 3-2-1-1 conditions and the targets of one policy are small fixed reference sets, not records.
- **Focus colour:** the shared Input and Textarea no longer animate every property, which showed the browser's dark focus outline for a moment before the emerald one.

## BACKUP-FINISHING-2026-11-11 — Alerts moved to Administration and made real, Disaster Recovery Plan completed, loose ends closed
- **Backup Controls removed.** The screen only described fixed rules in text (no data, no action). Permissions `backup.admin.verification.view` and `backup.admin.retention.view` removed (V755). The retention rule (backups kept permanently, nothing deletes one by age) is unchanged and stays recorded in BR-2.
- **Alerts & Recipients moved** from Backup & Restore to Backup & Restore Administration (`/settings/administration/backup/alerts`; the old address redirects). The design-preview screen with sample data and a fake Save is gone. The screen has tabs Alerts, Recipients, Rules.
- **Alert rules are real** (agent migration V29, `backup_alert_rule` and its append-only history). Every alert is always recorded and listed; a rule only chooses who is told (in the application, by e-mail) and, for four alerts, the limit (late backup in hours, target capacity in percent, late manual copy in days, kit check age in days). Each change needs a reason and is kept with who and when, in the ledger and in the eQMS audit trail. No second approver (the process is done by the administrator).
- **Delivery.** The agent cannot send a message. The backend asks it once a minute for the alerts still to be told, tells each active recipient in the application (mandatory notification) and by e-mail through the existing outbox, as the rule allows, then says they are done. A repeat after a crash is accepted; a lost alert is not. Alerts raised before this change are marked done and are not sent.
- **New watches** (agent, every 10 minutes): scheduled backup not completed after its time plus the limit; target capacity; manual copy overdue; rebuild kit check overdue. Each raises one alert while it lasts.
- **Manual copy (the third copy).** A person records each copy (day, place, who, newest backup it holds) on Backup Storage & Encryption → Manual Copy; new permission `backup.admin.manual_copy.manage` (V756). The agent keeps the records append-only, shows the next due day from the active policy and raises an alert when it is late. The system never records a copy by itself.
- **System settings part removed** from backup and restore (SDS-BR-004 2.5). A new backup or restore asking for it is refused (`BACKUP_COMPONENT_REMOVED`, `RESTORE_SETTINGS_PART_REMOVED`). Backups made with it stay valid and are not changed; a restore skips that part and says so.
- **File content check at restore** (SDS-BR-004 2.3): a version already in the store is compared in size and SHA-256 with the backup index. A different one is never overwritten: the right content is added as a new version with an alias, and each such file is written in the result; if the backup cannot supply the right content the file is listed as not repaired (a warning).
- **File references at backup** (SDS-BR-004 2.2): when a backup holds the database and the files, every registered file reference in the database must be in the file index; a missing one raises a warning alert.
- **Weekly store check** (SDS-BR-004 2.4): Sunday 03:30, and on demand from the Overview. It reads the live store and compares each file with the backup index, and compares the checksum stored with a document revision with the content the backup holds (the third layer). It reports only; one record per run (V32), an alert on a difference, shown on the Overview.
- **Disaster Recovery Plan completed:** live screen (no preview notice); tabs Plan, Declarations, History. Each target is shown next to what the records show now (age of the newest verified backup, or verified copy on T2 for site loss and ransomware; time of the newest passed test restore). Rebuild kit items go overdue after the limit of the alert rule. A disaster is declared only by the declaration authority, with an electronic signature (`BACKUP_DR_DECLARE`), one at a time, and closed with a summary and a signature (`BACKUP_DR_CLOSE`); the time between is the recovery time taken (V31). The history joins every change to the plan and is filtered on the server.
- **Integrity check window** now lists every check from the start and ticks each off as the agent finishes it (`backup_job.steps_json`, V28). A quick check is held a moment so it can be seen; the verdict appears only at the end.
- **Files can have their own schedule** (owner decision 2026-11-11). A policy may carry `schedule.files` (daily, own time of day). When it does, the scheduler queues two runs, one holding only the database and one holding only the files, one job at a time; without it the files are backed up in the database run as before. A scheduled run that already holds a part counts for that part, so switching it on does not create a surplus backup. `BACKUP_MISSED` is checked per part. Proven on DEV: policy v8 activated with an electronic signature; the scheduler made `BK-20261111-1645-0003` holding only OBJECT_STORE, which completed and was verified.
- **Rollback by hand** when the application cannot start after a restore: `docs/to-be-sds/backup-restore/RUNBOOK-BR-001-rollback-ngoai-he-thong.md`. The rename commands were run on a scratch database only. A rollback made this way has no electronic signature and no Audit Trail row; QA must be told.
- **Not done:** a production restore that includes the Files part and ends in Finalize has not been run on DEV (two earlier restores, 2026-11-09, were swapped and rolled back). It needs the system locked by the Super Administrator, whose password the working session does not have. The real NAS over SMB is still unproven. The whole backend test suite was not run (the Backup and Restore tests were).

## NOTIFICATION-ADMIN-2026-11-12 — Notifications are listed and edited, never created (owner decisions, status: DESIGN, nothing built yet)
- **Problem.** "Notification In-app" offers New Event and "Email Templates" offers Create Template, Duplicate and Delete. Only code raises an event or picks an email template, so anything a person creates is never sent. The two lists overlap (32 events, 24 mail templates, not one to one) and every template carries its own logo, colour, font and footer.
- **D1 One screen.** One "Notifications" administration screen, one row per system event; opening an event edits its in-app text and its email. Emails that belong to no event (password reset, MFA code) are a separate group of the same list. Needs a mapping from event code to mail template type (to be derived from the code, not guessed).
- **D2 One email frame.** Logo, colour, font and footer are set once for the whole system; a template edits only subject, body and the action button. The per-template logo/colour/font fields go away.
- **D3 Mandatory wording is signed.** Editing the wording of a GMP-mandatory notification needs an electronic signature and is written to the Audit Trail; a non-mandatory notification is edited freely (still versioned). No second approver (one administrator does this work).
- **D4 What can be edited.** Content (subject, in-app text, email text) and the channel switches, except on mandatory events whose channels are locked. Recipients, digest, quiet hours and escalation are shown read-only.
- **Create, duplicate and delete are removed**, in the screens and in the API (the server refuses them), so a stale client cannot make a record that is never sent.
- **Open:** whether a mandatory event may ever have a channel switched off (assumed: never); the wording of the shared email frame; who may change the shared frame (assumed: the same permission as editing).

### Built 2026-11-12 (status: LIVE ON DEV)
- **One screen, two lists.** `/settings/notifications`: *System Events* (the 32 events, in-app and, where the event has one, email) and *Email Messages* (the 24 messages the workflows send). The two are **not merged into one row per event**: the 24 messages are found by code through their type, not through the 32 events, and no mapping was derived or guessed. The old addresses (`/settings/email-templates`, `/settings/notification-policy`) redirect.
- **Create, duplicate and delete are gone** from the screens and from the API (`POST/DELETE /notification-policies`, `POST/DELETE /settings/email-templates`, `.../duplicate` removed). The name and the type of an email message can no longer be changed (the code finds it by them).
- **Wording.** In-app: title, message, address. Email of an event: subject, message (HTML), button label (V759 `action_label`). The email message is cleaned by an allow-list (no script, no event handler) when it is saved and again when it is sent. Wording of a GMP-mandatory event needs an electronic signature (meaning `NOTIFICATION_MANDATORY_WORDING`, kept with the Audit Trail row); the email messages already needed one (`EMAIL_TEMPLATE_UPDATED`). Proven on DEV: a signed change to the email of *Document Expired* and its signed restore.
- **Channels** (`PUT /notification-policies/{code}/channels`): in-app always on, email only where supported and only after its wording exists; locked on a mandatory event.
- **One email frame.** `email_design` (one row, V759, started from the most used template) holds logo, colour, font (mail-safe list), footer and support address; `EmailFrameRenderer` puts every mail in it (header with logo, card, button, footer, narrow screen and dark scheme handled). Changes are validated and audited (`EMAIL_DESIGN`). The per-template logo, colour, font and footer are no longer read.
- **Editor.** TipTap (the engine of the Text-editor-react project the owner named, MIT licence), reduced to what a message needs: text style, lists, links (web addresses or a placeholder only), tables, colour. Not taken from that project: A4 pages, comments, sharing (it uses peer-to-peer WebRTC through a public signalling server, which must not touch a GMP system), PDF/Word, header and footer. Lexical, the editor used before, was removed.
- **Placeholders.** `GET /notification-policies/{code}/variables` returns each placeholder an event offers with its token, label and an example; the screen lists them with Insert and Copy, draws a placeholder the event does not offer as a mistake, and the server refuses it on save.
- **Added the same day:** a Channel filter on the list of events (`channel=EMAIL` / `IN_APP_ONLY`, server side) and a *Send test* button on an event (`POST /notification-policies/{code}/test-send`): the published email, with example values and the shared frame, goes to one address (audited as `TEST_SEND`, not recorded as a notification). Proven on DEV: the mail reached the test mailbox.
- **Not done / open:** one row per event for in-app and email together (needs a derived event-to-message mapping); the toolbar's text style list is a native select. `DocumentObsoleteNotificationTest` stubbed the 3-argument `sendRenderedEmail`, but the code sends through the 5-argument one; the test now stubs that one (9 of 9 pass when the outbox key of `.env` is given to the test run).


## REPORT-COMPLETION-2026-11-12 — Report & Analytics module completed (owner decisions D1 to D3 of 2026-11-11, status: LIVE ON DEV, not committed)
- **D1 Overview and Analytics read real data.** Reports Overview and Quality Analytics no longer show sample data; each section is read from the server on its own, a failed section shows a message and a retry (never a zero), a section the person has no permission for is left out.
- **D2 First sources are Document Control and Training**, then security, audit and storage sources. Fifteen Report Types exist; each is code-defined, needs the permission of the screen it reports on and a data scope given by the template.
- **D3 A report is run with a filter; "Full" is a choice** (background run, written to the Audit Trail, no extra permission). A schedule is never Full and always needs a filter.
- **Assistant decisions, to confirm:** the Full ceiling is 100,000 rows (the plan said 200,000; the report worker holds a report in memory and its heap is 768 MB); Training types follow the Training module's own rule (own department unless `training.scope.all`) on top of the template scope; the log-like types (Audit Trail, Authentication Events, Electronic Signatures) need `audit.view` and `audit.export`, the whole-system scope and a date range of at most 92 days.
- **PENDING_DECISION:** whether reports and the Document Control figures of Quality Analytics must follow the Document Control visibility rules (participant / observer / operator tiers, Object Access Rules, department mode); today they follow the scope of the template and `documents.module.view`. The Backup & Restore source waits for the owner (data location, fields that may be shown).
- Records: `docs/validation/REPORT_FULL_RUN_2026_11_12_CHANGE_RECORD.md`, `REPORT_DOCUMENT_SOURCES_2026_11_12_CHANGE_RECORD.md`, `REPORT_COMPLETION_2026_11_12_CHANGE_RECORD.md`.

### REPORT-COMPLETION-2026-11-12 — follow-up (owner, same day)
- **Decided by the owner:** the ceiling of a Full run is **100,000 rows** (`report_properties.max_rows_full`, default and maximum). Reason: the backend heap is 768 MB.
- **Fixed:** the menu entries "Reports Overview" and "Quality Analytics" were hidden behind the feature switch `feat-report-analytics` (off since REPORT-ANALYTICS-PRODUCTION-2026-10-14, when the screens showed sample data). They show real data now, so `NavigationService` no longer checks the switch; the switch itself stays stored and unused.

### REPORT-DC-VISIBILITY-2026-11-12 — reports follow the Document Control visibility (owner approved the proposal, status: LIVE ON DEV, not committed)
- **Resolves the PENDING_DECISION of REPORT-COMPLETION-2026-11-12.** The four Report Types on Document Control records (Document Register, Document Revisions, Controlled Copies, Uncontrolled Copies) and the Document Control figures of Quality Analytics show a person only what the Document Control lists show the same person. The data scope of the template is applied first and the visibility is added with AND: a template can narrow the rows, never widen them.
- **Rules (copied from the lists, decided by `DocumentAuthorizationService` so they cannot drift):** Documents and Revisions: everything for a holder of `documents.document.view_all` (or Record visibility "All" with the base permission); otherwise the author, the owner, a person named in the flow, or a person kept by "Retain Visibility for Removed ...". Controlled Copies: everything for `controlled_copy.view_all`; otherwise the named recipient. Uncontrolled Copies: everything for `view` plus `view_all`; otherwise the recipient, and a person who may approve or reject also sees the requests waiting for a decision.
- **Analytics:** all Document Control figures (effective, in revision, due for review, copies out) count only the visible records; a view-everything holder sees the company-wide numbers.
- **Not changed:** the Training sources, the Audit Trail sources and the Knowledge Base (they have their own rules). Code: `DocumentReportVisibility`, the four providers, `ReportOverviewService`. Test: `ReportDocumentVisibilityTest` (9).

### NOTIFICATION-ADMIN-2026-11-12 — every notification is always sent; no signature to change one (owner decisions, status: LIVE ON DEV, not committed)
- **D5 There is no mandatory or optional notification, no GMP group.** A notification is always sent to its recipients, in the application and by e-mail. A recipient cannot switch one off (Preferences keeps only the browser pop-up choice); the module and channel preferences of a person no longer stop a notification. Removed: the `mandatory`, `complianceGroup`, `mandatoryReason` of an event (V767 drops the three columns), the Kind filter and column, the channel lock, the preference checks in `NotificationDispatcher`, `EmailNotificationService`, `NotificationService`, `NotificationDigestScheduler`, and the priority a mandatory mail had in the e-mail outbox. `PUT /notification-policies/{code}/channels` is removed.
- **D6 Changing a notification needs no electronic signature.** Only an administrator may edit; this covers the wording of an in-app notification, of the e-mail of an event, of an e-mail message, the shared e-mail design and the icon. The signature meaning `NOTIFICATION_MANDATORY_WORDING` is no longer used (its row stays; nothing deletes a meaning that old signatures may cite).
- **D7 Every change is written to the Audit Trail with the value before and after, the content included** (title, summary, subject, body, button label, address; design colours, fonts, alignment, logo text; icon). Checked on DEV: a change of the title of a notification that used to be mandatory was saved without a signature and the audit row holds the old and the new title.
- **Assistant decision, to confirm:** the digest and quiet hours of a policy now apply to every event (a formerly mandatory event bypassed them). The policies of those events are all "immediate" today, so nothing changes on DEV; if a policy is ever set to a digest, its e-mails will wait for the digest.
- **Not done:** the stored `emailNotificationsEnabled` of a user and their `notificationPreferences` are kept as data but no longer read to suppress anything; a later change can drop them. The notification catalogue by module and the recipient model (who receives what) are the next work.

### NOTIFICATION-ADMIN-2026-11-12 — icon, catalogue and the foundation of recipients and placeholders (owner instructions, status: LIVE ON DEV, not committed)
- **D8 The icon of an in-app notification is chosen per notification** in Edit Notification, from any icon of the **Lucide or the Tabler** library, with one of eight colour tones (V766 `notification_policies.icon`, `icon_tone`; `PUT /notification-policies/{code}/appearance`; stored as `lucide:Name` / `tabler:Name`, the server checks the form of the key). The bell, the Notifications page and the preview draw it; a name that no longer exists draws the icon of the kind. The change is written to the Audit Trail (`UPDATE_ICON`).
- **D9 The notification catalogue is a working specification, not an approval document** (`docs/notifications/NOTIFICATION_CATALOGUE.md`): the inventory of what the system sends (registry, e-mail messages, direct senders) and the gaps by module, built from the registry, the notifications DEV emitted, the Audit Trail actions and the senders. Findings: three mechanisms send notifications and only the registry is administered; the registry knows 32 events in 5 modules while DEV emitted 72 types; Training, Reports, Backup & Restore and Calendar have no registered event; the recipient rules `OWNER`/`AUTHOR`/`REVIEWER`/... were decorative (all meant "the people the sender passed").
- **D10 Foundation built.** One fixed list of modules (`NotificationModule`; V768 writes the registry with the keys). One list of recipient kinds (`NotificationRecipientRules`): *context* (the people the sender names, with the role they stand for) and *audience* resolved by the dispatcher (all users, a permission, **a role, a department**, the last two new); the rules of a policy are checked when saved; `GET /notification-administration/recipient-rules`; the Delivery block says the recipients in words. One catalogue of placeholders (`NotificationPlaceholderCatalog`, 119 in 13 groups) with a contract test: every placeholder a seeded event declares must be in it.
- **Not done (next):** the person who acts (`ACTOR`) as a recipient needs the senders to pass them; the recipients of a policy are shown but not yet edited on the screen; the object-access check on a recipient (do not notify someone who cannot open the record); the direct senders (Training first) moved into the registry; the gaps of section 4 of the catalogue, high priority first. Each needs its own change record.

- **D11 Training Management notices go through the registry (change record, status: LIVE ON DEV, not committed).** The 40 notices of Training Management are registry events `training.*` (module TRAINING; `TrainingNotificationEvents`, seeded by `NotificationEventCatalogBootstrap`). `TrainingNotifier` keeps its behaviour (after the commit, a transaction of its own, never blocks the work, the log `training_notification_log`, the key that sends a reminder once for each person and day) and dispatches through `NotificationDispatcher`, which now tells the caller what it did (`Outcome`), so the log says SENT, or SKIPPED with POLICY_OFF, CHANNEL_OFF, NO_EMAIL_ADDRESS, NOT_REGISTERED, or FAILED. The Notifications Administration can now switch a Training notice off, change its channels, recipients, icon and wording, and its e-mail takes the shared e-mail design. A person's own notification preferences no longer suppress anything (D6, Hướng A).
  - **Default wording is a pass-through:** title `{{title}}`, text `{{message}}`, which the module composes at each call site (so the figures, dates and names stay right). An administrator may replace it; the structured placeholders of Training (training number, topic, date, days left) are not built, because each of the 40 call sites would have to pass them.
  - **Exception, not hidden:** the e-mail of `training.attendance_sent` and `training.submitted_to_qa` carries a PDF (APD.0117 and the results) and the outbox cannot carry a file, so these two events are in-app only in the registry and `TrainingNotifier` still sends their e-mail itself; the administrator cannot switch that e-mail off. Moving it needs the outbox to carry a file (open).
  - **Changes of meaning for the people who receive:** the type of a Training notification in the bell is now `training.<name>` (it was `training-<name>`; the screens showed both as "system"), the module is `TRAINING` (the module filter reads it case-insensitively), and an e-mail is "SENT" in the log when it is queued; the outbox says whether it was delivered.
  - **Evidence on DEV:** a real "remind to read" produced the in-app notification (type `training.read_reminder`) and the e-mail in the outbox (SENT) and two log rows SENT; with the event switched off the same action wrote two SKIPPED/POLICY_OFF rows and sent nothing; the event was switched back on. Unit tests: `TrainingNotifierRegistryTest` (10, including a scan that every code the module raises is seeded and none is seeded unused). `TrainingAdministrationPermissionTest` (Spring context) cannot start here because the outbox encryption key is not configured in the test environment, as before this change.
  - **Not done:** the other direct senders (Reports, Backup & Restore, Storage, Maintenance); the high-priority notices of section 4 of the catalogue; the shared toast and bell notice centre; the screen that edits the recipients of an event.

- **D12 The Notifications Administration controls the delivery of every notification (owner instruction 2026-11-12: "admin configures everything", every decision delegated; status: LIVE ON DEV, not committed).** Edit Notification now edits, beside the wording and the icon: whether it is sent (a switch; no notification is locked), the channels (a subset of what the event supports, at least one), the recipients (rules of the list of kinds, validated), the e-mail timing (immediate or a daily or weekly digest) and quiet hours (they hold back the e-mail only), and the escalation (after N minutes, to audience rules). Every event can be sent on both channels except the maintenance-window notice (the outbox does not run during maintenance); the channels it is sent on by default are unchanged, and turning the e-mail on for an event that never had one starts its wording from the in-app wording. Each change is written to the Audit Trail with the value before and after (`Status`, `Channels`, `Recipients`, `Digest Mode`, `Quiet Hours`, `Escalation`, `Email wording`); no electronic signature (D6).
- **D13 Every notification of the system is in the list.** (a) The senders that bypassed the registry are moved into it: Training (40 events, D11), Reports (`report.ready`, `report.schedule_suspended`), Backup & Restore (`backup.alert`, `backup.maintenance_drained`) and `system.storage_usage_warning`; they pass the title and the text the module composes as the placeholders `title`, `message`, `actionUrl`, which an administrator may replace; Training also offers `actorName`, `trainingNumber`, `documentNumber`, `trainingDueDate`, `requestNumber`. (b) The notices still written as an e-mail message (document review, approval, publish, controlled-copy messages, preferences, training-notification) produce an in-app notification from the same wording: they are listed among the in-app notifications and open the e-mail message that holds the wording, so one record controls both (switching the message Inactive stops both). The e-mail-only messages (password, account, one-time code, the DCO ZIP, the uncontrolled-copy external recipient) are listed under E-mail only. Moving the older document and controlled-copy messages into registry events with their own recipient rules remains open: it changes the senders in `RevisionService`, `ControlledCopyService` and `EmailNotificationService`.
- **D14 Gaps of the catalogue closed from the Audit Trail (change record).** `AuditNotificationEvents` lists 17 events raised by actions the modules already audit (restore requested and decided, backup export and policy, restore rehearsal, report template submitted and decided, access-review and audit-trail-review campaigns, possible session theft with the person concerned as recipient, electronic signature settings, access profile changes, controlled copy requested, lost or damaged, distribution failed, publishing package failed, system configuration changed (off by default)). `AuditNotificationBridge` dispatches them after the audited transaction has committed (a rolled-back change is never notified; a failure to notify never reaches the change). The default recipients are audience rules (the holders of a permission, or the person who acted for a possible session theft), so an administrator changes them in the Notifications Administration; the default channel is in-app. Not covered because the audit does not name the person to tell: the outcome of a request to **its requester** (the notice goes to the permission holders instead), the author of a cancelled revision, the holders of a recalled copy overdue for return, the calendar. A new recipient kind `ACTOR` (the person who did it) exists for this.
- **D15 A notification that carries a file goes through the outbox.** The outbox row seals the file with the wording (AES-GCM, bound to the delivery, never in the clear); the e-mail of `training.attendance_sent` (APD.0117 list) and `training.submitted_to_qa` (the results) is now an ordinary registry e-mail that an administrator can switch off (V769 turns it on for the DEV policies, which were in-app only after D11, so the QA mail is not lost). A notice with a file is sent at once: a digest or quiet hours never hold a file back.
- **D16 One notice centre: the toast and the bell list are the same notification.** The toast of a new notification carries the icon and the tone chosen for it in Edit Notification, is a warning for a high or critical priority, and clicking it opens what the notification is about and marks it read (as clicking it in the list does).
- **Evidence on DEV (2026-11-12):** enabling the e-mail of `document.approved` created its wording (`[EQMS] Document approved`, button "Open in EQMS") and an unsupported channel was refused with 400; disabling and enabling a report template (an audited action, no signature) produced the in-app notification `report.template_decided` for the permission holders; `remind-read` produced the Training notice and e-mail with log rows SENT; the registry holds 94 events. Unit tests: policy delivery (3), audit bridge (6), notifier (10), dispatcher with file (1), cipher with file (1), administration list (10), report/storage/backup senders; frontend 52 tests in `features/settings/notifications` and 4 for the toast bridge.
- **Not proven:** the PDF e-mail of the two QA notices was proved only by unit tests (cipher round trip, dispatcher, notifier), not by a real attendance-list flow; the toast was proved by unit tests and the code, not looked at in a browser; the audit bridge was exercised live for one event only (`report.template_decided`); `TrainingAdministrationPermissionTest` (Spring context) cannot start in the test environment because the outbox encryption key is not configured there.

- **D17 The older document and controlled-copy messages are registry events (supersedes the second half of D13(b); change record; status: LIVE ON DEV, not committed).** Fifteen message types raised by `RevisionService`, `ControlledCopyService`, `ControlledCopyExpiryProcessingService` and `KnowledgeShareNotifier` (`LegacyMessageEvents`: document review/approval requested, publish notice, ready for publishing/submission, revision cancelled, edit online, training required, controlled copy notice/cancel/distribution/recall/obsoleted/expiry, knowledge share) are now also registry events (`document.review_request`, `controlled_copy.recall_notice`, ...). `EmailNotificationService.sendToRecipients` sends a message of such a type through its event: the policy (on or off, channels, recipients, timing) and the wording of the event apply, and the in-app notification and the e-mail share it. The event is created at start-up from the active e-mail message of the type (title as the in-app title, start of the text as the in-app message, subject and text as the e-mail; `{name}` is written `{{name}}`) and never overwritten afterwards. **Kept as before:** a message to an external e-mail address (no user), a sender that already names a registry event (`notificationEventCode`: those keep their in-app registry notice plus the template e-mail), the batch ZIP and the no-access distribution message, and the fall-back to the message when the event is not in the registry. **Consequences:** the status (Active/Inactive) of such an e-mail message no longer stops the notification, the event's policy does (the e-mail row says so); the type of the notification in the bell is the event code (the calendar's task projection and the bell's kind map accept both); the related record, number and title of any registry notification are now taken from the values the sender gave (they were empty for registry notifications); a password, token or secret among the values is no longer kept with the in-app notification.
- **Not proven (D17):** the rerouted document and copy flows were proved by unit tests (routing, fall-back, policy off, secrets, related record) and by the seeded events on DEV, **not** by running a revision through review or a copy through distribution; do that in the next UAT before release (it changes who receives every review and approval notice only if an administrator edits the recipients: by default the recipients are the people the module names).

- **D18 The gaps left open by D14 are closed (owner: "not complete yet"; every decision delegated; status: LIVE ON DEV, not committed).** (a) **Requester**: an audit-driven event may name the people of the audited record (`contextSql`); `controlled_copy.request_decided` tells the person who requested the copy, never the person who approved it. For the backup, restore and export requests the requester lives in the backup agent, outside the application database, so their outcome stays with the permission holders (single-administrator process). (b) **Calendar**: `calendar.event_reminder` (V771): a personal event reminds its owner 30 minutes before it starts, an all-day event at 08:00 of its day, once (`reminded_at`, cleared when the event is moved by a trigger); a failed reminder is not retried (a late reminder is worse than none). (c) **Recalled copy not returned**: `controlled_copy.recall_overdue` (V772): a printed copy recalled more than 7 days ago with no destruction recorded reminds the holder and the holders of the recall permission, every 7 days until the destruction is recorded (new business rule, mine to set: the system had no state for it; change the 7 days in `ControlledCopyRecallOverdueScheduler`). (d) **Fifteen more audit-driven events**: backup inspection and scrub, report type/property changes, permission sets, SoD constraints, object access rules, retention-blocked deletion, knowledge sharing, legacy import finished and editing-lock changes (both off by default: noisy), document number changed, copy evidence uploaded, re-issue requested. 34 audit-driven events in all, 109 registry events.
- **Evidence for D17/D18 on DEV (2026-11-12), run as the real users (shared DEV password):** a revision was submitted for review by its author, reviewed by the reviewer and approved by the approver: the registry events `document.submitted_for_review`, `document.review_completed`, `document.approved` reached the right people (these senders already named an event, so the message route is not taken: unchanged). A revision cancelled by the DCO sent `document.revision_cancelled` to its author through the message route: title and text rendered, the reason filled (the older `{comment}` is mapped from `workflowComment`), related revision/number/title and `revisionId` kept, e-mail queued and SENT; with the policy switched off the same cancellation sent nothing on either channel and the revision was still cancelled; the policy was switched back on. A personal calendar event 15 minutes ahead produced `calendar.event_reminder` within the 5-minute pass and `reminded_at` was set; the test event was deleted. The recall-overdue query was run in the database (1 copy is overdue on DEV; the job runs at 06:45 and was not forced).
- **Side effects on DEV test data (not reversible by this work):** revision SOP.10427 is now READY_FOR_PUBLISHING; revisions SOP.10426, SOP.10425 and SOP.10423 are cancelled (CLOSED_CANCELLED).
- **Still not proven:** the recall-overdue pass (06:45, unit-tested and its SQL run); the `controlled_copy.request_decided` requester lookup against a real approval; the PDF e-mail of the two Training QA notices; the toast in a browser; the Spring-context tests start only with `APP_NOTIFICATIONS_OUTBOX_ENCRYPTION_KEY` set (any Base64 32-byte value): with it, `ControlledCopyEndToEndIntegrationTest` (14), `LegacyBatchImportFullFlowTest` (11), `TrainingAdministrationPermissionTest` (5) and the two batch-discrepancy tests (4) pass against the changed notification code.
- **D19 The personal calendar is removed (owner instruction 2026-11-12: "remove the whole calendar function, FE, BE, API and DB, so that it does not conflict with the notification function"; status: LIVE ON DEV, not committed).** Removed: the route and menu item, the API `/calendar`, the services, the entity and the table `calendar_events` (V773, forward-only; the 1 personal event on DEV was the test event of D18), the task projection that read the notification types, the reminder job and the notification event `calendar.event_reminder` with its policy, wording and notifications, the module key CALENDAR. This supersedes the calendar reminder of D18(b). Nothing else read the table. Notification types are no longer read by any projection, so the notification type of a notice may change freely. `V520` and `V771` are not edited.

### REPORT-BACKUP-SOURCE-2026-11-12 — the Backup and Restore Report Type reports the module's Audit Trail from the main database (owner chose the main database; status: LIVE ON DEV, not committed)
- **Owner choice (2026-11-12):** report from the main database, without reading backup files or the NAS.
- **Consequence found in the work (assistant):** the backup sets, restore requests and rehearsals live in the backup agent's control database, so a report of them from the main database is not possible. The type "Backup and Restore Activity" reports the Audit Trail records of the module instead. **To confirm:** whether QA also needs a report of the backup sets and restore requests themselves; that needs a decision on how the agent's data may be read.
- Disclosure: needs `backup.module.view`, `audit.view` and `audit.export`; system scope; range of at most 92 days; no comment, reason, old or new value.

### REPORT-RUN-SIGNATURE-2026-11-12 — a run of the Audit Trail report is signed (owner decision; status: LIVE ON DEV, not committed)
- **Owner decision (2026-11-12):** a run of the Audit Trail report needs an electronic signature. (Answer to the open item of REPORT-AUDIT-... "a report run does not sign".)
- **Built:** the person who requests the run gives a reason (at most 1,000 characters) and signs with meaning `REPORT_RUN_REQUESTED` ("Report Run Requested", migration V774). The signature is recorded against the run (entity `REPORT_RUN`), its reference is kept in the run's QUEUED event and in the Audit Trail entry. A request without the reason or with an invalid token is refused (`REPORT_RUN_REASON_REQUIRED`, signature errors); a repeated request with the same idempotency key does not sign again.
- **Assistant choices to confirm:** (1) a type whose runs are signed **cannot be scheduled** (`REPORT_SIGNED_TYPE_NOT_SCHEDULABLE`), because nobody is there to sign a scheduled run; no Audit Trail schedule existed on DEV. (2) Only the Audit Trail type is signed: Authentication Events, Electronic Signatures and Backup and Restore Activity are also files of audit records and are **not** signed until the owner says so.

### REPORT-OBSOLETE-REVISION-2026-11-12 — a run of a revision that is no longer effective is not generated (owner decision; status: LIVE ON DEV, not committed)
- **Owner decision (2026-11-12):** a run must not be made with an Obsolete revision.
- **Found:** a new request already used only the effective revision, but a run queued, retried or being generated when a newer revision became effective still went on.
- **Built:** the worker checks, before it renders and again before it stores the file, that the template's current version is the one the run was queued with and is approved; if not the run fails at once, without retry and without a file (`REPORT_REVISION_OBSOLETE`: "The template revision this report was requested with is no longer effective. Start a new report request."). Retrying a failed run of such a revision is refused with the same code. Runs made before revisions existed carry no version and are not checked. A file already generated stays and can be downloaded.
- **Assistant choice to confirm:** the same rule applies when the template is no longer approved for the version (for example it was changed to Draft).

- **D20 The in-app notification and the e-mail are edited separately (owner: "they must be separate, why were they merged"; status: LIVE ON DEV, not committed).** The Notifications Administration lists an event once for each channel it supports: an in-app row and an e-mail row, whose status is that of the notification on its channel (an active policy that does not send e-mail is Inactive on its e-mail row). Each row opens its own screen: `Edit In-app Notification` (`/settings/notifications/events/{code}`: wording, icon, in-app preview, switch "Send in-app notification", escalation) and `Edit Email Notification` (`.../{code}/email`: subject, message, button, e-mail preview with Desktop/Mobile, switch "Send email", timing, quiet hours, Send test). **Shared and shown on both, by design:** the recipients (one list for the event, said on both screens). The switch of a channel turns that channel on or off without touching the other; the event as a whole is switched off when its last channel is turned off, and turned on again with only the channel that was turned on. A message that is still only an e-mail message keeps `Edit Email Message`. Placeholders of the palette are those of the event, as before. Migration V775 corrects the description of the 15 events created from e-mail messages (it said they share one wording; V774 was taken by another session, `report_run_signature_meaning`, so this one is V775).
- **D21 Default channels and the switch between the two screens (owner: "agreed"; status: LIVE ON DEV, not committed).** (a) **Default channels** (`NotificationDefaultChannels`, one list; V776 applies it once to the existing policies; the seed uses it for new ones): in-app for every notification; also e-mail for what someone must act on (review, approval, submission, publishing, Training steps and invitations), what is late (reminders, escalations, overdue, results late), what changes a document or a copy the person holds (expired, obsoleted, recalled, recall overdue, copy expiry), security (account locked or suspended, MFA, password, session theft, e-signature settings, access profile and SoD changes) and the running of the system (backup alert, restore and export requests and decisions, backup policy, report template submitted, storage warning, publishing package failed, distribution failed). In-app only: results and information (approved, review completed, published, recorded, completed, matrix or requirement approved, job accepted, content approved, step handed over, document number changed, knowledge sharing, configuration changes, copy evidence, request outcome). 84 policies send both, 40 in-app only; the maintenance-window notice stays in-app only (no outbox during maintenance). A policy that now sends e-mail and had no e-mail wording starts from its in-app wording (V776). An administrator changes any of it per event. (b) **A button on each edit screen opens the same event on its other channel** ("Email Notification" on the in-app screen, "In-app Notification" on the e-mail screen), shown only when the event can be sent on both; with unsaved changes it refuses with a message, so nothing typed is lost.

### REPORT-GMP-NOTICE-2026-11-12 — every report file states its GMP status (status: LIVE ON DEV, not committed; wording to confirm)
- **Owner:** asked to finish the open item of REPORT-OFFICIAL-VALIDATION-2026-10-14 ("every report file states Not confirmed for GMP decisions"); the owner agreed the three open points and asked for the work to be done in sequence. The wording below is the **assistant's proposal**, not an owner text: QA to confirm or change it.
- **Built:** a statement on every page of a PDF (not part of the layout, so a layout cannot remove it), on the "Report information" sheet and in the printed footer of an XLSX, and in the preview. A template marked "Used For GMP Decisions" whose current version is approved: "For GMP decisions. Template revision {n} approved by {name} on {dd/MM/yyyy HH:mm:ss}." Every other report: "Not confirmed for GMP decisions." The preview says "Preview. Not confirmed for GMP decisions."
- **Not covered:** CSV is a data exchange file and carries no statement (a first line would break the data); the statement is on the run page (Approval At Run Time) and in the Audit Trail.
- **List of reports used for GMP decisions:** not fixed in code. QA marks "Used For GMP Decisions" on each template when it is approved; no template is marked on DEV.

### REPORT-TIME-FORMAT-2026-11-12 — dates and times in reports follow the one format of the system (owner decision)
- **Owner (2026-11-12):** the whole system uses dd/MM/yyyy HH:mm:ss in UTC+7; the reports must too, for data integrity.
- **Built:** every date in a report (data cells, preview, PDF, XLSX, CSV) is dd/MM/yyyy and every moment is dd/MM/yyyy HH:mm:ss at UTC+7, through `DateTimeFormatUtils`; "Generated at (UTC+7)" and "Data as of (UTC+7)" label the times of a file; a monthly chart labels months MM/yyyy and reads the display format; the filters shown on the run page are written dd/MM/yyyy. A text a person typed is never changed, even if it looks like a date.
- Machine values stay ISO (API, database, sorting); the sort of a date column is on the stored value, not on the text.

### REPORT-LARGE-RUN-2026-11-12 — a Full run of 100,000 rows no longer exhausts the memory (status: LIVE ON DEV, not committed)
- **Found:** at the heap of the container (768 MB) building an XLSX of 100,000 rows x 12 columns ran out of memory after 35 seconds; 50,000 rows took 19 seconds. A worker that dies of an Error (not an Exception) left the run PROCESSING, and an expired lease put it back in the queue **without any limit on attempts**.
- **Built:** the XLSX is written as a stream (100,000 rows in 1.5 seconds on the same heap); column widths come from the header and the first 200 rows; an OutOfMemoryError fails the run with `REPORT_TOO_LARGE` ("The report is too large for the server to build. Add a filter...") and no retry; a run whose lease expires after 3 attempts becomes FAILED.
- **Verified on DEV:** Document Register Full run, 10,889 rows, XLSX: complete (10,890 rows with the header), 7 seconds. 100,000 rows only with synthetic data (no source holds that many).

### SIGNATURE-TOKEN-REPLAY-2026-11-12 — an electronic signature token can be used more than once (FINDING, outside Reports; needs an owner decision)
- **Found while testing the signed Audit Trail run:** the same token signed two different runs. `SignatureTokenConsumptionService.requireAndConsume` saves a `UsedSignatureToken` whose id is assigned by the code and has no version; Spring Data then does a merge (a read and an update), not an insert, so the "already used" violation never happens. On DEV the single row of the token was updated, not refused. The table `used_signature_tokens` therefore proves a token was used, but does not stop a second use within its time to live.
- **Effect:** every action that consumes a token through that service (Document Control, Controlled Copy, Reports, security changes) can be repeated with the same token until it expires. This is against the stated intent of the class (DC-XF-83) and against the rule "a signature token is used once per transaction".
- **Proposed fix (not applied, because it changes every signed action of the system):** make the entity new on first save (implement `Persistable`) or check `existsById` and use `saveAndFlush`, keeping the existing per-transaction exception. Then run the signed flows of Document Control, Controlled Copy and Reports to find any screen that relies on reusing a token across two requests. **Owner/QA decision needed: apply the fix now, as a change of its own?**
- **D22 Every registered notification has a sender; the audit of the whole Notification Configuration (owner: "handle all of it", then "check it thoroughly, fix at once, test carefully"; status: LIVE ON DEV, not committed).** (a) **Dead events removed or wired.** Removed (V777): `eform.signer_turn` (no e-form module), `system.preference_updated` (the preference e-mail is a message), `security.access_profile_changed` (the audit-driven `_audit` event does it), `controlled_copy.expiring_soon` (`controlled_copy.expiry_notice` is the reminder that is sent; renamed "Controlled Copy Expiring Soon"). Wired: `document.periodic_review_due` (`DocumentPeriodicReviewScheduler`, 06:55: the author and the owner, when the Periodic Review Notification days before the review date are reached and once more when it is overdue; claimed on the document by the review date), `audit_trail.review_campaign_assigned` and `access_review.campaign_assigned` (the reviewer of the campaign), `audit_trail.export_completed` (the person who exported), `system.maintenance_scheduled` (every active user, with the words of the maintenance gate). New: `document.review_comment`, `uncontrolled_copy.expired`, `uncontrolled_copy.request_decided`, `report.run_failed` (and `report.ready` for a report a person asked for themselves), `backup.*` outcomes now also tell **the requester**, found from the audit row of the request (the request itself lives in the backup agent). A test (`EveryRegisteredNotificationHasASenderTest`) fails the build when an event is registered that no code raises. 125 events. (b) **Defects found and fixed by the audit:** the detail of a policy hid the wording of a channel that was switched off, so its screen looked empty and a save overwrote it; an in-app title over 255 characters ended in a database error instead of a message; the e-mail screens were "changed" the moment they opened (the editor rewrites an older message's HTML), which enabled Publish/Save and blocked the switch between channels; the e-mail rows of events said "Never sent" whatever was sent (real counts now, from the outbox and the notifications); the Module column was missing on the e-mail tab; the channel and status were invisible on a phone; many placeholders showed "(example)" in the preview (the catalogue's examples are used, and `title`/`message` show the event's own words); the preview of an e-mail message was asked for before its wording was loaded (422); an e-mail message that is also an event had no pointer to where it is really edited (a banner with two buttons now); Back and the channel button lost unsaved text silently (they ask first now, and a closed tab asks too); the outbox swallowed the reason of an unknown delivery (it is logged now). (c) **Evidence:** 49 API checks (valid, invalid, permission, boundary), 18 UI checks (list, search, filter, sort, paging, tabs, menu, mobile) and 29 UI edit checks (wording, discard, unknown placeholder, recipients, escalation, icon, channel switch, leave guard, e-mail message, e-mail design) all pass with no console or network error; screenshots in `docs/validation/evidence/notif_audit/`; the periodic-review reminder (9 documents) and the recall-overdue reminder (1 copy) were run once against DEV; the audit export notified its person. **Side effect of that run:** 28 e-mails sealed with the test key could not be opened by the DEV backend (by design); they and their failure rows were deleted; the in-app notices were delivered, the e-mail of that first batch was not.

### REPORT-OWNER-DECISIONS-2026-11-13 — the owner's answers to the four open decisions (all built on DEV, not committed)
1. **GMP approver (owner: option C): REPORT-GMP-APPROVER-2026-11-13.** A report template for GMP decisions is approved or returned only by a person who holds the new permission `reports.definition.approve_gmp` ("Approve Report For GMP Use", migration V778); every other template by a person who holds `reports.definition.approve`. A template counts as GMP when it is one now or when the version under review makes it one (so a template cannot be made GMP, or taken out of GMP use, by an approver who may not review GMP templates). The author and the submitter still cannot decide. The permission is granted to no set by the migration. The refusal says why (`REPORT_GMP_APPROVER_REQUIRED`). The wording of the GMP notice stays the assistant's proposal until QA confirms it.
2. **Signature at the run (owner: option B): REPORT-RUN-SIGNATURE-2026-11-12 extended.** All four files of audit records are signed at the run: Audit Trail, Authentication Events, Electronic Signatures, Backup and Restore Activity. None of them can be scheduled (`REPORT_SIGNED_TYPE_NOT_SCHEDULABLE`); a schedule made before that is suspended when it falls due (`SUSPENDED_SIGNATURE_REQUIRED`) and never produces a file. No schedule of these types existed on DEV.
3. **Backup sets and restore requests (owner: option A): not reported.** Backup and Restore Activity (the audit records of the module) is the Backup source of the Reports. The control database of the backup agent is not read.
4. **Signature token (owner: option A): SIGNATURE-TOKEN-REPLAY-2026-11-12 is fixed.** `SignatureTokenConsumptionService` looks for the row of the token first and writes it with a flushed insert; a second use is refused (HTTP 401 "already been used"). A switch `app.security.signature-token-single-use` (on by default) exists only to turn the check off at once if a screen is found that reuses a token; none was found in the frontend scan.

Also: the "Record" column of the Audit Trail and Backup Activity reports no longer shows an identifier (a record known only by its identifier is left empty), as on every screen.

- **D23 Notification Configuration, second pass (owner answers to four questions; status: LIVE ON DEV, not committed).** (a) **Reviewer of a campaign:** the "New Campaign" dialogs of Access Review and Audit Trail Review have a Reviewer select (`GET /security/access-reviews/reviewers`, `GET /audit-trail/reviews/reviewers`; people allowed to review); the chosen person is told by `access_review.campaign_assigned` / `audit_trail.review_campaign_assigned`, and the audit comment names them. (b) **Concurrent edits (owner: optimistic lock):** a save carries the "Updated" time (policy), `expectedUpdatedDate` (e-mail message) or `expectedVersion` (e-mail design) the person saw; if another save moved it, the server answers 409 "This was changed by someone else after you opened it…", nothing is overwritten, and the screen shows a banner with Reload; the rows are also locked (`PESSIMISTIC_WRITE`) while saving. A save with no real change does not move the time. (c) **Toast:** left as it is (owner). (d) **Retention (owner: delete read in-app notifications older than 180 days):** `NotificationRetentionScheduler`, 03:30 UTC+7, one node at a time (distributed lock), batches of 5,000, only `read_at is not null`; unread notifications are never deleted; days = `notifications.inAppRetentionDays` in Configuration › Notifications (empty = 180, 0 = keep for ever, otherwise 30–3650, refused otherwise); one Audit Trail entry `RETENTION_PURGE` with the count, by the system actor. **Evidence:** backend tests (retention 5, reviewer 6, notification set, e-mail design incl. stale) and the whole frontend suite (256 files, 1,430 tests) pass; on DEV: both reviewer lists answer, a stale token gets 409 with the message and a reloaded token saves, the retention setting is refused at 5 and 5000, the delete statement runs (0 rows qualify on DEV: the oldest read notification is recent). **Not verified:** the nightly run itself (waits for 03:30; no row qualifies), a campaign created through the UI with another reviewer, the conflict banner in the browser with two real sessions. **Open:** 26k unread notifications on DEV stay (only read ones are cleaned); `DocumentObsoleteNotificationTest.tcDoc072` fails when the whole class runs (a delivery failure of an earlier test of the class lands in its window) and passes alone; `ControlledCopyRecallByScanIntegrationTest` fails on DEV data (unrelated).

### REPORT-SIGNATURE-IN-FILE-2026-11-13 — a signed run says so in its file (owner: yes, in PDF and XLSX, with the signature number)
- XLSX: sheet "Report information" gains Signed by, Signed on (UTC+7), Reason for signing (in full), Signature (the number, e.g. ESIG-2026-009445) and Signature meaning; the printed footer says "Signed by {name}, signature {number}". PDF: a line on every page, "Signed electronically by {name} on {dd/MM/yyyy HH:mm:ss} (UTC+7), signature {number}." (the reason is in the XLSX and with the signature, not cut to fit a line). CSV is a data file and is unchanged. A run that was not signed adds nothing. The signature number is the one the Audit Trail already shows, not an internal identifier.


- **D24 In-app wording stored as real text; icon and placeholder lists as tables (owner: "write the real words into the database"; status: LIVE ON DEV, not committed).** (a) V779 rewrites the wording of the 37 notifications the Audit Trail raises (`AuditNotificationEvents`), only where nobody had changed it: in-app title = the name of the event, message = `{{actionName}}: {{entityName}} by {{actorName}}. {{actionComment}}`, e-mail subject `[EQMS] <name>` and the same text as body; the new placeholder `actionName` (what was done, in words) is offered by these events and supplied by `AuditNotificationBridge` (the comment is cut at 300 characters); fresh installs are seeded the same way. The screen shows the stored text and the preview is that text with sample values, live as it is typed. **Not done:** 48 other events (Training, Backup alerts, Reports, Controlled Copy notices, storage warning) still hold `{{title}}` and `{{message}}`, because their senders compose the title and message in code from many values; giving them real wording needs a placeholder per value in each sender (about 35 call sites in Training alone). (b) The Notification Icon list is paged with `TablePagination` (24/48/96 per page) instead of Show more. (c) The Placeholders list (in-app and e-mail screens) is one searchable, sortable, paged table (Placeholder, Meaning, Example, Module, This Notification, Action). Evidence: 70 notification screen tests, tsc clean, backend notification and bridge tests, UI script with no console or network error; screenshots `40`-`44` in `docs/validation/evidence/notif_audit/`.

- **D25 One colour for every toast, chosen by the administrator (owner request 2026-11-13; status: LIVE ON DEV, not committed).** The border, the time bar and (unless a notification icon brings its own colours) the icon tile of every toast have one colour, `appearance.toastColor` of the General configuration, edited as a colour choice in Configuration › Notifications › Notification Channels (Toast Colour) with the Toast Position and Display Time; values emerald, blue, cyan, indigo, purple, amber, red, slate (blue when nothing is set; anything else is refused with HTTP 400), published by `GET /api/branding` as `toastColor`. The kind of toast (success, error, warning, info) now only picks the icon and the default heading; **it no longer shows in the colour, so an error toast is no longer red unless the administrator chooses red.** Also: the time bar of a toast is drawn from the clock, because a phone that asks for reduced motion cut the CSS animation to 0.01 ms and the bar was empty; Test Notification on the in-app edit screen shows the toast of the wording being edited. Evidence: ToastColorValidationTest (3), Toast.color and Toast.progress tests, NotificationTab colour test; on DEV the colour was saved to purple, `/api/branding` returned it and the toast had the purple border; DEV was set back to blue.

- **D26 Delivery as "who gets it, on which channel" (owner: "approach it from the event: who is told, through which channels"; status: LIVE ON DEV, not committed).** A recipient rule may now name its own channels (`channels`: IN_APP, EMAIL); a rule that names none reaches every channel the event is sent on, so every existing notification behaves as before. `NotificationDispatcher` works out the people of each channel when any rule names channels (a person on two rules gets each channel once); an empty or unknown channel list is refused with HTTP 400. The Delivery card of both screens (in-app and e-mail) is one table: a row for each recipient with a tick for In-app and for Email, who that recipient is today (count and names, from `POST /api/notification-administration/recipient-preview`), a line saying how many people each channel reaches, and an Add picker whose permissions, roles and departments come from lists (`GET /api/notification-administration/recipient-values`), shown by name; nobody types a code. Timing and quiet hours (e-mail) and Escalation (in-app) moved under a collapsed Advanced section. **This replaces the earlier decision that the recipients are shared by the two channels** (D20/D21): the list is still one list for the event, but each row now says on which channel it applies. Escalation recipients stay a plain list. Not done: the people named by the module when the event happens (the author, the reviewer) cannot be counted in advance and are described in words; the preview counts only people found by group rules; no per-channel rule for the escalation. Evidence: NotificationDispatcherRuleChannelsTest (4), 77 notification screen tests, on DEV the lists answer (238 permissions, 53 roles, 11 departments), a rule with its own channel saved and read back, an empty channel list refused, and the original rule restored.

- **D25a Toast Colour is any colour (owner request 2026-11-13).** `appearance.toastColor` is now a six-digit hex colour chosen with the shared colour picker (`ColorPickerInput`) in Configuration › Notifications; anything that is not `#RRGGBB` is refused with HTTP 400 (it is put in a style attribute, so nothing else is accepted); the names of the first version (blue, purple…) are still understood and published as their hex; blue `#3B82F6` when nothing is set. The toast applies it to the border, the time bar and, unless a notification icon brings its own colours, a light tint behind its icon. The colour is not checked for contrast against the white of the toast: a very light colour makes a faint border. Evidence: ToastColorValidationTest (3), Toast.color test; on DEV `#D946EF` was saved, `/api/branding` returned it, the toast border was rgb(217, 70, 239); DEV was set back to `#3B82F6`.

- **D25b Contrast and Test Toast (owner request 2026-11-13).** Under Toast Colour, Configuration › Notifications shows the contrast of the colour against the white of the toast (WCAG ratio); below 3:1 it says the colour is faint and offers "Darken to 3:1", which darkens it keeping its hue. It is advice, not a rule: any colour can still be saved. "Test Toast" shows a toast with the colour, the place and the display time on the screen now, saved or not (the toast takes its own colour and place, so a preview never moves the real ones). Nothing is stored for this; the setting is still `appearance.toastColor`.

- **D25c Contrast is adjusted directly with a slider (owner request 2026-11-13; replaces the "Darken" button of D25b).** Under Toast Colour, a Contrast slider (1.1:1 to 12:1) moves the lightness of the colour, keeping its hue and saturation, so that its contrast against the white of the toast is the ratio shown; a preview of the toast under it changes as the slider moves, and Test Toast still shows the real toast. The saved value is still the hex colour (`appearance.toastColor`); the ratio is not stored. A grey stays grey.

- **D25d Toast shadow (owner request 2026-11-13).** `appearance.toastShadow`, a whole number from 0 (no shadow) to 100 (40 when nothing is set; anything else is refused with HTTP 400), set with a Shadow slider under Toast Colour in Configuration › Notifications, published by `GET /api/branding`. The strength sets the offset, the blur and the darkness of the shadow together (`toastShadowCss`); the preview under the sliders and Test Toast show it before saving. On DEV 90 was saved and the toast drew `0px 23px 45px rgba(15, 23, 42, 0.314)`; DEV was set back to 40.

- **D25e Toast Position: Top Center and Bottom Center (owner request 2026-11-13).** Two more places, `top-center` and `bottom-center`, beside Top Right, Top Left, Center (the middle of the screen), Bottom Right and Bottom Left; accepted by the configuration (an unknown value is still refused with HTTP 400 and published as top-right) and by the toast and its preview. On DEV the Test Toast centred horizontally in both (centre at x=750 of a 1500 px screen). The saved position on DEV was not changed.

- **D27 In-App Notification Design, like the Email Design (owner request 2026-11-13; status: LIVE ON DEV, not committed).** The settings of the toast (colour, contrast, shadow, place, display time) moved out of Configuration › Notifications into the Notifications Administration, reached by the button "In-App Notification Design" on the In-app Notification tab (`/settings/notifications/in-app-design`), built like the Email Design: one system-wide row (`in_app_design`, V780, copied once from the general configuration, whose four toast keys were then removed), a version, the user and time of the last change, a refusal with HTTP 409 and a Reload banner when someone else saved first (row locked while saving), validation of every field (an unknown place, a display time outside 2 to 60, a colour that is not `#RRGGBB` and a shadow outside 0 to 100 are refused with HTTP 400, a value of the wrong kind is not turned into a default), one Audit Trail entry (`IN_APP_DESIGN`, UPDATE) with each value before and after, a preview and Test Toast. `GET /api/branding` publishes the design to every signed-in user (its cache is cleared on save). Permissions: view as the notification policy or the configuration; change as `settings.notification_policy.manage` or `settings.configuration.manage` (the e-mail template permissions do not apply). Retention of read notifications stays in Configuration › Notifications. **Differences from the Email Design:** no e-signature (decided earlier for every notification setting), no logo or fonts; the design is not versioned as a list of past versions, only the current version number and the Audit Trail history. Evidence: InAppDesignServiceTest (6), InAppDesignView tests (8), list tests for the button on the right tab only, 5 refused requests and a stale save checked on DEV, the toast published after a save and the original design restored (version 3), Audit Trail entries written.

- **D26a Recipients as cards, not a table (owner request 2026-11-13).** The "Who gets this notification, and on which channel" table of the Delivery card pushed the layout sideways when a group had a long name or many people (a group of eight names ran off the card). Each recipient is now a card that wraps at any width: its name, who it is today (the first three names and "and N more", with Show all / Hide for the others as chips), and a "Sent by" row with a tick for each channel (a channel that is off for the event is dimmed and says "(off)"). The picker wraps by itself. The preview now names up to 50 people of a group (it was 8); a group of more says how many are not named. The data, the API and the dispatch rules are unchanged: the list of people is worked out again each time (when the screen is opened or the rules change, and when a notification is sent), so a user added later to a permission, role or department is reached without touching this screen.

- **D26b Delivery no longer changes the layout when something is opened (owner feedback 2026-11-13).** "Show all" (the people of a recipient) and "Advanced" (e-mail timing and quiet hours, or escalation) opened inside the Delivery card and made the right column much taller than the left. They now open in a window (modal) of their own: the list of people in "Who gets it today" (named, wrapping, with the count of people not listed), the advanced settings in "Advanced: when the email is sent" / "Advanced: escalation" with a Done button. The Advanced line shows the current value without opening it ("Immediately, no quiet hours", "Escalates after 1440 minutes to 2 groups", "No escalation"). What is changed in the window is part of the form and is saved with Publish, as before.

- **D26c Edit Notification in two tabs (owner request 2026-11-13).** The screen of an in-app notification and of an e-mail has two tabs: **Content** (Notification Information, the wording, the preview, and for the in-app notification the Notification Icon under the preview, then the Placeholders at the foot) and **Delivery** (the switch of the channel, who gets it and on which channel, Advanced). The Placeholders are shown on the Content tab only, because only the wording uses them. What is typed on one tab is kept while the other is open, Publish and Discard Changes act on both, and a save refused because of the delivery (no recipient, a recipient without a channel, no minutes for an escalation) opens the Delivery tab by itself. The Icon card moved from a full-width card into the right column.

- **D26d Edit Notification laid out like a document (owner feedback 2026-11-13; replaces the layout of D26c).** As on the document detail screen: the header has Back only; the tabs (Content, Delivery) and their panel are one card (the panel under the tab bar); under it the actions (the other channel, Test Notification, Send Test, Discard Changes, Publish), and under the actions a second card with the list tab **Placeholders** (with its count) that is shown only while the first tab is open. Content holds Notification Information, the wording, the preview and the icon; Delivery holds the channel switch, who gets it and Advanced. Differences from the document screen: Back is not repeated at the foot. Notification Icon: the search and the library (Lucide/Tabler) are on top, the grid of icons with its paging under them (up to 12 icons a row), and one bar at the foot with the icon chosen, its colour and Use default.

- **D26e Delivery tab without a card; recipients as a table again (owner request 2026-11-13).** Inside the Delivery tab the card (FormSection) is gone: a line says what the part is for, then two columns on a wide screen (from 1280 px): the settings of the notification on the left (the channel switch and Advanced, 22 rem) and who gets it on the right, one under the other on a narrower screen. The recipients are a table again, now that it has the width: Who Gets It, People Today (the first three names and "and N more" with Show all, which opens the window with every name), a column with a tick for each channel (a channel that is off says "(off)"), and Remove. The cells of the name and of the people wrap. The table scrolls sideways inside its own frame on a narrow screen; the page does not.

- **D26f Icon colour with the colour picker; the same buttons above and under the screen (owner request 2026-11-13).** (a) The colour of a notification icon is any six-digit colour chosen with the shared colour picker (`ColorPickerInput`); the server keeps it in capitals (`#D946EF`), still accepts the names of the first version (blue, purple…) and refuses anything else with HTTP 400 ("The colour must be written as #RRGGBB"). The tile is a light tint of the colour and the icon is the colour itself, in the preview, the toast, the bell and the Notifications page. The bar under the icons has three fixed places (the icon chosen, the colour, Use default; the button is dimmed, not removed, when nothing is chosen), so the Notification Icon card keeps its height whatever is chosen (537 px before and after Use default on a wide screen). The colour of a kind of notification that has none chosen is shown in the picker as the colour of its class. (b) The buttons of the header (Back, Test Notification, Send Test, the other channel, Discard Changes, Publish) are the same as the ones at the foot, so that they are at hand at the top and at the bottom of a long page.

- **D26g The two columns of Edit Notification end on the same line (owner request 2026-11-13).** The bar under the icons lost what the preview and the grid already say (the tile, the name and the library of the icon chosen): it is the colour picker and Use default only, in one row. The last card of each column (the wording on the left, the icon on the right; for an e-mail the wording and the preview) grows to the end of its column, so both columns end on the same line: checked on a 1700 px and a 1366 px screen for the in-app and the e-mail notification (bottoms equal). On a phone the columns are one under the other. The icon chosen is the one marked in the grid; Use default is dimmed while nothing is chosen. The title of the screen is "Edit In-App Notification" everywhere (the leave guard, the details title and the link of the e-mail message editor said "In-app").

- **D28 The two icon sets are kept up to date while the application runs (owner decision 2026-11-13, chosen against the recommendation of updating the packages through the build).** The Lucide and Tabler icon sets of the notification icon picker were the icons of the two npm packages built into the application (lucide-react 1.53.0, @tabler/icons-react 3.49.0). They are now also read from the newest release while the application runs: `https://cdn.jsdelivr.net/npm/lucide-static@latest/icon-nodes.json` and `https://cdn.jsdelivr.net/npm/@tabler/icons@latest/tabler-nodes-outline.json`, when the picker opens, every 30 minutes while it stays open, on "Check now", and when a notification names an icon the built-in packages do not have. **Controls that make this acceptable in a validated system:** only DATA is fetched (the shapes of each icon), never code; every shape is checked (7 shapes, 18 attributes, values that are numbers, a path or a colour keyword) and drawn by the application as an SVG, nothing from outside is put in the page as it came; a file with fewer than 100 icons is refused; requests carry no credentials and no referrer; an icon the application has keeps its built-in drawing (only the new ones are added); the icon is stored by name as before (`lucide:Avocado`, `tabler:IconBell`); if the CDN cannot be reached the built-in icons are used and the picker says so; the production Content-Security-Policy allows `https://cdn.jsdelivr.net` in `connect-src`. **Residual risk, accepted by the owner:** the CDN is a dependency outside the system; a name that the libraries later remove or rename shows the icon of the kind of notification instead; the drawing of an icon that was new when chosen can change with a later release only if the application has no built-in copy. On DEV the check found 217 Lucide icons and 49 Tabler icons newer than the application (266 in all); Avocado, which exists only in the newest Lucide, was chosen, saved and drawn after a reload, and the original icon was restored.
