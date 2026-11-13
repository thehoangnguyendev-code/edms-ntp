# Document Control visibility run, 2026-11-07 (DEV only)

Scope: Document, Revision, Controlled Copy, Uncontrolled Copy, Records, Audit Trail tabs, Knowledge Base, menu per person. Accounts and profiles: `../../DEV_TEST_DOCUMENT_CONTROL_ACCOUNTS_2026_11_07.sql` (shared DEV test password, supplied by the owner in the session, not stored).
Scripts: `dcv_run1.py` .. `dcv_run4.py` (password only through the environment variable DEVPW). Raw results: `results.json` (history of every attempt, including runs that were later corrected), pictures: `shots/`.

## People and profiles
| Account | Profile | Role in the run |
|---|---|---|
| dcv.u1 / u2 / u3 | DC Contributor (one profile) | U1 Author of X and Reviewer of Y; U2 Reviewer of X and Author of Y; U3 Approver of both. Z: U1 Author, U2 Reviewer, U3 Approver |
| dcv.operator | DC Operator + View Everything + Controlled Copy DCO | creates, publishes, distributes, recalls |
| dcv.viewall | DC Contributor + View Everything | sees all, no name in any flow |
| dcv.approver | DC Contributor + Uncontrolled Copy approver | outside the flows |
| dcv.reader | DC Knowledge Reader | Knowledge Base only |

## Result (latest result of each of 148 checks)
All pass. Three entries that still read FAIL in `results.json` (S3.1, X.0, Y.0) came from an early version of the script that called a step (`complete-editing`) which no longer exists (HTTP 404); the same negative checks were repeated on revision Z (S3.1, S3.1b, S3.2, S3.2b) and pass. S16.1 (Author starts an upgrade) is refused by design: the Contributor profile does not hold `documents.revision.upgrade`; see Decisions.

What was shown:
- One profile serves a person who is Author on one document and Reviewer on another: the action is allowed only on the document where the name is (S3, S5, S6, S13).
- Visibility: only a name in the flow or the view-everything bundle; Draft revisions, rejected revisions and a new revision 2 are not seen by the approver-outsider or by the Knowledge-only reader (S1, S2, S4, S6, S7, S13, S16). List and detail agree for every person.
- Controlled Copy: seen by the recipient, the operator and view-everything holders, not by other flow members; only the operator distributes and recalls (S9, S15).
- Uncontrolled Copy: the approver sees a request only while it waits for a decision (S10, S14); the requester keeps seeing it; other flow members do not.
- Knowledge Base: with the mode Own Department the reader reads the Effective documents of their Department; in mode SHARING (the DEV setting, restored after the run) nothing is visible until a Head shares (S8).
- Records: only the holder of the Records permission (S12). Audit Trail tabs follow the screen (S11).
- Menu per person (API `/navigation`): the reader sees only the Knowledge Base; the approver sees only the Uncontrolled Copy entries.

## Defects found and fixed in this run
1. The detail page of an Access Profile did not show the Document Control visibility label (only the list did): added.
2. Wizard checkbox text read "Self_service.Knowledge.View" (a code shown through a capitalising style): now "Allow reading Effective documents in the Knowledge Base".

## Findings that need an owner decision (nothing changed)
F1. A person who is neither named in the flow nor ticked with view-everything cannot see a document they created and cannot start its first revision (HTTP 403). Picture `shots/F1__operator-without-view-all-sees-nothing.png`. Real DCO profiles hold view-everything, so the system works; the sample Operator profile must therefore include it.
F2. Starting a new revision of an Effective document needs `documents.revision.upgrade`, which the Contributor profile lacks, so the Author cannot start revision 2.
F3. Generating and distributing an Uncontrolled Copy both need the permission `documents.uncontrolled_copy.distribute` (the error text says "generate").

## Not done
Records upload / paper return flow; recall of Uncontrolled Copies; Obsolete of a Document with copies out; users of other Business Units; e-signature failure paths. The effect on the real people (not test accounts) of the migrations V745/V746 was not tried with real accounts. GitNexus impact analysis was not available in this session.

