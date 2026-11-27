# Change record: Training Management adjusted to SOP.0003.02 (DEC-TRAINING-2026-11-27-01 and -02)

**Date:** 2026-11-27. **State:** built, not committed, not deployed to DEV, verified on a clone of the DEV database and in a browser on that clone (see Evidence). Not a GMP approval. Plan: `docs/plans/KE_HOACH_DIEU_CHINH_TRAINING_THEO_SOP0003_2026_11_27.md`; the gaps: `docs/to-be-sds/training/GAP-TR-007-sop0003-versus-code-2026-11-27.md`.

## Built

| Item | What changed | Migration |
|---|---|---|
| A1 | One rule `training_requirement_state` (MISSING, UPDATE_NEEDED, DUE, OK) used by the gap list and compliance report, matrix completion, job assignment, proposed participants and the review lines. New standing "New revision not trained". A job assignment is stopped by MISSING and UPDATE_NEEDED, not by a periodic due | V870 |
| D1 | Periodic training falls due by the review cycle of the document (12 months when it has none or the row is a topic) | V870 |
| A2 | Quality Assurance marks GMP rows; the trainer check uses them; while no row is marked the old name rule applies | V871 |
| C | One factory-wide list (a second matrix of the QA department, scope FACTORY), required of every department through the view `training_effective_requirements`; shown with a department matrix, written into its APD.0011; people whose department is not in the dictionary are counted | V872 |
| A3 | The department that owns a new version names the related departments; each has its own line and its own signed assessment; the notice waits for all | V873 |
| E1 | A new version opens with one session for each department that must learn it, the Department Head proposed as trainer | V873 |
| B1–B7 | The checklist of a review: training lines come from the matrix (by Job Role), done only by a record; specimen signature, job assignment and hand-over are done only by a record after the event; closing refused while a line is pending; the closed review keeps what it was closed with; Job Roles chosen on the review; retraining chosen after an absence; the assigned employee of a department transfer; an initial class (one activity, sessions by group), joined by later new employees or copied from an earlier class | V874 |
| B8 | A configurable template for the other items (SOP items locked) with its own screen | V874 |
| D2 | One plant-wide annual requirement, suggestions from every department, the contents of SOP.0003 5.3.2 named when missing (a reminder), approvers carry the Quality Manager mark | V875 |
| D3 | Reminder to heads of department to review the matrix, in the month of Training Properties | V876 |
| H | The system recognises a new employee, a return after more than the months of the SOP, a move to another department, a change of position and a missing start date; alerts on the Training Reviews page and in the menu count; notice to the heads and, for a new employee, Quality Assurance; an alert ends when the review is opened or when it is dismissed with a reason and a signature; manual scan for administrators | V876 |
| F1 | A specimen signature is filed by a person who manages signatures after confirming the paper carries the Head of department's signature | — |
| F2 | An account suspended for leave stays on the list as away, is not invited | — |
| F3 | The number allocation log shows postponement reasons | — |
| F4 | A line of the preparation can be given to a department; its trainers are told | V877 |
| F5 (part) | The matrix approver dialog says SOP.0003 asks for the Head of QA | — |
| F6 | Materials of earlier trainings can be used again (a copy; the content is still reviewed) | — |

**Decisions in chat:** DEC-TRAINING-2026-11-27-01 (all ★ options, one run) and -02 (a person who never trained on a matrix row must train whatever the Requires Training tick says).

## Built in the second run of the day (owner: "làm tiếp các mục chưa làm, kể cả phần Security")

