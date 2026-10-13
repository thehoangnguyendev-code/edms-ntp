# Change record: Backup & Restore P3, slice 2 (Super Administrator, maintenance window, lock gate)

Date: 2026-10-09 · Environment: DEV only · Basis: SDS 11.5, 11.6, decisions BR-16, BR-17, BR-18 · Status: slice 2. Not built: the countdown chip and dialog on the Header, the notice dialog for users, the Restore Execution Console and the restore steps R0-R12, session epoch, Admin "force logout", OnlyOffice flush.

## What changed
- Agent: control migration `V6__super_admin_and_maintenance.sql` (`super_admin` with bcrypt hash only, append-only `super_admin_event`, one-row `maintenance_state`, append-only `maintenance_event`). `SuperAdminService` (verify with the same time for unknown user and wrong password; every attempt recorded; account can be disabled). `SuperAdminProvisioner`: operator tool run once, not reachable over HTTP; refuses a second account. `MaintenanceService`: NORMAL -> NOTICE (5 to 240 minutes, default 10 per BR-16) -> DRAINED (by the scheduler when the notice runs out) -> LOCKED (only after the administrator confirms nobody is working) -> NORMAL. The lock file is written before the state changes and removed when NORMAL. The backup scheduler does not queue backups outside NORMAL. `InternalMaintenanceController` (status, notice, cancel, lock, unlock, super-admin verify), agent token required.
- Backend: `MaintenanceGateFilter` runs before every filter (highest precedence): while the lock file says DRAINED or LOCKED, every request except the maintenance calls, health and actuator answers 503 `MAINTENANCE_MODE` with Retry-After. An unreadable lock file counts as locked. `MaintenancePassService` (HMAC-SHA256 with a secret that is not the session key, 30 minutes, refused if the secret is shorter than 32 characters). `MaintenanceController`: public `/system/maintenance-status` (falls back to the lock file if the agent is down), `/system/maintenance/login` (Super Administrator; the password is checked by the agent), and the actions, each needing `X-Maintenance-Pass`. `SecurityConfig` lets the two maintenance paths through the normal session check; the pass is checked in the controller.
- Compose: the lock directory is written by the agent and mounted read-only in the backend. `MAINTENANCE_PASS_SECRET` added to the git-ignored `.env`.
- Scripts: `scripts/backup/provision-super-admin.sh` (creates the account), `scripts/backup/p3-maintenance-e2e.py` (22 checks, full cycle on the running stack).

## The account (BR-17)
- Username `super.admin`, created on 2026-10-09 with the password chosen by the project owner for DEV testing. Not a row in the eQMS user table. Stored in the control database only as a bcrypt hash.
- The password was given in chat for DEV testing. It should be rotated before any use outside DEV; rotation is a re-run of the provisioning procedure on a new database, since the tool refuses a second account by design (open decision: how the account is changed later).

## Evidence
- Agent 132 tests pass (MaintenanceAndSuperAdminTest 8: notice bounds, full sequence with a lock file at each step, cancel, out-of-order refusals, the account created once with a strong password, bcrypt-only storage, log rows that cannot be changed or deleted, disabled account refused).
- Backend: MaintenanceGateTest 7 pass (open system, notice does not lock, drained and locked refuse everyone but maintenance calls, unreadable lock stays closed, lock file and gate agree after reopening, pass issued/verified/refused when forged, from another key or expired, no pass without a strong secret). BackupRehearsalControllerTest still passes.
- Real stack, DEV: `scripts/backup/p3-maintenance-e2e.py` 22/22: wrong password and unknown user answer the same way; forged pass refused; notice of 2 minutes refused; notice of 5 minutes starts; ordinary sign-in works during the notice; after 5 minutes the system drains by itself; ordinary sign-in and an open session both get 503; lock refused without confirmation and accepted with it; the pass reaches the maintenance calls while locked and nothing else; unlock returns to NORMAL and the lock file is removed.

## Defects found
- None in the new code at the end; two test mistakes were fixed while writing it: a DELETE that matched no row never reached the append-only trigger (the test now writes a row first), and a backend controller returned a map where a JSON node was declared (compile error, fixed).

## Deviations and limits
- The maintenance pass is accepted by the actions, but nothing yet shows a countdown to users; users find out by the 503 or by the notice the system did not yet send. The notice to all users (System Announcements, the countdown chip, the Close behaviour of BR-16/UI) is not built.
- No "force logout" of sessions: the gate refuses requests, but the session records are not revoked, and the session epoch of 11.5.2 M7 is not built.
- The lock does not stop a restore; the restore worker runs only rehearsals. The restore steps R5-R12 are not built.
- Unauthenticated login attempts against the Super Administrator are logged but not rate-limited.
- The lock is written by the agent; if the agent cannot write the file the state change is refused (fail closed), but the file is the only thing the backend trusts, so a manual edit of the file changes what the users see.

## Rollback
Stop the agent's maintenance calls and remove `backups/dev/maintenance/maintenance.lock` (only when the state is NORMAL). Removing the gate filter is a code change; in DEV the gate can be disabled by deleting the lock file. The account and the event tables are evidence and stay.


## Addendum (same day): one-minute notice in DEV
- The notice minimum is lowered to 1 minute in DEV only (`AGENT_MAINTENANCE_NOTICE_MIN_MINUTES=1` in the git-ignored `.env`), so the countdown can be tested without waiting 5 minutes. This is a deviation from BR-16 (5 to 240 minutes), limited to DEV. The agent refuses to start with a minimum below 5 outside DEV (unit test added: 9 maintenance tests pass).
- Re-run `scripts/backup/p3-maintenance-e2e.py` with NOTICE_MINUTES=1: 22/22 pass; the notice drained the system by itself after one minute.
- Before TEST or PROD: the minimum must be back at 5, and the default notice is 10 minutes (BR-16); the value 15 minutes mentioned in the chat is not a decided value.


## Slice 3 (same day): the notice seen by people, and sign-out when the window opens

### What changed
- Frontend `features/maintenance/`: `maintenanceStatus.ts` (status read from `/system/maintenance-status`, countdown on the server clock, poll every 15 s, every 5 s in the last minute, the two fixed reminders read aloud); `MaintenanceStatusProvider` (one poll for the signed-in area); `MaintenanceCountdownChip` (red chip in the header, mm:ss, blinks about once a second, still when reduced motion is requested, with a clock icon and the word "Maintenance"); `MaintenanceNoticeHost` (dialog with "Sign out now" and "Close"; opens when a notice starts and again in the last minute if closed; when DRAINED or LOCKED it signs the browser out and goes to the maintenance page).
- The chip is in the header; the provider and host are in `MainLayout`.

### Evidence
- Frontend: 11 maintenance tests pass (countdown arithmetic with a wrong browser clock, poll interval, reminders, chip, reduced motion, dialog reopen, sign-out on DRAINED, no sign-out during a notice). 170 tests pass across layout, app, maintenance, backup-restore and administration suites. `tsc` clean except the two existing errors in `ReportLists.test.tsx`.
- Browser (Chrome, admin account), 1-minute notice: 9/9 checks: the dialog opens by itself; the header shows the countdown; Close hides only the dialog and the countdown stays; when the notice runs out the administrator is sent to /maintenance; the window is cancelled, the system is NORMAL, and the administrator can sign in again. No page errors.
- Test script: `scripts/backup/p3-maintenance-e2e.py` (backend, 22/22) and the browser script kept in the scratch folder.

### Not built (recorded in SDS 23.9)
- Notice through System Announcements (the notice is not stored as an announcement, so it is not in the audit list of announcements); the notice does not reach users who are on the login page.
- Session revocation and session epoch: the server refuses requests but the session rows are not revoked; a session that returns after the window is refused, but is not marked revoked.
- Email and in-application alert to the administrator when the window drains; the Restore Execution Console; restore steps R0-R12.
- OnlyOffice: unsaved editing sessions are not saved or closed when the window opens.

### Rollback
Remove the provider and host from `MainLayout` and the chip from `Header`; no data changes in this slice.


## Slice 4 (same day): sign-out in the database, notice through System Announcements

### What changed
- Backend `MaintenanceSessionRevoker`: when the agent reports DRAINED or LOCKED, every open session is marked REVOKED (once per window; retried if the ledger does not take the record). The count goes to the agent ledger as `MAINTENANCE_SESSIONS_REVOKED`. `AuthSessionRepository.findAllByRevokedAtIsNull`.
- Backend `MaintenanceAnnouncements` + `SystemAnnouncementService.createForSystem` / `disableForRequest`: a CRITICAL announcement when the notice starts (title carries the request marker `[RQ-…]`, lasts until 12 hours after the lock time); the announcement is switched off when the window is cancelled; an INFO "system open again" is published when it is unlocked. A failure to write an announcement is logged and does not undo the window change.
- Agent: `POST /internal/maintenance/event` accepts one fixed event name (`MAINTENANCE_SESSIONS_REVOKED`) and writes it to the ledger.

### Why the audit trail is not the record here
The eQMS audit trail needs a signed-in person; the Super Administrator is not one, and the revoker is a system job. Those steps are recorded in the Backup Agent ledger, which holds the same facts and is hash-chained. The announcement carries "System (Super Administrator)" as its author.

### Evidence
- Backend unit tests: 5 for the revoker (nothing while open or on notice; every open session revoked and recorded once; locked windows included; a failed ledger write is retried; an unreachable agent changes nothing). Maintenance gate tests (7) and the backup controller tests still pass.
- Real stack, DEV: `scripts/backup/p3-maintenance-announce-e2e.py` 11/11: the CRITICAL announcement reaches the active list; the window drains by itself; 652 open sessions go to 0 in the database; one ledger record with the count; the notice is switched off after the window.

### Not built (recorded in SDS 23.9)
- Email and in-application alert to the administrator when the window drains.
- Notice to people who are on the login page.
- OnlyOffice: unsaved editing sessions are not saved or closed when the window opens.
- Restore Execution Console and steps R0-R12.
- Sign-in attempts by the Super Administrator are not rate-limited.