## Follow-up 2026-11-08 (owner answers and fixes)
- F1 re-examined: the creator is one person, normally a DCO who holds view-everything, so no 'creator sees own document' rule was kept (built and removed again, nothing of it remains). The real defect found on the way: opening a revision (`RevisionService.createRevisionFromDocument`) required the view-everything permission, so an observer ticked with view-everything could open revisions while an operator holding only `documents.workspace.manage` could not. Fixed: `DocumentAuthorizationService.canManageRevisionWorkspace` now follows `documents.workspace.manage`. Checks F1.2 (observer refused), F1.3 (operator not ticked does not see foreign documents), F1.4 (DCO opens a revision) pass. Side effect on DEV: profile ADMIN_NO_BYPASS (view-everything without the workspace permission) can no longer open revisions.
- F2 decided: the Author may start a new revision; no code change, only the permission `documents.revision.upgrade` in the profile (added to the DEV Contributor set). F2.1 (Author of Y starts revision 2) and F2.2 (Approver refused) pass.
- Access Profiles banner: the migration report counted every account (5589) and returned 5523 rows; it now counts ACTIVE users only (562, 56 mapped, 506 without profile), reads the profiles in one batch, and returns at most 50 rows. 4580 of the old count were Suspended `baseline.noperm.*` fixtures left by Spring tests on the shared DEV database.
- Dead data: `PermissionDependencyGraphService` has no caller; the table `permission_dependencies` (60 rows) is read by nobody at run time; the auto-tick of the view permission is done by the frontend from permission codes. Proposal: drop table, entity, repository and service in one migration (awaiting owner confirmation).
- Not done yet: merging the diagnostic tools, redoing the Workflow Authorization screen, marking test profiles and sets.

## Follow-up 2026-11-09 (owner decisions: creator sees own document, Co-Author sees what they are named on)
- Owner reversed the earlier choice: the creator of a Document always sees it (and its revisions), also when the creator is not ticked with view-everything. Rebuilt in `DocumentAuthorizationService` (document check, revision check, document list predicate, revision list predicate; field `owner`) and in `DocumentControlMenuAccess` (`DocumentRecordRepository.existsByOwner_Id`). Unit tests: `DocumentAuthorizationServiceTest` 38 pass (creator sees; another creator does not; Co-Author participant of a revision sees).
- Live (DEV, `dcv_run5.py`, `dcv_run6.py`): the creator without view-everything sees only the document and revision they created (F1.*, 5 checks pass); document V with Co-Author U2: Co-Author, Author, Reviewer, Approver and the operator see it, the creator-who-did-not-create-it, the Knowledge reader and an unrelated approver do not (V1.*, V3.*, 14 checks pass); Co-Author cannot open or upload a revision (V2.2, V2.3); the Author's upload creates the revision (V2.4) -- it needs `documents.revision.upload_source` plus the Author name, not the workspace permission.
- F2.1 reads FAIL on re-run only because revision 2 of Y was already started in the earlier run (a revision is in progress).
- Engine Diagnostics: Policy Resolver, Simulator, Relation Definitions and Engine Health are now four tabs of one page (`/security/authorization-diagnostics`); the old `/security/lifecycle-policies/policy-resolver` address redirects. `tsc` clean, security-authorization vitest 28 pass. Not looked at with a browser yet (no account with security permissions in the test set).

## Cleanup 2026-11-09 (owner chose all four items)
- Table `permission_dependencies` dropped (migration V747) with its entity, repository, service and two test classes; one integration test lost its check of that table (the set content check stays). Nothing read the table at run time.
- Test data marked (V748, V749): column `test_data` on `roles` and `permission_sets` (display only, grants nothing); 26 profiles and 29 sets flagged by their code (UAT, DCV, *_TEST, *_DEV_TEST, QA_REASON_TEST_*); an amber "Test" badge in the Access Profile and Permission Set lists and detail pages. Real profiles with no users yet (TRN_*) and unused module-manager sets were NOT flagged. Nothing deleted.
- Engine Diagnostics: four tabs on one page (Policy Resolver, Simulator, Relation Definitions, Engine Health).
- Workflow Authorization: the Action Matrix (who may do which action from which status) is now the first and default tab, its text explains "permission AND right person", and the two rule-editing tabs carry an "Advanced" notice. Tab names unchanged because breadcrumbs elsewhere use them.
- New DEV test account `dcv.secadmin` (profile DCV_SECURITY), `DEV_TEST_SECURITY_ADMIN_ACCOUNT_2026_11_09.sql`; screenshots `shots/WA0__*` (before) and `shots/WA1__*` (after), script `dcv_shots_sec.py`.
- Not done: a "hide test data" filter in the lists; the plain-language matrix does not yet name the catch-all permission `documents.workspace.manage` per action.