| Item | What was built | Migration |
|---|---|---|
| H1-a hook | `UserLifecycleListener`; User Management tells Training after commit of a create, suspend, reinstate and of a change of department, position or start date; the Training scan runs at once. A failure in the listener never stops the account change | — |
| H2.2 kind of suspension | `StatusActionRequest.suspensionKind` (LONG_LEAVE or OTHER), required on the server and on the Suspend dialog; written in the Audit Trail comment; OTHER never raises a return alert | — |
| H2.1 start date | A new user needs a start date (server and screen) | — |
| F5 two-step matrix approval | Draft -> Pending Review -> Pending Approval -> Effective; reviewer holds `training.matrix.manage` in the department; preparer, reviewer and approver are three different people; reject at both steps; content frozen from submission; new signature meaning TRAINING_MATRIX_REVIEWED; policies REVIEW and REJECT at PENDING_REVIEW; screens: Submit for Review, Complete Review | V878 |
| D2.3 contents list | Screen "Required Contents" on the requirements list (Training Administration), every change with its reason in the Audit Trail | — |

## Not built, and why

| Item | Why |
|---|---|
| E1 / A3 end to end with Document Control | Checked with unit tests, SQL and an activity inserted by hand; the approval of a real revision was not run |
| Matrix versions that were Pending Approval before V878 | Keep their state and finish with one approval step (no review is invented for them) |
| G1–G4 | Out of scope by owner decision |

## Evidence (clone of the DEV database `eqms_train_clone`, isolated backend :5100 and Vite :3112; DEV was not touched by the tests)