### Rollback
Remove the revoker bean and the announcement calls in `MaintenanceController`; the revoked sessions stay revoked (people sign in again), and the announcements are switched off by hand in System Announcements if needed.


## Slice 5 (same day): when the maintenance page is shown

### The rule (from the project owner)
- The maintenance page (MaintenanceModeView) is shown only when the administrator switches maintenance mode on in System Administration > Configuration > General, or when the notice has run out and the system is drained or locked (restore).
- While a notice runs, people keep working; the header countdown stays even after the dialog is closed. When the countdown ends, they are signed out and the page is shown.

### What changed
- `GET /system/maintenance-status` (public) also returns `manual`: the value of the General switch.
- `MaintenanceModeView` polls the status every 15 seconds; it leaves for the sign-in page by itself when the window is NORMAL and the switch is off. It stays while drained, locked, or while the switch is on. A failed read keeps the page; it does not open the system.
- Nothing else changed: the switch is the existing one (`AuthTokenFilter` already holds ordinary users when it is on and lets users with `security.maintenance.bypass` through).

### Evidence
- Frontend: 3 new tests for the page (stays when drained, stays with the switch on, leaves when the window is closed and the switch is off). 68 tests pass across maintenance, layout and app suites.
- Backend compiled; gate, revoker and controller tests pass.
- `scripts/backup/p3-manual-switch-e2e.py` 10/10 on the DEV stack: author.test1 is held with 503 MAINTENANCE_MODE while the switch is on; the administrator keeps working; the switch is put back to off at the end, whatever happens.

### Not built
- The sign-in page itself does not show the notice text during a notice (only the page for ordinary users when the system is closed).


## Slice 6 (same day): administrator alert on drain, restore requests R0-R3

### Administrator alert when the window drains
- `MaintenanceAdminAlerts`: an in-application notification (scope personal, priority high, type BACKUP_MAINTENANCE_DRAINED, linking to Backup & Restore) to every active account that holds `security.maintenance.bypass`; and an email to the administrator address of the general configuration when mail is configured (`SystemConfigurationService.getAdminEmail`). A failed email is logged; the window stands.
- Test: the drain run created 2 notifications per run (two administrators), as expected. In DEV no SMTP is configured, so the email is not sent and the log says so. Setting SMTP is a DEV configuration step not done here.

### Restore requests, steps R0-R3 (SDS 11.3)
- Agent: migration `V7__restore_requests.sql` (`restore_request`, append-only `restore_request_event`; one open request per backup; a database check that the approver is not the requester). `RestoreRequestService`: request (type R-FULL, R-DB, R-OBJ, R-ONE; target VALIDATION or PRODUCTION; reason; change control reference); the backup must be completed and its latest check must have passed; a production request needs a passing test restore of the same backup in the last 30 days; approval measures the impact again (SDS 11.5.2 M4), records the new impact and its SHA-256, and needs the approver's signature reference; rejection needs a reason; only the requester can cancel. Impact report: components with sizes, objects and rows from the manifest; rows in the backup; the targets where the backup sits; and the audit rows written in the live database after the backup (read-only account), or "not measured" with the reason.
- Backend: migration `V566` (`backup.restore.request`, `backup.restore.approve`; dependency on the module view; granted to SYSTEM_ADMINISTRATION; signature meaning `BACKUP_RESTORE_APPROVAL`). `BackupRestoreRequestController`: list, get, request, approve (signature token checked first; the signature is recorded in the same transaction as the approval, rolled back if the agent refuses), reject, cancel. Audit uses the request's own id, read first (the refusal lesson of slice 1).

### Evidence
- Agent: 142 tests pass (RestoreRequestTest 9: impact report measured from the live database; input and backup refusals; production needs a recent passing test; one open request per backup; the requester cannot approve; approval needs a signature; approval measures again and a second approval is refused; rejection needs a reason; only the requester cancels; list filters). The source-database fixture gained a created_at column, as the live database has.
- Backend: BackupRestoreRequestControllerTest 8 pass; the other backup controller tests still pass; migration V566 applied.
- Real stack, DEV: `scripts/backup/p3-restore-request-e2e.py` 18/18 with two real accounts: admin asks; admin cannot approve their own request; approver.test1 approves with their own e-signature; a second approval is refused; a second open request is refused; rejection needs a reason; the approver is refused on cancel (no request permission); the requester cancels; the history keeps REQUESTED and APPROVED. The approver's test permission set gained `backup.restore.approve` only (not request), through the security API with the admin's signature.

### Not built (recorded in SDS 23.9)
- Steps R4-R12: scheduling, execution, decryption by two key holders, restore into eqms_restore_{id} and the swap of databases, document alias table, checks C5 and C7-C13, job reconciliation, reopening. An approved request cannot be executed; the console does not exist.
- Restore Execution Console and the Restore Requests / Approval Queue screens: still sample data in the frontend; they are not wired to this API.
- The GMP assessment (R2) and the QA Verifier step (R10) are not built.
- Email in DEV: SMTP is not configured; the e-mail path is coded but not observed.
- Restore request approvals are not yet in the eQMS audit trail of a restore; the audit rows are written, the agent ledger is the record of the impact measurement.

### Rollback
Remove the controller and the migration rows for the two permissions; the requests stay as evidence in the control database.

## Slice 7 (same day): restore screens wired to the API

### What changed
- `RestoreRequestsView` (Restore Requests): server-side list (status and target filters, sorting, paging); the detail drawer shows the request, its impact report, and its history. The requester can cancel their own request; nobody else can.
- `RestoreApprovalQueueView` (Restore Approval Queue): lists only `PENDING_APPROVAL` requests. Approve opens the e-signature dialog with meaning `BACKUP_RESTORE_APPROVAL`; the approval call is made only with the token from that dialog. Reject needs a reason (max 500). No approve or reject control is shown for the person's own request; the server refuses it too.
- `RestoreRequestView` (New Restore Request): lists only completed and verified backups (filtered on the server); honours `?backup=`. Types R-FULL, R-DB, R-OBJ. Target validation or production. Production needs a change control reference (max 120) and a passed test restore of the same backup in the last 30 days (checked in the form; the backend checks it again). Submission only creates the request.
- Sample data removed from these three screens. `RestoreRequestDrawer` is a new component. `backupRestoreApi` gained the restore request methods.
- Not offered in the form: R-ONE (the request has no way to pick the record) and disaster recovery (no execution step and no incident declaration exist yet).

### Evidence
- `tsc --noEmit`: no errors except the two existing ones in `src/features/report/templates/__tests__/ReportLists.test.tsx`.
- vitest for `features/backup-restore`, `features/maintenance`, `components/layout`, `app`, `features/settings/backup-restore-administration`: 24 files, 178 tests pass. New file `RestoreWorkflowViews.test.tsx` covers: approval only through the e-signature (meaning code passed; no call before signing); requester never sees approve or reject; rejection disabled without a reason; the queue asks for `PENDING_APPROVAL` only; New Request offers only verified completed backups; production blocked without a recent passing test restore; a validation request sends the exact payload and returns to the list. The e-signature modal is stood in by a test double in these tests.
- Frontend container rebuilt with the backup overlays and `--profile backup-t3 --profile restore-worker`; `http://localhost:3000` returns 200.
- Browser (Chrome, DEV), `scratchpad/e2e/restore_ui.js`: 10/10 checks. admin sees the backup step and the type step; Restore Requests lists real rows with filters and no "design preview" banner; approver.test1 opens the approval queue (empty at the time: no request was waiting) with no page errors. No request was submitted or approved in the browser.
- GitNexus: the index does not contain the new view names, so `impact` could not run for them (`Target not found`). Manual check: the views are imported only by `src/app/routes/QualityRoutes.tsx`, `src/features/backup-restore/index.ts` and the backup-restore tests. `detect-changes` reports low risk, but on the index as it stands.

### Not built (recorded in SDS 23.9)
- Running an approved restore (R4-R12). An approved request is a record only.
- R-ONE and disaster recovery in the request form (see above).
- A browser approval with a real signature: the approval path was exercised through the API in slice 6 (18/18) and through the component test with a stand-in signature dialog.
- The table is wide; on a 1440 px screen with the notification panel open, the Status and Requested-by columns are to the right and need a horizontal scroll (the shared table behaviour, not changed here).

### Rollback
Put back the three views from the last commit (`git show HEAD:eqms/src/features/backup-restore/views/RestoreRequestsView.tsx`, and the same for `views/RestoreApprovalQueueView.tsx` and `RestoreRequestView.tsx`), remove `components/RestoreRequestDrawer.tsx` and `__tests__/RestoreWorkflowViews.test.tsx`, and restore the two changed test files (`BackupRestoreView.test.tsx`, `BackupRestoreGroups.test.tsx`). The backend and agent are unchanged in this slice.

## Slice 8 (same day): what slice 7 left open, closed where it can be checked on DEV

### Restore approval and rejection in the browser, with a real e-signature
- `scripts/backup/p3-restore-browser-e2e.js` (17/17): admin files a request through the form; the requester sees "Your request" and no approve button; approver.test1 approves in the e-signature dialog with their own password; the server records APPROVED and the approver; a rejection cannot be submitted without a reason, then the server records REJECTED with the reason; the admin cancels their own request. Every state is checked through the API.
- DEV keeps three records of this run as evidence: one approved, one rejected, one cancelled request.

### Mail for the administrator alert: checked
- The DEV configuration already sends mail to `mailhog:1025`. The four alert emails of the drain runs are in Mailhog, addressed to the general administrator address, with the alert subject. The earlier note "SMTP not configured in DEV" was wrong and is corrected in SDS 23.9.

### Notice on the sign-in page (SDS 11.5.4)
- `LoginMaintenanceNotice` on the sign-in form: countdown on the server clock while the state is NOTICE; nothing in other states; a failed status read keeps the page.
- Tests: 2 unit tests. `scripts/backup/p3-login-notice-e2e.js` 9/9 against the running stack, with a screenshot of the sign-in page during a one-minute notice. The notice was withdrawn at the end (system back to NORMAL).
- A third unit test (failed status read) was removed: Vitest reported the rejection it was meant to catch as a failure, and the cause was not found. The branch is covered by reading the code only.