## New Access Profile: wizard only (2026-11-09)
- The "Guided / Advanced" choice dialog was removed; **New Access Profile** opens the wizard directly. The old `/access-profiles/new` link redirects to the wizard. The "Advanced" create form (`NewProfileForm`, the `isNew` paths of the detail view, `settingsApi.createAccessProfile`) was deleted from the frontend.
- Kept: the wizard's "Pick individual permissions" tab (owner decision: keep until the owner decides how individual permissions are managed). Backend `POST /security/access-profiles` (`createProfile`) is still present and now has no screen using it; not removed (API/audit catalogue entry), decision open.
- Tested on DEV with `dcv.secadmin` (`dcv_wizard_only.py`, 7/7 pass: button goes to wizard, no dialog, old link redirects, detail page opens, tabs switch, Edit mode shows Cancel and disabled Save) and `dcv_wizard_create.py` (created "DCV-TEST wizard only profile" end to end with e-signature; row exists, active, 2 permission sets linked). tsc clean; vitest security-authorization 28 pass.
- Not tested: a user who has `access_profiles.update` but not `.assign` (the wizard route is refused for them and the button still shows); saving an edit on the detail page after the `isNew` removal (only opened Edit, not saved).

### Follow-up (2026-11-09): button by permission, old create API removed
- The **New Access Profile** button now needs `security.access_profiles.update` AND `security.access_profiles.assign` (same as the wizard route and `createProfileFull`).
- Removed the old create API: `POST /security/access-profiles` (`SecurityAccessProfileController.create`), `AccessProfileService.createProfile`, and `"create"` from `AdministrativeOperationCatalog`. Live check on DEV: the POST now answers 405 and no profile was created.
- Tests: `AdministrativeOperationCatalogTest` 4 and `AccessProfileServiceSecurityTest` 13 pass (after deleting stale `target/test-classes`; they had "Unresolved compilation problems" from an old build, not from this change). tsc clean. Wizard UI checks 7/7 still pass.
- Not tested: the button hidden for a user who has `update` but not `assign` (no such DEV account; only checked the code and that the button still shows for `dcv.secadmin`, who has both).

## Role profiles + upgrade of SOP.7147 (2026-11-09, DEV)
1. **Role profiles** (`dcv_role_profiles.py`, through the New Access Profile wizard, custom permissions, e-signed): `DCV-TEST Author profile` (dcv.u1), `Co-Author` (dcv.u2), `Reviewer` (dcv.u3), `Approver` (dcv.approver). Shots `RP-*`.
   - First attempt failed twice, both by design or gap: (a) the wizard's Users step said "Failed to load users": `dcv.secadmin` lacked `settings.user.view`, which the wizard needs but its route does not require (gap, see below); fixed for the test account with `DEV_TEST_SECURITY_ADMIN_USER_VIEW_2026_11_09.sql`. (b) the old catch-all profiles on the 4 accounts made the SoD check block the new profile (submit+review+approve); they were taken off with `DEV_TEST_UNASSIGN_OLD_DCV_PROFILES_2026_11_09.sql` (put back with `DEV_TEST_RESTORE_OLD_DCV_PROFILES_2026_11_09.sql`).