- Backend: the whole suite on the clone, 3240 tests, 0 failures, 62 skipped (as before). 18 tests of two Document Control classes (`ControlledCopyEndToEndIntegrationTest`, `UncontrolledCopyValidityIntegrationTest`) first errored with "Unable to connect to Redis" because the Redis container is not published to the host; with a temporary local Redis they pass 18 of 18. Frontend: 414 files, 2430 tests; four files that time out under load (DashboardRoleDefaults, ControlledCopyRecallScanView, NotificationEventView, NavCountBadge) pass alone, 85 of 85. Type check clean.
- `evidence/TRAINING_REQUIREMENT_STATE_2026_11_27.sql` (11 scenarios), `evidence/TRAINING_FACTORY_LIST_2026_11_27.sql` (6), `evidence/TRAINING_REVIEW_ITEM_STATE_2026_11_27.sql` (10): all ok.
- `evidence/training_2026_11_27/e2e_sop_adjustment.py`: 53 checks through the API of the isolated backend, repeatable, 0 failures.
- `evidence/training_2026_11_27/e2e_f5_security.py`: 35 checks (preparer/reviewer/approver, every refusal, reject at review, frozen content, kind of suspension, alert at once without the scan, OTHER raises none), 0 failures. It found that the server accepted a suspension without a kind; fixed and covered by a unit test.
- Backend after the second run: `UserManagement*Test` and `Training*Test` 430, 0 failures; 3 older tests that described the one-step matrix were updated (stepper, policy count, audit text). Frontend: training and profile 59+ files, 0 failures; new tests `SuspendModal.test.tsx`, `MandatoryTopicsDialog.test.tsx`.
- Screenshots g1-g5 (suspend dialog with the kind, Required Contents, matrix in Pending Review, choosing the approver).
- `evidence/training_2026_11_27/screens/`: screenshots of the checklist, the Job Roles and class dialogs, a class with two employees, the alerts, the template screen, the factory-wide list, the plant-wide requirement, the compliance summary and the material library.
- GitNexus upstream impact before editing: LOW or MEDIUM for the symbols checked; the Security module (User Management) was edited in the second run with a small, listener-based change (impact LOW). `detect_changes` not run (nothing committed; the tree holds other sessions' work).

## To know before using it on DEV

- V870–V878 add data structures (V878: the matrix review step); V870–V872 were already applied to DEV by an earlier rebuild during this work. Rebuild backend and frontend, then open the Training Reviews page.
- Open reviews created before this change keep their old items; the new "Refresh from the matrix" button brings them to the matrix. Items already done stay done.
- The alerts start from the last 90 days of the Audit Trail and from the start dates in the user profiles; DEV test accounts with an employee code and no start date will show as "Start date missing".

## Not verified

The full browser walk through Complete Review with the real e-signature and the approval by the third person (the API path was run, the screens were opened up to the choice of approver), creating a user without a start date (code and unit-level check only), the dismissal dialog with the real e-signature in the browser, the retraining and Job Roles dialogs in the browser, the Word/PDF output of APD.0011 with the factory-wide rows, and the e-mail wording of the two new notification events (English only, no Vietnamese wording yet).

## Training Reviews page: two tabs (2026-11-27, after the owner's review on DEV)

- The page has the tabs **Alerts** and **Reviews** in one card, built like Job Assignments (tabs, filters, sortable columns, column chooser, Action menu, paging; the server does the search, filters, sort and paging). The alerts tab opens first when there are open alerts. The old yellow panel and the "started in the last 60 days" banner are removed, with the endpoint `/training/personnel-reviews/suggestions` that fed it (new employees now come from the NEW_HIRE alerts, which look back 90 days; a start date in the future is no longer offered).
- **Defect found by the owner on DEV and fixed:** `GET /training/personnel-reviews` returned 500 because the list query selected the array column `job_role_ids`. The earlier tests did not call the list against a real database. Fixed (the column is not needed by the list) and checked on DEV: 200 with 7 reviews.
- "Waiting for me" on the Reviews tab now counts only the reviews it filters (the menu number also counts alerts).
- Owner decision (in chat): the "Waiting for me" button of the Reviews tab is replaced by a **Closer** filter (person chosen to sign an open review, or who signed a closed one); "Ready to close" stays in the Status filter. New endpoint `GET /training/personnel-reviews/closers`, limited to the reviews the person may see; the Closer column now also shows who closed a closed review. Other Training lists keep their button. Checked on DEV (2 closers, filter returns their reviews; no open review has a chosen closer there, so that branch was not run with data).

## Training Review detail made simpler (owner: "làm 4 thay đổi trước đi", 2026-11-27)

- Job Role is asked in the New Review dialog (optional there) and shown as one line with "Change" on the checklist; the chooser is the server-side searchable, paged list used by Job Assignments, limited to the department of the matrix.
- The "Refresh from the matrix" button and its endpoint are removed: `GET /training/personnel-reviews/{id}` brings an open review up to the matrix, Job Roles and template, and writes `TRAINING_PERSONNEL_REVIEW_CHECKLIST_UPDATED` to the Audit Trail when a line changes. Note for QA: reading an open review can therefore change its lines (never a closed or cancelled one); the list of reviews is not recalculated until a review is opened or closed.
- One button "Arrange training" (shown while a training line has no class); the dialog puts the suggested way first. After an absence the button stays "Choose training to repeat": making a class for retraining is not built.
- The Matrix Gaps tab and its endpoint are removed; the checklist has the column "Last trained" (with "Annual training due" or "New revision not trained").
- Checked: personnel review backend tests (7), training and job screens tests, `tsc`; DEV screens i1-i4. Not clicked through on DEV: adding a person to a class and opening a new review (they change data).
- Seen, not changed: 8 tests of `TrainingAssessmentDetailPage` fail after an edit of that page made outside this work (15:43); DEV has 99 active "E2E-TEST" Job Roles in Quality Assurance.

## DEV clean-up and click-through (owner: "tôi cho bạn làm hết", account admin, 2026-11-27)

DEV data changed through the API (audited):
- Head of department of Quality Assurance changed from "Lương Thị Hạnh (UAT)" (`uat31.head.qa`, set by the UAT script of 31/10; no right to close reviews) to the admin account. To restore: set the head back in Departments.
- 30 "E2E-TEST" Work Positions nobody holds and no matrix uses were deactivated (not deleted). 75 stay active: 69 are held by people, 6 are in a matrix.
- A test review of Trainee Test 2 was opened with a Job Role, the person was added to an open class, and the review was cancelled with a reason. The person stays on that class.
- The "Start date missing" alert of TEST-APPR-01 was dismissed with an electronic signature.

Code: the dismissal asked for the reason twice (own dialog, then the signature); it now asks once, in the signature. "1 lines" now follows the count. Assessment tests: the page keeps its tab (a change of another session), the tests now start without that memory.

Two-step matrix approval run on DEV afterwards (owner: "tự tạo tài khoản để test"): two new accounts `f5.reviewer` (NTP.9993, Training - Department Coordinator) and `f5.approver` (NTP.9994, Training - QA Manager), each also given the base profile "Training Trainee (DEV test)" because the Training profiles hold no `training.module.view`; admin submitted, the reviewer completed the review and the approver approved **on the screens** with their own electronic signatures (MFA code from Mailhog). Matrix of Mechanical and Electrical: version 2 is Effective with the same rows as version 1, now Obsoleted. Both accounts are suspended (kind OTHER) and kept for the record. Screens k0-k5.

- Owner follow-up: the Job Role line on the checklist is removed (it listed every held role); "Change Job Role" and "Arrange training" (or "Choose training to repeat") sit in the footer beside Cancel and show on the Checklist tab only. Checked on DEV (screen l1).
- Second follow-up: no icons on the two commands; they sit to the right of Cancel and the same four buttons (Back, Cancel, Arrange training, Change Job Role) are repeated in the page header.

## Addresses, routes and links made to follow the sidebar (owner: "quét lại toàn bộ... đảm bảo đường dẫn chính xác theo chức năng", 2026-11-27)

Method: the routes the application serves were read from the route files, and every address in the sidebar, the frontend (navigate, links, ROUTES constants), the backend (menu copy, notification and e-mail links, event registry) and the database (stored links) was checked against them; calls of the API layer were checked against the controller mappings.

Found and fixed:
- **Review Checklists** (was "Review Checklist Templates" under Training Reviews) moved to System Administration > Training Administration: `/settings/administration/training/review-checklists`, permission `training.admin.manage` unchanged; the old address `/training-management/personnel-reviews/templates` redirects; the button on Training Reviews is removed; sidebar and server menu have the item.
- Server menu (`NavigationService`, used by the global search): Training Matrix pointed to `/training-management/matrices` (not served) and was called "Training Matrices": now `/training-management/matrix`, "Training Matrix".
- Default links of the notification events (`AuditNotificationEvents`): `/controlled-copies`, `/uncontrolled-copies`, `/knowledge`, `/security/object-access-rules`, `/security/workflow-authorization`, `/settings/administration/backup/restore` pointed to addresses that do not exist or only exist as an old redirect; now the real screens. `/security/object-access-rules` has no screen any more. The event is still live (it is raised when a Knowledge Base share is created, changed or taken away; the table `object_access_rules` and the permission `security.object_rules.manage` are still used by Knowledge sharing), so it was kept and now opens Security & Authorization > Access Review, where the shares are managed (V886 corrects the 208 stored notifications; the first choice, Access Profiles, was wrong).
- V885 corrects the address of the notifications already stored (about 280 rows: 56 `/controlled-copies`, 208 `/security/object-access-rules`, restore links, and others); title, message and status are untouched.
- The alert action "Make a job assignment" sent `?person=` that the page did not read: the page now chooses the person from the link.
- Four unused ROUTES constants pointing to screens that do not exist were removed; the file the server reads for menu names was regenerated.
- Checked and clean: 100 sidebar addresses, all ROUTES constants, the frontend literals, the Training breadcrumbs against the menu, the ids of the task counters, the ids and parents of the server menu against the sidebar, and the Training API calls against the controllers.
- Seen, not changed: unused older calls in `services/api/shared.ts` and `metadata.ts` that have no controller (nothing in Training uses them); the sample notification of the bootstrap with a fake document id; `/training/people` needs the permission to organise activities, while creating a job assignment needs the permission to manage job assignments, so a person with only the second cannot search people on that page.