### Sign-in throttle for the Super Administrator (SDS 11.6)
- Agent: migration `V8__super_admin_login_throttle.sql` (event `LOGIN_THROTTLED`). After five failed sign-ins in 15 minutes, the name is refused for the rest of that window without checking the password, and the refusal is recorded. A success restarts the count.
- Agent answers 429 `SUPER_ADMIN_LOCKED`; backend maps it to the same code in `MaintenanceController` (no longer the generic "wrong user or password" message).
- Tests: agent full suite 144/144 (2 new in `MaintenanceAndSuperAdminTest`). Live on DEV, with a probe name that is not the Super Administrator: 401 five times, then 429.
- Values 5 and 15 minutes are DEV defaults for QA to confirm.

### Build and deploy
- Agent, restore worker and backend rebuilt and healthy; frontend rebuilt. Frontend tests for maintenance and auth: 75/75 in the related suites; one run of the maintenance suite failed once on a timing check and passed on two consecutive runs. Not reproduced, not yet explained.
- `tsc`: no errors except the two existing ones in `ReportLists.test.tsx`.
- GitNexus: `analyze` was run to refresh the index; it did not list the backup classes in the first queries, so the impact check for `SuperAdminService.verify` was done by search: its only caller is `InternalMaintenanceController`, which serves only the maintenance sign-in.

### Still not built (recorded in SDS 23.9)
- R4-R12 (execution), the Restore Execution Console, R2 and R10.
- R-ONE and disaster recovery in the request form; both need a decision (see slice 7).
- Restore History & Evidence and Restore Verification Reports are still sample screens.
- Register Imported Set; OnlyOffice save and close during the window; WAL and point-in-time restore; key holders (BR-8); Super Administrator password rotation; an emergency way back in if the Super Administrator is locked out.

### Rollback
- Agent: revert `V8` by dropping the new event value from the check constraint only after removing the `LOGIN_THROTTLED` rows (they are append-only, so this is a control-database operation, not a code step). Without the migration the throttle code would fail on insert, so revert the code and the migration together.
- Frontend: remove `LoginMaintenanceNotice` and its line in `LoginView`.

## Slice 9 (same day): key holders removed; access by permission and Access Profile

### Decision
- The two-person key-holder mechanism (BR-8, Shamir 2-of-3, "two people present to decrypt") is removed. It was a proposal in the SDS, not a requirement, and it was not built. Replaced by: the decryption key lives on the restore worker only while an approved restore runs; one sealed copy is kept for disaster recovery under the DR plan; the second person in the process is the approver, named by internal process.
- Access is by permission, grouped in Access Profiles. A person may hold several profiles. Who holds which profile is an internal process decision; the system enforces the assignment.

### What changed
- Backend migration `V567__add_backup_restore_execute_permission.sql`: permission `backup.restore.execute` (requires `backup.module.view`), granted to the administration permission set. Nothing calls it yet, because restore execution is not built; the permission only sets who will be able to execute once it is.
- Frontend, Restore Approval Queue: Approve and Reject appear only with `backup.restore.approve`; others see "Read only". Before this change the buttons were shown to anyone who could open the queue, and only the server refused them. Test added.
- Frontend, Backup Storage & Encryption: the "Key holders are not set up yet" banner is removed, with its test; the text describes the restore worker instead. The offline-media checklist hint no longer names two key holders.
- SDS 1.13: section 8.4 rewritten; section 9.1a (permission model and flow) added; BR-8 closed; every other mention of key holders replaced. Section 11.6 (Super Administrator) still names custodians who declare their name at sign-in and unlock the account; that is a different control and is left for a decision.

### Evidence
- Frontend tests for backup-restore and backup-restore administration: 111/111 pass. `tsc`: no errors except the two existing ones in `ReportLists.test.tsx`.
- Backend migration V567 and the frontend container are rebuilt; the database check and the browser check are recorded after the build.

### Not built
- Restore execution (R4-R12), so `backup.restore.execute` has no effect yet.
- The rule "the executor is not the approver" is stated in the SDS and the permission text; it is enforced when execution is built, not now.
- Assigning Access Profiles to the approver and the administrator is done in the existing administration screens, with e-signature. It is not automated here.

### Rollback
Remove the V567 rows (the permission, its dependency and the set item), and restore the previous frontend view and the storage banner from the last commit.

### Found while re-running the browser test, and fixed in the same slice
- Rejecting with a reason lost characters in the browser: after a dialog opens, `FormModal` moved focus to its first button (Close) 100 ms later, even when the person was already typing in the reason field. Fix in the shared `FormModal`: focus is moved only when it is not already inside the dialog. Two unit tests added (`components/ui/modal/__tests__/FormModal.focus.test.tsx`).
- The reason text now lives in its own small component, so each keystroke does not re-render the whole queue (this was a contributing factor, not the cause).
- Result: the browser approval flow is re-run after the fix; the reject result is checked against the stored reason (see the run record below).
- The full frontend suite was run after the fix (result in the run record below).

## Slice 10 (same day): restore request screen, signed rejection, approval notice