2. **Upgrade** of the Effective document SOP.7147 "UAT8 compliance SOP" (Quality Control, rev 1.0.0, admin as old Author), shots `UP1`..`UP6`:
   - `dcv.operator`: Edit Revision for Upgrade, new Author = dcv.u1, Co-Author = dcv.u2, Reviewer = dcv.u3, Approver = dcv.approver (old approver removed), Review Date 30/11/2026, Description; Save. DB confirms the four participants and Author.
   - `dcv.u1` (new Author): Upload Revision with a new .docx -> revision **1.0.1 Draft** created (author and owner dcv.u1), page "Revision Create" opens with Submit for Review.
   - Visibility of revision 1.0.1 (API): dcv.u1, u2, u3, approver, operator = 200; Knowledge reader = 403.
3. **Found, not fixed:** (a) wizard shows only "Unexpected error — nothing was created." when the server refuses (SoD, etc.): it reads `data.message` but the API answers `data.error.message`. (b) The wizard needs `settings.user.view` for the Users step, but the route requires only access_profiles update+assign. (c) "Save Next-Revision Configuration" dialog shows Author and Co-Author as raw user ids, Reviewers/Approvers as names. (d) SOP.7147 Valid Until is 22/09/2021 (already past); upload still worked.
4. **Not done:** submit for review, review, approve, publish of 1.0.1; open the file online (needs Office Online); Co-Author/Reviewer/Approver screens of 1.0.1.

## Wizard fixes, no-UUID sweep, revision 1.0.1 workflow (2026-11-09, DEV)

**Fixed (uncommitted, deployed to DEV)**
- Wizard shows the server's real reason (uses `getApiErrorMessage`, reads `error.message`).
- Wizard Users step: without `settings.user.view` it does not call the user list; it says users can be assigned later.
- "Save Next-Revision Configuration": Author/Co-Author shown by name (cache filled from the picker search; verified on DEV by `dcv_fix3.py`, screenshot `FIX3__1-save-dialog.png`, no UUID in page text).
- No-UUID: removed `|| id` display fallbacks in 15 frontend files; aria-labels "Expand revision" / "Expand controlled copy batch" use document+revision number / batch number; Access Profile audit text "User (uuid)" now "Name (username)"; activation audit text uses the revision number.
- `RevisionTableView.test.tsx` updated for the new aria-label.

**UUID scan** (`dcv_uuid_scan.py`, 120 routes + first row detail + tabs, accounts dcv.operator, dcv.secadmin, dcv.u1): 108 hits before the fixes, all in aria-label/title or audit text; no hit in visible page text.
Limits: only the first row of each list, only data these accounts can reach; the Save dialog was not in the crawl (checked separately).

**Not fixed / left**: old audit rows already stored with a UUID in text; backend messages containing ids (`AuditTrailReviewService` line 195 review-decision comment, `UncontrolledCopyRuleDraftService` line 50 prefix, ControlledCopyService exception texts); global audit-trail module untouched by rule. Pre-existing failing test `usagePurpose.test.ts` (casing) not touched.

**Revision 1.0.1 of SOP.7147** (API with signature tokens, `dcv_upg7.py`): Draft -> Pending Review (dcv.u1 submit) -> Pending Approval (dcv.u3 review) -> Pending Training (dcv.approver approve). Publish NOT done: the revision requires training (10 days); a Training Management activity (PLANNED, due 2026-11-18) must complete first (`training/complete` returns TRAINING_ACTIVITY_NOT_COMPLETED, correct gate).

## Training run + publish of SOP.7147, backend ID cleanup (2026-11-09, DEV)
- Training TRN/QC/26-079 (`dcv_train1.py`..`dcv_train3.py`, API with signatures; organizer/QA = existing DEV training test accounts, trainees dcv.u2 and dcv.u3): session, participants, content review/approval, notify, start, attendance, scores, send to QA, QA confirm -> COMPLETED. `training/complete` -> Ready for Publishing. Operator publish -> **Effective**. DB: 1.0.0 OBSOLETED, new revision EFFECTIVE with number **2.0.0** (the upload said 1.0.1; the system renumbers at publish). Screenshot `shots/PUB__1-effective.png`.
- Backend: removed the id from ~55 user-facing messages ("... not found: <id>" and similar, access review/audit review item, copy PDF errors by copy number, audit comment of audit review decision, Eligibility Rule prefix). Compile OK, 51 tests pass (AccessProfileServiceSecurityTest, DocumentAuthorizationServiceTest). The global exception handler already shows generic text for several of these, so a live probe could not show the new wording; verified by code and tests only.
- Still containing ids (not changed): `Duplicate column id` (column key, not a UUID), logs, audit rows already stored.

## Owner-ordered follow-ups (2026-11-09, DEV)
- **Button by permission (item 3)**: new DEV accounts `dcv.sec.upd` (view+update) and `dcv.sec.nouser` (view+update+assign, no settings.user.view), SQL `DEV_TEST_SECURITY_NARROW_ACCOUNTS_2026_11_09.sql`. `dcv_button_wizard.py` / `dcv_wizard_nouser.py`: update-only account sees the list but NOT the New Access Profile button, and gets Access Denied on `/wizard`; control account sees the button; PASS A1-A4, B1.
- **Wizard (item 4)**: without user-list permission the Users step explains and the profile is created unassigned (B2 PASS); a Segregation of Duties refusal now shows the real reason ("Cannot assign this access profile: it would give DCV Contributor 1 (dcv.u1) a blocked Segregation of Duties conflict ...", C1 PASS, nothing created). Screens `BW__*`.
- **Second upgrade of SOP.7147 through the screens (item 5)**: operator saves the next-revision setup; Author uploads (Draft); Co-Author sees only Edit File Online and the ONLYOFFICE editor opens in Editing mode; Reviewer sees the Draft read-only, then Complete Review with e-signature; Approver Complete Approval with e-signature -> Pending Training (training NOT repeated). Screens `UI1`..`UI4`, `UI3`. Note: the editor is ONLYOFFICE, not Microsoft Office Online; the minimal test file shows vertical text (test file artifact).
- **Stored UUIDs in audit text (item 7)**: audit_logs is immutable by trigger and is never rewritten; ~9,267 of 79,338 rows carry a UUID in text. `AuditDisplayText.hideIds` now cleans description, change summary, reason, comment, old/new values and change values when returned ("Name (uuid)" -> "Name"; stand-alone id -> dash). Unit test `AuditDisplayTextTest`; live check on DEV with old rows (106 rows, none with an id in human text). Limitation: an id that stood alone is shown as a dash, not resolved to a name; other consumers that read the table directly (exports built elsewhere) were not checked.
- **Test fixed (item 13)**: `usagePurpose.test.ts` expected "Read and comply"; the screen label is "Read and Comply".
- Owner decisions recorded: publish renumbers to the new Effective number (2.0.0) is by design; no block on expired Valid Until; test data will be deleted by the owner.

## F3 closed (2026-11-09): generate is part of distribute
- The split into two permissions was built and then REVERSED on the owner's correction: Generate is an automatic step done by the system, so it is not a separate permission; `documents.uncontrolled_copy.distribute` covers it.
- Final state: no new permission; migration V751 removed before any commit and its DEV traces cleaned (permission rows, flyway history row 751, original distribute description restored). Only change kept: the refusal text of the generate endpoint now reads "You do not have permission to distribute uncontrolled copies." like the other two (it used to say "generate"; the button is already hidden without the permission, so the text only shows to a direct API call). Tests: `UncontrolledCopyServiceTest` 19 pass (two tests describe the final rule), RecordVisibilityModeTest pass; backend redeployed healthy.

## Access Profiles list kept loading (2026-11-09)

- Cause: opening a list with any query parameter in the address (for example after sorting, paging or Back) made two effects fight over the address. The state started at defaults, wrote the defaults back to the address, then read them again, so the list called the server again and again. Reproduced with `?limit=5`: about 8-10 list calls in 7 seconds. The same defect was in Permission Sets, Object Access Rules and Access Review. Controlled Copies was not affected because its state starts from the address.
- Fix: the four screens now start their state from the address (same as Controlled Copies). No behaviour change otherwise.
- Verified on DEV after deploying the frontend: with `?limit=5`, `?sortBy=...&page=2&limit=5` and no parameters, each of the four screens makes exactly 1 list call and shows the right row count. tsc clean, security-authorization tests 30 pass. Not verified: other list screens outside the security module.