### What changed
- Screen `/backup-restore/restores/{id}`: progress stepper (Requested, Pending Approval, Approved, Rejected); the backup's contents and integrity; what the restore would put back (components, sizes, documents, rows, audit rows that would be lost); the history. Approve and Reject for a person with `backup.restore.approve` who is not the requester; Cancel for the requester.
- Restore Requests list: an action menu per row with View Detail and Approve Request (only for another person's pending request).
- Rejection needs the rejecting person's electronic signature. Backend: `BackupRestoreRequestController.reject` checks the token and records it in the same transaction as the agent refusal/approval (`BACKUP_RESTORE_REJECTION`); migration `V568__backup_restore_rejection_meaning.sql`.
- After an approval is committed, `RestoreApprovalNotifier` records an in-application notification for each active person with `backup.restore.execute`. A failed notice is logged; the approval stands.
- `FormModal`: keeps focus where the person put it (see slice 9).

### Evidence
- Backend `BackupRestoreRequestControllerTest` 8/8, including the notice call on approval.
- Frontend: `RestoreDetailAndActions.test.tsx` 7/7; `RestoreWorkflowViews.test.tsx` 9/9 (rejection now two steps); `tsc` clean except the two existing errors.
- Browser on DEV, `scratchpad/e2e/restore_browser_flow.js` (copied to `scripts/backup/p3-restore-browser-e2e.js`): 19/19. Approval and rejection both through the e-signature dialog; the server records APPROVED and REJECTED with reason; the detail screen shows the steps; the requester cancels. Database: 2 `BACKUP_RESTORE_APPROVED` notifications recorded for the approval.
- Migrations V567 and V568 applied on DEV.
- Full frontend suite: 3 failures in `features/self-service` (effective-by-type chart and knowledge explorer). Two of them also fail without the FormModal change, so they predate this work; not investigated here.

### Not built
- Restore execution (R4-R12). The approval notice tells the executors the request is approved; nothing runs it yet.
- Email for the approval notice (in-application only).
- The step-by-step signature history on the detail screen shows the person and time, not the signature record.

## Slice 11 (same day): screen names, decisions inside the detail screen, backup link

- Detail screen: page title and last breadcrumb are the screen name "Restore Request" (not the request number). The stepper stands alone below the header, as on the review screens; a cancelled request marks Approved and Rejected as skipped, a rejected one marks Approved as skipped.
- Restore Requests list: Approve Request and Reject Request open the detail screen with `?decision=approve|reject`; the signing happens there, not in the list. The request column is no longer locked and is named Request ID; the Backup column is named Backup ID and opens the backup's detail. The table key is now `backup-restore.restore-requests.v2`, so saved column preferences from the old layout are not reused.
- Evidence: `backup-restore` tests 70/70; `tsc` clean except the two existing errors; frontend rebuilt; visual check on DEV: menu item opens the detail screen with the signature dialog open.
- Not done: the phone layout of this change was not re-checked after this round.

## Slice 12 (same day): no cancellation of a restore request

### Decision
- A restore request has no cancellation. The admin asks; the person assigned by internal process approves (with e-signature) or rejects (with reason and e-signature). Requests have the statuses PENDING_APPROVAL, APPROVED and REJECTED.

### What changed
- Agent: `RestoreRequestService.cancel` and the endpoint `POST /internal/restores/{id}/cancel` removed; test case removed. Migration `V9__restore_request_no_cancel.sql`: the status check no longer accepts CANCELLED for new or updated rows (`NOT VALID`); rows written earlier keep their value.
- Backend: `POST /backup-restore/restores/{id}/cancel` removed; `BackupRestoreRequestController` note updated.
- Frontend: Cancel Request button, cancel API call, the CANCELLED status in types, labels, colours, filters and the stepper removed; `RestoreStatusBadge` covers the three statuses; the sample history screen no longer lists CANCELLED as a closed state.
- Scripts: `scripts/backup/p3-restore-browser-e2e.js` and `p3-restore-request-e2e.py` no longer call cancel; their clean-up request is decided by the assigned approver instead, so no request is left open.
- SDS 1.16: state diagram, section 9.1a (status flow), the earlier 23.9 rows that describe cancel now point to this change, and row lát 14.

### Evidence
- Agent: full suite 143/143 (the removed cancel case was the only test of cancel).
- Backend: `BackupRestoreRequestControllerTest` 8/8.
- Frontend: `features/backup-restore` 70/70; `tsc` clean except the two existing errors.

### Data left on DEV (not changed)
- Six requests on DEV were written with CANCELLED by the earlier test scripts (events: REQUESTED, then CANCELLED by admin). They are kept as the event history, which is append-only. The list still shows them as "Cancelled" until the owner decides how to present them.

### Rollback
Restore the cancel endpoint, service method and button from the previous commit; drop the `V9` constraint and add the previous check back with `NOT VALID` only if no row has been written after this change.

## Slice 13 (same day): backup list in New Restore Request uses the shared table

- The "Select a backup" step of New Restore Request uses the shared `DataTable` (selection column as a radio, No., Backup ID, Started, Type, Size, Schema, Status, Integrity, Verified), with a Custom Column table key `backup-restore.new-request.backups`. The request still lists only completed and verified backups.
- Test: `backup-restore` 70/70 (form tests now select the radio "Select backup <id>").
- Browser flow after slice 12 (without cancel): 19/19.
- Not done: server-side paging for this list (loads up to 100 backups).

## Slice 14 (same day): checkbox selection, row colour, icons in the request form

- Backup selection uses the shared Checkbox (one backup at a time); the selection column has no header; the No. column is no longer locked, so the selected row is coloured emerald across all cells; Backup ID opens the backup's detail without selecting the row.
- The request form's sections carry icons.
- Test: `backup-restore` 70/70 (form tests select the checkbox).

## Slice 15 (same day): backup list of New Restore Request on the server; checkbox; small buttons

- The "Select a backup" step uses `ServerListPanel` (search with 400 ms debounce, type filter, sort on the headers, server-side paging at 10 per page). The list is read from `GET /backup-restore/backups` with status COMPLETED and verification VERIFIED.
- Selection: a checkbox (one backup at a time). Defect fixed: clicking the checkbox itself did not work, because the row click that also selects ran after the checkbox and chose the same backup again; the checkbox cell now stops the click from reaching the row. The chosen backup is kept as a full record, so it survives paging.
- `ServerListPanel` accepts `selection`, `onRowClick` and `rowClassName`, passed to the table.
- Back, Next and Submit use the small button size.
- Back/Next keep the data: checked in the browser (reason kept after Back; selected backup kept on return to the backup step).
- Evidence: browser check of the table 8/8 (single click on the checkbox selects, second click clears, row body selects, search, sort, page 2 shows other backups); `backup-restore` tests 70/70; `tsc` clean except the two existing errors.
- Not done: the phone layout of this table was not re-checked.

## Slice 16 (same day): page size of the backup list

- Default 10 rows per page; the user may choose 10, 20 or 50 (the shared pagination's options). Paging restarts at page 1 when the size changes. Previously the size was fixed at 10.
- Evidence: `backup-restore` 70/70; `tsc` clean except the two existing errors.

## Slice 17 (same day): the test-restore rule of a production request is decided on the server

- The request form used to filter the test restores by date in the browser. Now `RestoreRequestService.readiness(backupId)` (agent) returns the passed test restore that finished within 30 days, or null; it is exposed as `GET /internal/backups/{id}/restore-readiness` (agent), `GET /backup-restore/backups/{id}/restore-readiness` (backend, permission backup.module.view) and `restoreReadiness` (frontend API). The form shows the server's answer and blocks while it is being read.
- Evidence: agent tests pass, including the readiness assertions in `RestoreRequestTest` (none before a test, one after, none once it is 31 days old); backend `BackupRestoreRequestControllerTest` 8/8; frontend `backup-restore` 70/70; `tsc` clean except the two existing errors.

## Slice 18 (same day): New Restore Request steps restyled like Document Properties

- Each step (Type & Target, Pre-checks, Review & Submit) is a single FormSection with an icon; its content is grouped in bordered blocks with uppercase titles, as on Document Properties. Field labels, inputs and hints use the same size, colour and border as that screen.
- The design-preview banner is off (the form reads real data).
- Label/input association for Reason and Change control reference.
- Evidence: `backup-restore` 70/70; `tsc` clean except the two existing errors.
- Not done: the phone layout of these steps was not re-checked.

## Slice 18 (same day): New Restore Request steps restyled like Document Properties

- Each step (Type & Target, Pre-checks, Review & Submit) is a single FormSection with an icon; its content is grouped in bordered blocks with uppercase titles, as on Document Properties. Field labels, inputs and hints use the same size, colour and border as that screen.
- The design-preview banner is off (the form reads real data).
- Label/input association for Reason and Change control reference.
- Evidence: backup-restore 70/70; tsc clean except the two existing errors.
- Not done: the phone layout of these steps was not re-checked.

## Slice 19 (same day): WP3.1 slice 1 — schedule a window and checks before a run (SDS 11.3, R4)

### GitNexus impact (upstream), before editing
- `RestoreRequestService`: reported CRITICAL (1428 impacted). The class is used only by `InternalRestoreController` and `RestoreRequestTest` in the repository; the count comes from name matching in the index. Not edited in this slice: the new logic is in a new class `RestoreExecutionService`.
- `InternalRestoreController`: LOW (0). Two endpoints added.
- `BackupRestoreRequestController`: LOW (0). Two endpoints added.

### What changed
- Agent: migration V10 (`restore_execution`, `restore_execution_event`); `RestoreExecutionService` (checks, schedule); internal endpoints `GET /internal/restores/{id}/execution` and `POST /internal/restores/{id}/schedule`.
- Backend: `GET /backup-restore/restores/{id}/execution` (view permission); `POST /backup-restore/restores/{id}/schedule` (`backup.restore.execute`; audited with state APPROVED to APPROVED).
- Frontend: Restore Execution Console (`/backup-restore/restores/{id}/execution`), linked from the request screen for an approved request when the person holds the execute permission; API `restoreExecution`, `scheduleRestore`.

### Defect found by the test and fixed
- After a schedule was written, the open-schedule check counted the request's own new schedule and reported not ready. Fixed: the check now counts schedules of other requests on the same backup only.

### Evidence
- Agent full suite 145/145; backend `BackupRestoreRequestControllerTest` 10/10; frontend `backup-restore` 74/74; `tsc` clean except the two existing errors.
- Negative tests: approver cannot schedule (RESTORE_SAME_PERSON), window in the past refused, a second open schedule refused (RESTORE_IN_PROGRESS), request not approved refused (RESTORE_STATE), user without execute permission refused (backend), form disabled without the permission (frontend).

### Not done
- Maintenance window states (DRAINED, LOCKED_RESTORING), the run (R5 to R12), the key check on the restore worker, the re-measured impact report at run time (M4), and the Execute control.

### Rollback
Remove the two endpoints, the frontend route and link; drop `restore_execution` and `restore_execution_event` (no run depends on them yet).

### DEV deployment check (build23, same day)
- Containers rebuilt and restarted: eqms-backup-agent (healthy), eqms-backup-restore-worker (healthy), eqms-backend (healthy), eqms-frontend (up).
- Control DB: flyway_schema_history row 10 "restore execution schedule" success = true.
- `GET /api/backup-restore/restores/RS-20261009-0037/execution` and `RS-20261009-0041` (admin, backend): six checks pass, readyToSchedule true, schedule null, notCheckedYet lists the three items above.
- No schedule was written on DEV: the schedule table and its event log are append-only, so a test row could not be removed. The schedule path is covered by the agent and backend tests only.

## Slice 20 (same day): WP3.1 slice 2 — restore window state (SDS 11.5.1, R4 to R5 entry)

### GitNexus impact, before editing
- `MaintenanceService` (agent): CRITICAL by name (1431 impacted). Real direct references: `InternalMaintenanceController`, `BackupScheduler`, `MaintenanceAndSuperAdminTest`, `SchedulerQueueAndTokenTest`, and the new `RestoreExecutionService` and `RestoreRequestTest`. The rename LOCKED to LOCKED_RESTORING is the only change to existing enum values.
- `MaintenanceGateFilter` (backend): LOW (1). Its `isLocked` check changed from equals LOCKED to startsWith LOCKED.
- `RestoreExecutionService` (agent): UNKNOWN by name (0 in the index); constructor gained a `MaintenanceService` argument; only `InternalRestoreController` and `RestoreRequestTest` create it.

### What changed
- V11 `maintenance_state` check and row renamed; `maintenance_event` history left as written.
- `enterWindow` with the four guards; endpoint `POST /internal/restores/{id}/enter-window`; exception mapping for maintenance refusals.
- Gate in the backend treats any state beginning with LOCKED as locked. Without this change the agent would have written a state the backend gate did not recognise.

### Defect found by the test
- Calling enterWindow again after the lock was refused by the state guard (RESTORE_NOT_DRAINED), not by the maintenance state check. The test expectation was corrected to match the designed order of checks.

### Evidence
- Agent full suite 146/146; `MaintenanceGateTest` 7/7; `BackupRestoreRequestControllerTest` 10/10.
- DEV (build24): agent, worker and backend healthy; flyway row 11 success; maintenance state NORMAL; constraint allows LOCKED_RESTORING.
- Not done on DEV: a live enter-window call. A probe of the agent endpoint was refused by the permission check and was not retried. Locking DEV would also block every user.

### Not done
- Backend endpoint and screen button; decision on permission and on Maintenance Pass or e-signature for entering the window; run R5 onward; reopening after the run; status of the window at scheduling time.

### Rollback
Revert the endpoint and gate change. V11 rollback would need to rename LOCKED_RESTORING back to LOCKED and restore the old constraint; no restore run depends on the state yet.

### Decision on who enters the restore window (2026-10-09)
- The person who enters the restore window is `admin` (holds `backup.restore.execute`). `approver.test1` only approves requests and does not enter the window, which keeps the approver separate from the executor (TWO_PEOPLE).
- Still open: the confirmation mechanism for entering the window (Maintenance Pass or electronic signature).

## Slice 21 (same day): sign-out during the restore window and the approver's role

### GitNexus impact, before editing
- `MaintenanceSessionRevoker.revokeIfDrained` (backend): LOW (1). The class is referenced only by its own test.

### What changed
- The sign-out check accepted only the old word LOCKED, so after the rename to LOCKED_RESTORING it would not sign anyone out in that state. It now accepts any state beginning with LOCKED. The sign-out already happens at DRAINED, so no session was left open in the normal path; the fix keeps the sign-out correct if the state changes again while the window is locked.

### Decision (2026-10-09)
- `approver.test1` approves the request and is signed out with everyone else when the system drains. It cannot sign in until the system is reopened. All steps after approval (schedule, enter the window, run) are done by `admin`.

### Evidence
- `MaintenanceSessionRevokerTest` 5/5 (the locked-state test now uses LOCKED_RESTORING); `MaintenanceGateTest` 7/7.

### Gap found, not fixed
- The specification (11.5) requires the operator to sign in during the lock and receive a Maintenance Pass limited to the request. The code issues a pass only to the Super Administrator (outside the eQMS user table). The gate blocks eQMS administrators too, so `admin` cannot use the restore screens during the lock until one of two options is decided: (a) `admin` signs in through the maintenance login and receives a pass scoped to the request; or (b) the Super Administrator performs the steps in the window.

### Rollback
Revert the single comparison in the sign-out check and its test.

### Decision (2026-10-09): option (b)
- The Super Administrator, a hidden account with full rights outside the eQMS user table, performs the steps inside the restore window, using a Maintenance Pass scoped to the request.
- Not yet built: the window-entry and run steps must accept the Maintenance Pass instead of an eQMS session. The restore endpoints currently accept only eQMS sessions.
- Credentials are not recorded in this file or in any memory.

## Slice 22 (same day): administrator exception during drain and lock (SDS 11.5.3)

Approved by the person responsible (2026-10-09, option "full": the administrator works during the window). This is a controlled exception to the sign-out control M3.

### GitNexus impact, before editing
- `MaintenanceSessionRevoker.revokeIfDrained`: LOW (1), referenced by its own test only.
- `MaintenanceGateFilter`: LOW (1).
- `AuthService.login`: UNKNOWN by name (0 in the index). Its constructor gained a `MaintenanceGateFilter` argument; `AuthSignatureCredentialsTest` updated.
- `MaintenanceNoticeHost` (frontend): UNKNOWN (0 in the index); it now exempts users with the bypass.

### What changed
- Gate: a request whose access token verifies and carries `security.maintenance.bypass` passes while locked; `/auth/login` is open.
- Login: while locked, a person without the bypass is refused with MAINTENANCE_MODE after the password check and before any session is created.
- Sign-out: sessions of people with the bypass are kept.
- Frontend: the forced sign-out notice skips people with the bypass.

### Evidence
- Backend: MaintenanceGateTest 8/8, MaintenanceSessionRevokerTest 6/6, AuthSignatureCredentialsTest 11/11, MaintenanceAndSuperAdminTest and BackupRestoreRequestControllerTest pass.
- Full backend suite: 1414 tests; 152 failures or errors, all in 34 Spring integration classes that fail at Flyway validation: the DEV database has V558 and V559 applied, and neither file is in this codebase. This predates this slice and is an environment mismatch to resolve separately.
- Frontend: features/maintenance 17/17; tsc shows only the two existing errors in ReportLists.test.tsx.
- DEV (build25): backend and frontend rebuilt, backend healthy; admin login works while the system is normal.

### Risks and not done
- A permission removed from a person is still honoured by the gate until their token expires (the gate reads the token, not the database). The token lifetime is the bound.
- Every holder of `security.maintenance.bypass` gets in, not only `admin`; the permission set should be checked on DEV.
- No frontend test for MaintenanceNoticeHost; no live test on DEV with a real lock (it would sign out every user); the same for the restore-window steps, which still wait for the Super Administrator pass decision.

### Rollback
Revert the four code changes in this slice (gate, login check, revoker filter, notice host) and the test updates.

## Slice 23 (same day): restore window entry in backend and console (SDS 11.5.1, WP3.1 slice 2)

### GitNexus impact, before editing
- `BackupRestoreRequestController`: LOW (0 by name). One endpoint and one request record added.

### What changed
- Backend: `POST /backup-restore/restores/{id}/enter-window` with `backup.restore.execute`; forwards `by` and `noUserConfirmed` to the agent; audits `RESTORE_WINDOW_LOCKED` only when the agent accepts.
- Frontend: `enterRestoreWindow` API; "Enter Restore Window" block on the Execution Console, enabled only when a schedule exists, its time has come, and the person confirms that no user is still working.

### Evidence
- `BackupRestoreRequestControllerTest` 12/12 (permission gate, audit on success, no audit on refusal).
- Frontend backup-restore 76/76 (two new tests: button locked before the window and until confirmation; no call before the window starts).
- DEV (build26): backend healthy, frontend rebuilt; probe on RS-20261009-0037 (no schedule) returned HTTP 409, no state change.

### Not done
- A live lock on DEV with the window (needs the Super Administrator steps in the browser; see the not-done list in SDS).
- Run R5 onward.

### Rollback
Remove the endpoint, the request record, the API method and the console block.

## Slice 24 (same day): test restore inside the window (SDS 14.1, WP3.1 slice 3)

### GitNexus impact, before editing
- `RestoreRehearsalService.request`: UNKNOWN by name (0). Only called, not changed.
- `RestoreExecutionService`: UNKNOWN by name (0). Constructor gained `RestoreRehearsalService`; `RestoreRequestTest` updated.
- `InternalRestoreController`: LOW (0). One endpoint added.
- `BackupRestoreRequestController`: LOW (0). One endpoint added.

### What changed
- Agent: `startTestRestore` (schedule, LOCKED_RESTORING for this request, once per window) queues a rehearsal of the request's backup; the restore worker runs it on a scratch database with the rehearsal checks. Event `TEST_RESTORE_QUEUED` on the execution.
- Backend and console: the endpoint and the "Start Test Restore" button, both with `backup.restore.execute`.

### Evidence
- Agent full suite 147/147 (RestoreRequestTest 12/12 including the new test, RestoreRehearsalTest 10/10).
- Backend BackupRestoreRequestControllerTest 13/13.
- Frontend backup-restore 77/77; tsc shows only the existing ReportLists errors.
- DEV (build27): agent, worker and backend healthy; V11 successful; probe on an unscheduled request returns 409 without change.

### Not done
- Live run inside a real lock on DEV (waits for the Super Administrator steps; see the not-done list in SDS 1.30).
- Showing the rehearsal result on the console; concurrent requests on one backup are not serialised per window (the rehearsal queue refuses a second waiting job only).
- Stage 4 (object alias table and C5 to C13).

### Rollback
Remove the agent method and endpoint, the backend endpoint and the console button; the event rows are append-only and stay as history.

## Slice 25 (same day): test-restore result on the Restore Execution Console (SDS 14.1)

### GitNexus impact, before editing
- `RestoreExecutionService.preflight`: UNKNOWN by name (0). Its response gained `systemState`, `systemRequestId` and `testRestore`; the backend passes the JSON through unchanged.
- Frontend `RestoreExecutionView`: no index entry; its state now comes from the server (window entry, test-restore button).

### What changed
- Agent: `preflight` returns the maintenance state, the request that holds it (only while LOCKED_RESTORING), and the latest test restore of the open schedule with its rehearsal outcome and checks.
- Console: the window and test-restore state are read from the server, so a reload shows the right state; the test-restore outcome and its checks are shown; the console re-reads every 10 seconds while the test is QUEUED or RUNNING.

### Evidence
- Agent full suite 147/147; RestoreRequestTest 12/12 (the test-restore test now also asserts the returned state and result).
- Frontend backup-restore 78/78 (new: the outcome with its checks is shown; the test-restore button is locked after a test has been queued); tsc shows no new errors.
- DEV (build28–29): agent and worker healthy; the check returns systemState NORMAL and systemRequestId null.

### Found and fixed during the work
- The request id of the last maintenance notice stayed in the state after the window closed, so the console showed a request name while the system was NORMAL. It is now returned only while LOCKED_RESTORING.

### Not done
- A live check of the result while the system is really locked (needs the Super Administrator steps).

### Rollback
Remove the three fields from the preflight response and the result block from the console; the state now comes from the server, so the earlier local state must come back if the fields are removed.

## Slice 26 (2026-10-10): WP3.1 slice 4, part 1 — read through the version alias (SDS 11.4.2)

### GitNexus impact, before editing
- `MinioObjectStorageService` (backend): LOW (1 direct reference). The change adds a setter-injected lookup and a fallback in `open`; no constructor change.
- `ObjectVersionAliases`: new class, no callers before this change.

### What changed
- Migration V569 `object_version_alias` (unique by bucket, key and original version id). Applied on DEV.
- `open`: the alias table is consulted only when MinIO answers `NoSuchVersion` for the requested version. The alias version is read, copied to a temporary file while hashing with SHA-256, and returned only when the hash equals the recorded one; otherwise the copy is removed and the read is refused.

### Evidence
- `MinioObjectAliasVerificationTest` 3/3; `MinioStorageLiveTest` 1/1 passed (its endpoint was not checked against DEV in this record).
- Backend built and deployed (build30); V569 successful on the eQMS database; the table is empty, so no existing read changes.
- Existing failing integration classes (V558/V559 mismatch, see SDS 1.34 and slice 22) are unchanged; their reports are from the earlier full run.

### Not done
- R8 in the agent (writing missing objects to eqms-test-{id} and writing alias rows into the scratch database).
- C7 and C13. C13 needs the mapping from each *version_id column to the bucket and key columns beside it; to be confirmed before it is built.
- C5 and C8–C12 (slice 5).

### Rollback
Remove the setter call and the fallback in `open` (the table is empty and can be dropped in a later migration only if no alias row exists).

### Check on 2026-10-10 (read-only)
- DEV MinIO answers `NoSuchVersion` (HTTP 404) for a valid but unknown version id on an existing object in `eqms-gmp-records`; the alias branch is reached only for that answer.
- Finding: `MinioStorageLiveTest` runs against `localhost:9000` and writes and removes a verification object in `eqms-gmp-records`, which SDS 14.x forbids for tests (tests must use `eqms-test-{random}`). Not changed; needs approval before it is moved to a test bucket.
- Backend healthy; V569 applied; `object_version_alias` has 0 rows.

## Slice 27 (2026-10-10): outstanding items review

- `MinioStorageLiveTest`: no longer runs on the DEV MinIO. It wrote to the templates bucket and tried to delete an object in the locked records bucket, both against SDS 14.x. It now runs only when a throwaway MinIO is named in `eqms.tmpMinio.endpoint`; on DEV it is skipped (1 skipped). Building the throwaway MinIO is still open. The earlier record that it "wrote nothing to records" was incomplete: it attempted a refused delete there.
- `MaintenanceNoticeHost` frontend tests: bypass holder stays signed in, other user is signed out when locked. `features/maintenance` 19/19.
- DEV permission check (read-only): `security.maintenance.bypass` is held by `admin` and `sys.admin2` (System Administration profile). `approver.test1` and `dco.test1` do not hold it. `sys.admin2` needs an owner's confirmation.
- Lát 4 R8, C7 and C13 are blocked: the restore worker has no MinIO credentials and cannot write to test buckets. A restricted MinIO account for the worker (write access to eqms-test-* only) needs approval before it is created.
- Still open: 34 integration classes failing on the V558/V559 migration mismatch; live lock check on DEV; phone-width check of recent UI; older decisions.

## Slice 28 (2026-10-10): WP3.1 slice 4 — object restore into the throw-away bucket, C7 and C13 (SDS 11.4.2, 14.3)

### GitNexus impact, before editing
- `MinioObjectStorageService` (backend): LOW. `RestoreRehearsalService` (agent): constructor gained `TestObjectStore`; only `RestoreRehearsalTest` constructs it. `PostRestoreChecks`: made public for the new test. Impact by name not repeated per method; the changes are additive.

### What changed
- Backend: migration V570 (`current_bucket`); the alias read uses the bucket of the copy.
- Agent: `TestObjectStore` and `MinioTestObjectStore` (only `eqms-test-*` buckets); `RestoreObjectRestore` (R8, C7, C13); `RehearsalRunner` test fake handles a single-command decrypt.
- Worker: MinIO account `eqms-test-worker` (policy: s3:* on eqms-test-* only); compose variables `AGENT_RESTORE_TESTOBJECTS_*`; secret in `.env` (git-ignored, value not recorded here).
- The integrity check of documents (C6) runs before R8, so a tampered document still reports C6 as failed.

### Decisions made while building (for review)
- A reference without a version resolves only when the backup holds exactly one version of that key.
- A key counts as referred to when it appears exactly in any record column, or when a `minio://` reference names it; the alias table is excluded.

### Evidence
- DEV rehearsal RH-20261009-0007: PASSED; C6 1,310 documents match; C13 569 references, 1,310 aliases for 1,310 objects; C7 530 orphans (report).
- An earlier rehearsal RH-20261009-0006 failed C13 on an unversioned reference; that rule was then corrected (the record above). The failure is kept as history.
- Agent full suite passed on the final run; one transient JDBC connection failure in `RestoreRequestTest` during a full run passed when rerun alone and on the next full run.

### Not done
- C5, C8, C9, C10, C11, C12 (slice 5).
- Cause of the 530 orphan objects.

### Rollback
Remove the R8 call from the rehearsal run and the C7/C13 checks; drop the test buckets; the alias table is empty in production.

### Orphan analysis (2026-10-10, read only)
- Most orphan objects are under `templates/publishing` (505 backup blobs) and controlled-copy evidence folders.
- The production database holds about 27 references to publishing template paths (cover, header, footer); other publishing outputs have no record. Preliminary cause: outputs not recorded in any record. Handling is a decision for the owner (C7 only requires the report).
- Dependency probe from the worker (`curl telnet://`) timed out for every service, including MinIO, so it is not evidence either way; C12 is not built.

## Slice 29 (2026-10-10): state checks C5, C8, C9, C10, C12 (SDS 14.3)

### GitNexus impact, before editing
- `RestoreRehearsalService` (agent): constructor unchanged in this slice; the run gained five check calls. `ControlDbTestSupport.createSourceDb` gained the state tables (affects every test that builds a source database; full agent suite passed).
- `AgentProperties.Restore`: new list `dependencyEndpoints`.

### What changed
- C5: each effective revision must have a signature, and its stored document must read back (through its alias) to the signed checksum and to `source_file_checksum`.
- C8: an active account and an access profile assignment exist. Administrator sign-in is not tested by the worker.
- C9: scheduled reports are switched off in the restored copy, then checked.
- C10: no job is left in an unfinished state; otherwise "needs review" (no automatic status changes).
- C12: TCP reachability of four services, as a warning only (`required = false`).
- C11: not built; the worker cannot run the application against the restored copy.

### Evidence
- Agent full suite passed; `RestoreStateChecksTest` 4/4; C5 tests in `RestoreObjectRestoreTest`.
- DEV rehearsal RH-20261009-0008: FAILED on C5 (173 effective revisions in the backup: 165 unsigned, 0 without a stored version by the check order; earlier production query: 164 unsigned, 8 without a stored version, 16 signatures with a checksum different from source_file_checksum). C8, C9, C10 passed; C12 warning on onlyoffice:80.

### Not done
- C11.
- Administrator sign-in in C8.
- Owner decision on the C5 data findings (not a code defect; the check was not relaxed).

### Rollback
Remove the five check calls and the C12 call from the rehearsal run; the state tables added to the test source database may stay.

### Test-data hypothesis for the unsigned revisions (2026-10-10, read only)
- Of 164 effective revisions without a signature, 76 have file names of automated test scenarios; 88 are not identifiable from the name. Only 9 effective revisions carry a signature. No data was changed. Owner decision needed before C5 can be applied to real data only.

### Verification of the test-data hypothesis (2026-10-10, read only)
- 154 of 164 unsigned effective revisions came from the legacy direct-to-effective import: 11 by curl from the Docker network, 144 without a user agent from 127.0.0.1; names match `LegacyBatchImportFullFlowTest`; dates match test runs. Treated as automated test data on DEV.
- 10 others came through the browser workflow (one named "Hoàng test tối 20_06"); still no signature record.
- Separate finding: 8,144 of 9,910 audit entries that reference a signature id have no matching row in electronic_signatures (3,512 rows exist). Root cause not found; no code deletes signatures. Recorded as a deviation to investigate. No data changed.

### DEV-only warning for C5 (2026-10-10)
- Flag `agent.restore.signatureCheckAdvisory` (env `AGENT_RESTORE_SIGNATURECHECKADVISORY=true` in the DEV compose file) makes C5 a warning. Ignored outside DEV. C5 is still computed and reported in full.
- DEV rehearsal RH-20261009-0009: PASSED; C5 shows "DEV warning only". No data changed. A labelled deviation; owner to confirm.

### Correction: audit signature reconciliation (2026-10-10, read only)
- The earlier figure (8,144 of 9,910 missing) compared audit signature ids with electronic_signatures.id, which is the wrong key for revision workflow steps. Audit revision steps record the consumed signature-token id (used_signature_tokens.token_id); entity signatures record the signature row id.
- 4,066 distinct audit signature ids: 2,840 match a consumed token (all after 2026-08-21); 914 match a signature row (after 2026-08-21); 167 match a signature row (before 2026-08-21); about 145-167 match neither (2026-06-20 to 2026-08-17; token table holds no data before 2026-08-21, so they cannot be checked against tokens).
- No code path deletes signatures. Conclusion: no evidence of deletion; a traceability gap between audit and signature records in the revision workflow, plus an unresolved group. Deviation to be opened; source of older evidence needed.

## Slice 30 (2026-10-10): WP3.6 — Restore Verification Reports and Restore History wired to the API

- Frontend only; no backend or agent change. `RestoreVerificationReportsView` reads rehearsals (50 latest) and opens one with its checks; `RestoreHistoryView` reads rejected restore requests and links to their detail.
- Tests: `backup-restore` 78/78; tsc no new errors. One mock in `BackupRestoreGroups.test.tsx` gained `rehearsals`.
- DEV: frontend rebuilt; both list endpoints return real data.
- Not done: completed-restore history (no run yet), Evidence Pack with signature and ledger hash chain, server-side paging of reports, WP3.2.

## Slice 31 (2026-10-10): WP3.2 slice A — weekly V2 verification (SDS 14.1)

- Agent: `WeeklyV2Verification` (worker only, Monday 05:00 Asia/Ho_Chi_Minh): picks the newest completed backup whose latest verification is VERIFIED, queues a rehearsal requested by `system:V2`, and skips with `SKIPPED_OVERLAP` when a V2 check is waiting or running. `RestoreRehearsalService.recordV2` writes the outcome to `backup_verification` as tier V2.
- Internal endpoint `POST /internal/verification/v2` runs the check on demand.
- Tests: `RestoreRehearsalTest` 11/11 (queue once, skip while waiting, V2 recorded); agent full suite passed.
- DEV: worker rebuilt; manual run RH-20261009-0010 PASSED, V2 VERIFIED by system:V2.
- Not done: catch-up of missed runs (lát B); the first scheduled run is Monday 12/10/2026 05:00.

## Slice 32 (2026-10-10): WP3.2 slice B — missed V2 catch-up and overdue warnings (SDS 14.1)

- `WeeklyV2Verification.catchUp` (worker, daily 06:00): MISSED event and HIGH alert when no V2 request in 7 days, then one catch-up run; HIGH alert BACKUP_V2_OVERDUE when no V2 VERIFIED in 8 days.
- Test `RestoreRehearsalTest` 12/12; agent full suite passed; worker redeployed on DEV.
- Decisions taken on the owner's delegation (to be confirmed): V3/Backup Inspection in a separate read-only application container; WAL archive on DEV Postgres (restart accepted); DR drill in an empty DEV container. The P3 gate performer is not assigned.

## Slice 33 (2026-10-10): WAL archiving on DEV Postgres (SDS 15.1, partial)

- Before the change: `pg_dumpall` (295 MB) and a physical base backup in the Postgres volume (`basebackup/base-before-wal`).
- Changed: `archive_mode=on`, `archive_timeout=300`, `archive_command` copies WAL to `/var/lib/postgresql/archive`. Postgres restarted at 02:09 on 10/10/2026.
- Verified: `pg_stat_archiver` archived_count 1, failed_count 0; backend UP afterwards.
- Not done: scheduled base backups, WAL retention and cleanup, PITR test on a copy.
- Rollback: `alter system reset archive_mode; alter system reset archive_command; alter system reset archive_timeout;` then restart.

### Follow-up (2026-10-10): archive volume, replication rule, maintenance job
- Finding: the first archive lived in the container's writable layer and would be lost on re-creation. Fixed: new volume `eqms_pg_archive` mounted at `/var/lib/postgresql/archive`; the four saved segments were copied into it; Postgres re-created (short restart).
- `pg_hba` got one line: `host replication eqms 172.19.0.0/16 scram-sha-256` (replication for the eqms role, compose subnet only), reloaded. The first base backup had failed on this rule.
- `pg-maintenance` container (`docker-compose.pg-maintenance.yml`, `scripts/backup/pg-maintenance.sh`): base backup run once with RUN_NOW=1 at 08:49 on 10/10/2026 (ok); WAL before the base backup's start removed from the archive (pg_archivecleanup); weekly run Sunday 03:00 remains scheduled.
- Restore check on a copy: base backup started on port 5433 with restore_command from the archive; `documents` count 10,279 (matches the figure recorded earlier); copy stopped and removed.
- PITR to a target time was verified on a copy (recovery_target_time 01:56:40 UTC; only the rows committed before it were present). The probe table was dropped afterwards.
- Real run on 2026-10-10 09:01: base backup `base-20261010-090101`; copied with the WAL archive and a full dump to `D:\eqms-dev-backups` (base 752 MB, WAL 113 MB, dump 296 MB); SHA-256 checksums verified for all 4,499 files.
- Not done: failure alert for the base backup; automatic copy to the drive (currently manual).

### Security change: sys.admin2 without the maintenance bypass (2026-10-10)
- Created access profile `ADMIN_NO_BYPASS` (Baseline permission set only); assigned sys.admin2 to it (HTTP 200); removed sys.admin2 from the profile with System Administration (HTTP 204). Each step used its own e-signature token.
- Verified read-only: sys.admin2 now has only ADMIN_NO_BYPASS; the only holder of `security.maintenance.bypass` is admin.
- Side effect: sys.admin2 lost all administration rights, not only the bypass. Restoring them without the bypass needs a new permission set without that code; awaiting the owner's decision.
- Rollback: re-assign sys.admin2 to the System Administration profile through the same API (needs an e-signature), then remove it from ADMIN_NO_BYPASS.
- Note: a first assignment attempt returned no status and was followed by the removal; the user was briefly without any profile and was re-assigned (HTTP 200) right after.
- Admin-driven window (2026-10-10, owner's decision: the window is run by a normal admin account, not the Super Administrator). The maintenance control endpoints (notice, cancel, lock, unlock) now accept either the Super Administrator's Maintenance Pass or an eQMS session of a user with `security.maintenance.bypass` plus a fresh e-signature in the header `X-Signature-Token`.
- Test run on DEV: window RS-20261009-0037 scheduled by admin; notice by admin (NOTICE, 5 minutes); the system drained and 46 sessions were signed out at the drain, as designed; the window entry was refused with 503 by the gate.
- Defect found in this run (my earlier claim was wrong): the lock gate read the bypass from the JWT, but the access token carries no permission list (permissions are read per request), so the bypass exception never applied to a real login. The unit tests passed only because they built the principal by hand. Fixed: the gate now looks up the holder of the bypass in the database for each request and stays closed if the lookup fails. Gate tests 8/8; backend redeployed.
- After the fix: admin signed in during the drained state, `cancel` with a fresh e-signature returned 200 and the system returned to NORMAL; approver.test1 and dco.test1 sign in again (200).
- Full window run by admin on DEV (03:53–04:01 UTC, 2026-10-10): notice 5 min (NOTICE) → DRAINED 03:59 → admin reaches the API (200) and approver.test1 is refused (503) → enter-window RS-20261009-0037 (LOCKED_RESTORING) → test restore RH-20261010-0011 PASSED (same checks as before; C5 a DEV warning) → unlock with a fresh e-signature (NORMAL; lock file removed) → approver.test1 signs in again (200).
- Evidence pack (SDS 16): `RestoreEvidence` (agent) builds the request record, decisions, schedule and checks, the test restore with its checks, the ledger events of the request or its backup, and the verification of the whole ledger hash chain; the pack is signed with the agent's manifest key. Internal endpoint `GET /internal/restores/{id}/evidence`; backend `GET /backup-restore/restores/{id}/evidence` (view permission). Tests: `RestoreRequestTest` 13/13 (signature verifies; changed text does not). DEV: RS-20261009-0037 returns a signed pack with chain ok; keyId f1d108b4c8608e4e.
- Not done: download button in the UI.
- Maintenance alerts (SDS 15.1): low-space alert (MIN_FREE_MB, default 5120) written to the log and to `D:\eqms-dev-backups\ALERTS.log`; verified by one run with an impossible threshold (two alerts written); threshold restored afterwards. Base-backup failure alert is in the script but not yet exercised.
- Restored administration rights without the bypass: new permission set `ADMIN_NO_BYPASS_SET` (id 7320eb88-5b1d-438d-85b9-7aac58f8c5da; 125 permissions = System Administration minus `security.maintenance.bypass`), attached to profile `ADMIN_NO_BYPASS` (id 607e40c8-dcbf-4cda-8887-259d4804fbaa). Attaching both sets in one PUT returned HTTP 409 (cause not identified from the response); attaching the new set alone with POST returned HTTP 200.
- Verified read-only: sys.admin2 has 126 effective permissions and no `security.maintenance.bypass`; admin is the only holder of the bypass.
- Schedule change on the owner's instruction (2026-10-10): a 10-minute test cadence was used (`PG_MAINTENANCE_EVERY_MINUTES=10`); runs `base-20261010-090510` and `base-20261010-091026` succeeded.
- Automatic off-site copy to `D:\eqms-dev-backups` (bind mount `/offsite`): verified for `base-20261010-091026`, checksums OK (`SHA256SUMS-base-wal.txt`).
- The 10-minute cadence was removed because each base backup is about 370 MB and drive D had about 13 GB free; the container is back on the Sunday 03:00 schedule. Repeated test runs need a larger disk or a shorter retention.

## Slice 34 (2026-10-10): WP3.2 — Backup Inspection, phase 1 (SDS 7.2)

- Decisions (owner, 2026-10-10): copy open for 5 minutes; approval by approver.test1 (a different person) with an electronic signature; the requester is admin; phase 1 checks by database queries only, no application on the copy.
- Built in the agent: migration V12 (`backup_inspection`, append-only `backup_inspection_event` and `backup_inspection_check`, two-person constraint, one open inspection at a time); `InspectionService` (request, approve, reject, open, close, expire); `InternalInspectionController` under `/internal/inspections`; job type `INSPECTION` run by the restore worker; `BackupJobWorker.expireInspections` every 15 s on the restore worker.
- Read-only in three layers: `default_transaction_read_only = on` on the copy; the shared role `eqms_inspect_reader` holds SELECT only and the checks switch to it with `SET ROLE`; a write probe must be refused and is recorded as check READ_ONLY.
- Design change during the DEV run: the first attempt (IS-20261010-0001) failed with `permission denied to create role`, because the restore account `eqms_restore` has no CREATEROLE. The fix is one shared NOLOGIN role provisioned once by `scripts/backup/inspection-reader-role.sql` (DEV: run as superuser eqms, which created the role and granted it to eqms_restore). The failed copy was dropped by the service; its ledger events stay (append-only).
- Tests: agent full suite 174/174 passed, including 7 InspectionTest cases (open/close, read-only privileges, expiry at the time limit, requester cannot approve, signature required, one open at a time and rejection, restore failure drops the copy, missing reader role refuses to restore, only approved opens).
- DEV run, IS-20261010-0002 of BK-20261009-1900-0001: requested by admin on DEV before 05:01 UTC, approved by approver.test1 (signature ref is a test value, DEV-TEST-SIG-IS-0002); OPENED 05:01:36 UTC with 10,279 documents; read-only verified from outside (default on, reader has SELECT not INSERT, CREATE TABLE refused in a read-only transaction); CLOSED 05:06:36 UTC by system:inspection-expiry, reason EXPIRED, copy dropped. Ledger seq 332–341.
- Not done: backend endpoints `/backup-restore/inspections` and the real e-signature at approval (the backend must pass the signature token reference); UI; an application running read-only on the copy (phase 2, separate container without the docker socket); the expiry sweeper runs only on the restore worker, so if that worker is down a copy stays open past 5 minutes and there is no separate alert yet; the API close route is POST /close (the SDS design said DELETE, to be agreed).
- Security note: on DEV the superuser eqms can still turn off the read-only default. TEST and PROD must use accounts without superuser.
- Rollback: `drop role eqms_inspect_reader` is not needed for the code; to remove the feature, revert the agent image and drop the V12 objects only with a DBA decision (append-only tables must not be deleted on a live ledger).

## Slice 35 (2026-10-10): WP3.2 — Backup Inspection, backend API (SDS 7.2)

- Agent: the inspection view carries `id` (the row id), used by the backend for audit and signature rows.
- Backend migration V571: signature meanings `BACKUP_INSPECTION_APPROVAL` and `BACKUP_INSPECTION_REJECTION`. No new permission: asking uses `backup.restore.request`, deciding uses `backup.restore.approve`, viewing uses `backup.module.view`.
- Backend `BackupInspectionController` (`/backup-restore/inspections`): list, get, ask (`POST /backups/{id}/inspections`), approve and reject (electronic signature in the same transaction as the decision), close (`POST /{id}/close`, request permission). Each step is audited with the inspection id.
- Tests: `BackupInspectionControllerTest` 7/7; `BackupRestoreRequestControllerTest` 13/13 unchanged; agent `InspectionTest` 7/7.
- DEV: backend and agent redeployed; V571 applied (`now at version v571`); the new endpoint answers 403 without a session.
- Not done: the UI for inspections (list, ask from a backup, approve with the e-signature dialog, close); the approval signature on DEV is still the test value from the agent run, because the UI has not been used yet; the application running read-only on the copy (phase 2); the expiry sweeper's alert when the restore worker is down.

## Slice 36 (2026-10-10): WP3.2 — Backup Inspection, UI (SDS 7.2)

- Screen `Backup Inspections` (route `/backup-restore/restores/inspections`, menu Restore > Backup Inspections): paged list (server-side search by inspection, backup or person; status filter; page size), ask (backup id and reason), approve and reject through the existing `ESignatureModal` (meanings `BACKUP_INSPECTION_APPROVAL` / `BACKUP_INSPECTION_REJECTION`), close without a signature. Approve and reject are hidden from the person who asked. The list refreshes every 10 s while a copy is opening or open; the countdown is for display, the agent closes the copy.
- Agent: the list is paged in the agent (`page`, `limit`, `search`, `status`), with the same `pagination` shape as restore requests.
- Backend: list passes search, status, page and limit to the agent; an unknown status is refused (400).
- Tests: frontend `InspectionsView.test.tsx` 5/5; `features/backup-restore` and `features/maintenance` 102/102 (15 files); `tsc` shows no error in the changed files (two errors in `ReportLists.test.tsx` were already there). Agent `InspectionTest` 7/7; backend `BackupInspectionControllerTest` 7/7.
- DEV: agent, restore worker, backend and frontend redeployed.
- Not done: a click-through of approval with a real signer on DEV (needs the approver's own sign-in; not done by the agent); phase 2 (an application running read-only on the copy); the alert when the restore worker is down during an open copy.
- Not done, by design: the close action does not need an e-signature. Closing early only drops a copy; it changes no data. Owner to confirm.

## Slice 37 (2026-10-10): WP3.2 — Backup Inspection, end-to-end run on DEV through the backend

- Asked by `admin` through the backend (`POST /backup-restore/backups/{id}/inspections`); approved by `approver.test1` through the backend, with the approver's own sign-in and `POST /auth/verify-signature` (valid), signature `ESIG-2026-003912`. The approval is recorded in the signature table and in the ledger (INSPECTION_APPROVED, seq 351).
- IS-20261010-0004 of BK-20261009-1900-0001: OPENED 06:33:38 UTC with 10,279 documents; CLOSED 06:38:39 UTC by `system:inspection-expiry`, reason EXPIRED (ledger seq 354). No `inspect_*` database left.
- Earlier attempt IS-20261010-0003 (approved with ESIG-2026-003911) FAILED: `permission denied to set role "eqms_inspect_reader"`. Cause: membership of `eqms_restore` in the reader role had been lost. The agent test `withoutTheReaderRoleNothingIsRestored` dropped the shared role on the DEV server and recreated it without that membership. Fixed on DEV (membership granted again) and in the test (rename away and back, no drop). Agent `InspectionTest` 7/7; membership verified after the run.
- The failed copy of IS-20261010-0003 was not dropped by the service (`permission denied to terminate process` was logged, the alert INSPECTION_NOT_DROPPED was raised). It was dropped by hand on DEV after confirming its name (`inspect_is_20261010_0003`) and that no session was attached.
- Not done: the service does not retry dropping a copy after a failed open; the test server is the DEV server, so tests still touch shared DEV objects (role, databases); the UI click-through in a browser has not been done (the same endpoints were used).

## Slice 38 (2026-10-10): Flyway history on DEV and the test run; sys.admin2 retired

- Cause of the 33 integration failures: DEV applies V558 and V559 from `db/migration-dev` (docker-compose.yml sets `SPRING_FLYWAY_LOCATIONS`). The integration tests run against the same DEV database with the default locations, so Flyway refused the history ("Detected applied migration not resolved locally: 558/559"). Not caused by the backup changes.
- Fix (test configuration only): `pom.xml`, surefire `environmentVariables`: `SPRING_FLYWAY_LOCATIONS=classpath:db/migration,classpath:db/migration-dev`, with a comment. Runtime and production configuration are unchanged; the controlled-environment guard still refuses migration-dev.
- Verified: the 5 classes still showing the error, plus the earlier 2 (ClamAvScanServiceIntegrationTest, ControlledCopyBatchDiscrepancySortIntegrationTest), all pass with no "not resolved locally" line. The full backend run that was started could not be completed: it was stopped when the previous session ended, so the full result is not claimed here.
- sys.admin2 (no longer used): suspended by `admin` through `POST /api/settings/users/{id}/suspend` with an e-signature from admin. Status `Suspended`, reason recorded. Reversible with `POST /api/settings/users/{id}/reinstate`. The profile `ADMIN_NO_BYPASS` stays assigned, so that reinstating restores the previous state. Sign-in as sys.admin2 was not tested (no password held).

## Slice 39 (2026-10-10): Backup Inspection, failed copies and overdue warning (SDS 7.2)

- A copy whose open failed and could not be dropped is recorded with close reason `OPEN_FAILED_NOT_DROPPED`. The restore worker tries again every 15 s (`retryUndropped`) and writes `INSPECTION_DROP_RETRIED` when it succeeds.
- On the agent that is not the restore worker: an OPEN copy more than 2 minutes past its time raises alert `INSPECTION_OVERDUE`, once per 30 minutes per inspection (the restore worker may be down).
- Tests: agent `InspectionTest` 9/9 (new: retry drops the copy; a missing worker is warned once); agent full suite 176/176.
- DEV: agent and restore worker redeployed.
- Not done: the approval permission for inspections is still the restore approval permission (owner to decide whether to split it); closing a copy needs no e-signature (owner to confirm); test runs still use the shared DEV database.

## Slice 40 (2026-10-10): owner decisions on Backup Inspection

- Inspection approval keeps the restore approval permission (`backup.restore.approve`); no separate permission. Decided by the owner.
- Closing a copy does not need an electronic signature. Decided by the owner.
- Tests keep running against the shared DEV database; no separate test server. Decided by the owner.

## Slice 41 (2026-10-11): full backend test run on DEV

- Full run (1426 tests, 26 skipped) before these fixes: 5 failures, 1 error. Flyway is no longer among them.
- Fixed in tests only (no runtime change):
  - `SystemAnnouncementServiceTest.createWritesAnAuditEntryWithTheActor`: the window was built from a fixed date (2026-10-08) and `create` checks the real clock; the window is now built from `Instant.now()`.
  - `PermissionDependencySeedDataIntegrationTest`: expected count 44 was stale; the table holds 57 rows after the backup permission migrations (V561-V567).
  - `RecallByScanMigrationIntegrationTest`: `ADMIN_NO_BYPASS_SET` (a copy of System Administration without the maintenance bypass, created on DEV for the administration account) holds blanket visibility; it is added to the administrator sets and the SQL placeholders are 9.
- Result of the fixed classes: SystemAnnouncementServiceTest 18/18, PermissionDependencySeedDataIntegrationTest 4/4, RecallByScanMigrationIntegrationTest 8/8.
- Still failing, not caused by these changes (not changed here):
  - `Sprint10AuthorizationHardcodeRegressionTest.navigation_withoutPermissionsGetsEmptyMenu`: `NavigationService` always adds the Calendar item (not changed in this work). Needs a decision: Calendar for everyone, or permission-gated.
  - `DocumentListVisibilityParityIntegrationTest`: the revision list differs from the detail visibility for a user without permissions; the test ran for about an hour before failing. Document visibility is not part of this work; needs its own investigation.

## Slice 42 (2026-10-11): admin is the only system administrator

- Owner decision: sys.admin2 is no longer used; `admin` is the only account that administers the system.
- Checked on DEV (2026-10-11): active accounts holding System Administration or the administration set without bypass: `admin` only. `sys.admin2` is Suspended since slice 38 (profile ADMIN_NO_BYPASS kept so that reinstating restores the previous state). The maintenance bypass (`security.maintenance.bypass`) is held only by `admin`.
- Not done: removing sys.admin2's profile assignment (kept for reversibility; to be decided by the owner).

## Slice 43 (2026-10-13): time-based checks tested on a simulated clock

- Change: the weekly V2 verification takes the agent's clock (`ClockConfig`, `Clock.systemUTC()` in production) instead of reading `Instant.now()`. Callers: `InternalRestoreController` (Spring) and `RestoreRehearsalTest` (passes the system clock). Constructor-only change; no behaviour change.
- Test `ScheduleSimulationTest` (6 tests) moves a simulated clock to each Monday 05:00 and each daily 06:00 and runs the scheduler's methods. Covers: the cron expressions (weekly Monday 05:00, daily 06:00, Asia/Ho_Chi_Minh); eight weeks on schedule (no MISSED, no overdue); one skipped week (MISSED once, one catch-up); an assumed 21-day cycle (MISSED raised in every cycle); overdue after eight days without a passed check; and no overdue before the eight days.
- Observed in the simulation (not a policy decision; the 3-week cycle is an assumption): 3-week cycle over 9 weeks gave 6 MISSED, 6 MISSED alerts and 9 V2 verifications. With every check failing, `BACKUP_V2_OVERDUE` was raised 23 times in 23 days (once per day). This daily repetition is a finding for the owner: a single alert per overdue period may be intended instead.
- Tests: agent full suite 182/182. DEV: agent and restore worker redeployed; both started.
- Not covered by simulation: the rehearsal's own run (its timestamps come from the database clock, not the simulated clock; covered by RestoreRehearsalTest); the V3 monthly check (not built); the base backup schedule (shell script, separate test).

## Slice 44 (2026-10-13): evidence download on screen; base backup failure exercised

- Restore History screen: a column Evidence with Download. It fetches `GET /backup-restore/restores/{id}/evidence`, saves the signed pack as `{requestId}-evidence.json`, and shows its SHA-256 in the message. Errors show a message and no file. Tests: `RestoreHistoryEvidence.test.tsx` 2/2; `features/backup-restore` 85/85. Frontend redeployed on DEV.
- Base backup failure alert (SDS 15.1), exercised: a one-off run of `pg-maintenance` with an unresolvable host (`PGHOST=no-such-host.invalid`, RUN_NOW=1). Result: the failed directory was removed, `ALERT base backup FAILED` written to the log and to `D:\eqms-dev-backups\ALERTS.log`; retention and WAL cleanup did not run (the failure branch returns first). The 5 existing base backups were untouched. The probe container was removed.
- Finding (owner attention): drive D is 96% full (about 4.4 GB free). The low-space alert is active and below the 5,120 MB minimum. Old base backups were not removed: deleting them is the owner's decision.
- Not done: restore history for completed restores (needs a real restore run); the remaining items in the SDS status table (see the status row).
