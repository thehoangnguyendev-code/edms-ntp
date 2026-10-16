# Reports: decisions of 2026-10-14 implemented, phase 1

Decision references: `eqms-backend/docs/governance/DECISION_LOG.md` (REPORT-*-2026-10-14 entries).
Plan: `docs/to-be-sds/reports/PLAN-RP-001-implementation.md`. Specification: `docs/to-be-sds/reports/SDS-RP-001-reports-analytics.md`.

## Scope of this change (phase 1)

1. **REPORT-TEST-TEMPLATES**: the three `TEST_` report templates seeded by V533 are soft-deleted and inactive (`deleted_at`, `active = false`).
   V533 is not edited.
2. **REPORT-FILE-RETENTION-PERMANENT**: no report definition is linked to a retention period; unpurged report files have no expiry.
   The service never assigns an expiry to a new report file; the configuration API refuses a retention period (`REPORT_RETENTION_PERMANENT`).
3. **REPORT-ANALYTICS-PRODUCTION**: the Reports Overview and Quality Analytics menu items are shown only when the feature flag
   `feat-report-analytics` is enabled. The flag is added to the stored feature list, disabled.
4. Clean-up found while doing 3: the backend menu item `report-compliance` (no screen exists) is removed.

## Files changed

- Backend migration: `eqms-backend/src/main/resources/db/migration/V578__report_gmp_decisions_2026_10_14.sql` (new, forward-only).
- Backend service: `eqms-backend/src/main/java/com/eqms/service/ReportPlatformService.java`
  (`resolveRetentionExpiry` returns null; `updateConfiguration` refuses a retention policy).
- Backend navigation: `eqms-backend/src/main/java/com/eqms/service/NavigationService.java` (analytics items behind the flag; `report-compliance` removed).
- Backend test (new): `eqms-backend/src/test/java/com/eqms/service/ReportPlatformRetentionPermanentTest.java`.
- Frontend: `eqms/src/features/report/templates/ReportTemplateEditor.tsx` (retention wording; retention state removed).
- Frontend: `eqms/src/features/report-analytics/admin/ReportAdminScreens.tsx` (retention screen wording).
- Documents: `docs/to-be-sds/reports/SDS-RP-001-reports-analytics.md` (section 5.2, 17, 18); `docs/to-be-sds/reports/PLAN-RP-001-implementation.md` (new).

## Verification

- Backend, new test: `ReportPlatformRetentionPermanentTest` 2/2 pass (refusal of a retention period; no expiry on a new file).
- Backend, existing report tests run in the same command: `ReportTemplateApiTest` 4/4, `ReportTemplatePermissionBoundaryTest` 1/1,
  `ReportMetadataProviderTest` 11/11, `ReportAnalyticsTest` 6/6, `ReportLayoutTest` 4/4, `ReportLayoutApiTest` 4/4,
  `ReportWordServiceTest` 8/8 pass.
- Backend, `ReportTemplateDatabaseTest` (24 tests): **not run**. It runs only with the explicit opt-in variable
  `EQMS_REPORT_TEST_DB` and database credentials. It uses an isolated schema that it drops afterwards.
- Frontend: report and settings report tests 32/32 pass; type-check clean apart from the existing `ReportLists.test.tsx` error.
- Deployment: backend and frontend images rebuilt and recreated; Flyway applied V578 ("now at version v578"); backend healthy;
  frontend HTTP 200.
- Database after V578 (`eqms-database`):
  - `TEST_DEPARTMENT_REGISTER`, `TEST_DOCUMENT_LIFECYCLE`, `TEST_DOCUMENT_REGISTER`: active = false, deleted = true.
  - Definitions with a retention policy: 0.
  - Artifacts with an expiry and not purged: 0.
  - Feature `feat-report-analytics`: enabled = false. `feat-system-reports`: enabled = true.

## Not done and residual risk

- The analytics URLs (`/report/overview`, `/report/analytics`) remain reachable by typing the address while the flag is off.
  They still show sample data under a "Design preview" banner. Blocking the route is a follow-up (PLAN 1.3).
- DEV: the analytics menu is hidden until an administrator enables the flag in Settings. This is intended by the decision.
- The test templates are not loaded on DEV any more. Reloading them on DEV only is PLAN item 2.5.
- Finding 17.11: `REVISION_LIFECYCLE` and `AUDIT_TRAIL_EXTRACT` are flagged active but have no data source; they cannot run.
  Turning the flag off is proposed and needs QA confirmation; not changed in this change.
- Legal hold, definition-change signatures, schedule owner, notifications and delivery records are phase 2 (PLAN).
- Impact analysis: GitNexus `impact` and `detect_changes` were not run. The index is stale (commit 75e436a) and a refresh failed earlier
  with an FTS inconsistency. Callers were checked by search: `resolveRetentionExpiry` is private and used only by the publish path;
  `updateConfiguration` is called only by `ReportConfigurationController`; `NavigationService` report block is read only by the
  navigation endpoint.

## Phase 2.1 and 2.2 (2026-10-14): legal hold and signed definition changes

Decision references: REPORT-LEGAL-HOLD-2026-10-14 and REPORT-DEFINITION-SIGNATURE-2026-10-14.

### What changed

- **Legal hold (2.1).** `ReportPlatformService.setArtifactLegalHold` now takes a signature token. Placing a hold needs a reason.
  Releasing needs a reason, a token checked by `SecurityChangeSignatureService`, and a person other than the one recorded on the
  last `LEGAL_HOLD_APPLIED` run event for that file (`actorId`). A release with an unknown applier is refused, and so is a change
  that leaves the hold as it is. The release is signed with meaning `REPORT_LEGAL_HOLD_RELEASE`; the event and the audit entry
  carry the signature reference. Endpoint `POST /reports/runs/{runId}/artifacts/{artifactId}/legal-hold` accepts `signatureToken`.
  Frontend: `ReportHistoryView` (file list in the run drawer) has Place / Release legal hold, with a reason and, for a release, the
  e-signature dialog. API client `reportsApi.setLegalHold`.
- **Signed definition changes (2.2).** `ReportTemplateService.save` compares formats, fields (allowed, default, required), role scopes and
  activation with the stored definition. A difference, or any new definition, needs `signatureToken` (`TemplateWrite.signatureToken`).
  The token is checked before any write (a refusal writes nothing, verified by test) and the signature is recorded with meaning
  `REPORT_DEFINITION_CHANGE` after the write. Name, description and layout are not compared. Frontend: `ReportTemplateEditor` keeps
  the stored version as a baseline, opens the e-signature dialog before saving a change of meaning, and sends the token.
- **Migration V579** seeds the two meanings (`electronic_signature_meanings`), idempotent.
- The retention text of the run file list now reads "Kept permanently" (not "Retention policy applies").

### Verification

- Backend, new: `ReportLegalHoldTest` 7/7 pass (apply needs a reason; apply needs no signature; holding an already held file is refused;
  the applier cannot release; unknown applier refused; release without a valid signature changes nothing; another person releases with
  a signature and the release is recorded). `ReportTemplateSignatureTest` 5/5 pass (token normalisation matches storage; order does not
  matter; scope, format and activation do; creating without a signature writes nothing; no signature service fails closed).
- Backend, existing report tests pass in the same run: `ReportPlatformRetentionPermanentTest` 2/2, `ReportTemplateApiTest` 4/4,
  `ReportScheduleOwnershipScopeTest` 4/4, `ReportTemplatePermissionBoundaryTest` 1/1, `ReportMetadataProviderTest` 11/11, `ReportAnalyticsTest` 6/6,
  `ReportLayoutTest` 4/4, `ReportLayoutApiTest` 4/4, `ReportWordServiceTest` 8/8, `ReportPdfRendererTest` 2/2.
- Test mock note: JdbcTemplate matchers must be typed (`ArgumentMatchers.<Object>any()`); an untyped `any()` picks the
  `(sql, Object[], int[])` overload and silently never matches the service call. Recorded so the next test author does not repeat it.
- Frontend: report feature tests 32/32 pass (the history test now provides the toast provider and the permission stub it needs).
  Type-check clean apart from the existing `ReportLists.test.tsx` error.
- Deployment: backend and frontend rebuilt and recreated; V579 applied ("now at version v579"); both meanings present in
  `electronic_signature_meanings`; backend healthy; frontend HTTP 200.

### Not done

- `ReportTemplateDatabaseTest` still needs its explicit opt-in (`EQMS_REPORT_TEST_DB`) and was not run.
- No frontend test yet for the signature dialog in the editor or for the hold dialogs in the history view.
- Browser check of the two dialogs on DEV is still to be done by the owner.
- Phase 2.3 (schedule owner and suspension notice), 2.4 (notifications and delivery attempts, needs IT approval of the mail
  server), 2.5 (test templates on DEV only).
- A failed read during download still reports `REPORT_ARTIFACT_EXPIRED` for every error (SDS 17.9).

## Phase 2.3 and 2.4: schedule owner, suspension notice, report-ready notice and delivery attempts

Decisions: REPORT-SCHEDULE-OWNER-2026-10-14, REPORT-NOTIFICATION-CHANNEL-2026-10-14, REPORT-DELIVERY-CHANNEL-2026-10-14 (owner-confirmed on 2026-10-14; the build followed).
Plan rows 2.3 and 2.4 in `docs/to-be-sds/reports/PLAN-RP-001-implementation.md`.

### Impact analysis and change detection (CLAUDE.md)

- `impact` on `ReportPlatformService` (class): **CRITICAL**, 305 upstream symbols (1 direct, 295 at depth 2, 9 at depth 3), 0 processes.
  The class is used by the report controller, its tests and the worker, so the risk is accepted with the verification below. Method-level
  impact lookups (`processOneDueSchedule`, `createSchedule`, `resolvePublicAppBaseUrl`) returned "not found": the GitNexus index is stale
  (see the 2026-10-09 change record). Callers were checked by search instead.
- `detect_changes` (working tree, 2026-10-14): 13 files, 18 symbols, **0 affected processes, risk low**. Commit has not been made.

### Files

- `V580__report_schedule_owner_and_delivery_2026_10_14.sql`: `report_schedules.owner_user_id` (backfilled with the creator, then NOT NULL);
  `report_runs.schedule_id`; `report_delivery_attempts` gains `channel`, `event_code`, `run_id`, `schedule_id`, `detail` (the table was
  created empty in V359 and was never written).
- `service/report/ReportDeliveryService.java` (new): in-app notice through `NotificationService.recordNotification`; e-mail through
  `EmailNotificationService.sendRenderedEmailWithTracking`. The e-mail is a notice and a link only, with the HTML escaped. Each recipient is
  checked again at send time. Every attempt is written, including refusals and failures. A failure never fails the run or the suspension.
- `ReportPlatformService`: `createSchedule` sets the owner to the creator; `changeScheduleOwner` (owner must be active, reason required,
  not the same owner, audit `REPORT_SCHEDULE_OWNER_CHANGED` with old and new owner); a completed scheduled run notifies the recipients;
  `suspendSchedule` notifies the owner and creator; `schedules()` returns `ownerUserId` and `ownerName`.
- `ReportPlatformController`: `PUT /reports/schedules/{id}/owner` with `{ownerUserId, reason}`.
- `EmailNotificationService.resolvePublicAppBaseUrl()` made public so that the notice link uses the same base URL as the other links.
- Frontend: `services/api/reports.ts` (`changeScheduleOwner`, owner fields); `ScheduledReportsView` (Owner column, "Change Owner" action with
  a reason, owner chosen from the people list); `ReportHistoryView` opens the run given by `?run=<id>` (the link in each notice).

### Assistant choices to confirm (not stated by the owner)

1. A handover needs a reason and an audit record but **no electronic signature**. The owner decision did not ask for one.
2. The owner **gains no authority**: the creator still runs and changes the schedule (as decided).
3. A **suspension notice** goes to the active owner and to the active creator, whether or not they may open the schedules screen. It names only the
   schedule and the reason; the link stays guarded by the screen. An inactive person is recorded as `SKIPPED_NOT_AUTHORIZED`.
4. A **report-ready notice** goes only to a recipient who may open the run now (`report.module.view`, `reports.run.view_own`, and either the
   requester or `reports.run.view_all`). Anyone else is recorded as `SKIPPED_NOT_AUTHORIZED`, on both channels.
5. The owner decision also names a **report administrator** as a recipient of the suspension notice. This is **not built**: the rule for
   who the administrators are (which permission, which people) needs an owner decision.

### Verification

- Backend unit tests, all pass: `ReportDeliveryServiceTest` 8/8 (authorized recipient gets in-app and link-only e-mail; a recipient who lost
  access is skipped on both channels; the requester can always open their run; a failed in-app notice does not stop the e-mail; a rejected
  e-mail is recorded `FAILED / EMAIL_NOT_SENT`; a run without a schedule posts nothing; a suspension reaches an active owner without schedule
  screen permission; an inactive owner is skipped), `ReportScheduleOwnerTest` 4/4 (reason required; new owner must be active; same owner refused;
  handover written and audited), plus the earlier report tests (`ReportLegalHoldTest` 7/7, `ReportTemplateSignatureTest` 5/5,
  `ReportPlatformRetentionPermanentTest` 2/2).
- Frontend: report feature tests 32/32 pass. Type-check clean apart from the existing `ReportLists.test.tsx` error.
- Deployment (DEV): V580 applied ("now at version v580"); backend healthy; frontend rebuilt.
- DEV end-to-end (test data named "E2E ... (DEV test)", created directly in DEV for this check):
  - Suspension path: a schedule whose creator lacked run permission was suspended `SUSPENDED_AUTHORIZATION_CHANGED`. The owner (admin) and
    the creator (approver.test1) each received an in-app notice (`user_notifications`, type `report-schedule-suspended`) and an e-mail. MailHog
    received three e-mails, each `multipart/related` with an HTML body carrying one link to `/report/scheduled` and no attachment. Six
    `report_delivery_attempts` rows are `SENT`.
  - Earlier run, before the fix in item 3 above: the owner and the creator without schedule-screen permission were recorded
    `SKIPPED_NOT_AUTHORIZED`. That is the bug the fix corrects; the rows remain in the table as evidence of the first run.
  - **Not verified on DEV:** the report-ready notice. The DEV admin holds `report.module.view` and `report.module.export` but not
    `reports.run.create`, `reports.schedule.view` or `reports.schedule.manage`, so a schedule created by that account cannot run. Granting
    those permissions on DEV is an owner decision and was not done. The report-ready path is covered by unit tests only.
  - The DEV test schedules remain in the table (suspended, `active = false`) with their attempt rows. They were not deleted because the attempt
    rows are evidence; the owner can decide on removal.

### Not done

- Report-ready notice on DEV with a creator who holds the report run permissions (needs the owner's decision on DEV permissions).
- Report administrator recipients of the suspension notice (open, see choice 5).
- Browser check of the owner dialog and the `?run=` link by the owner.
- Production e-mail: needs IT and security approval of the mail server (unchanged).

## Report administrators receive suspension notices (owner answer 2026-10-14: the admin account is the report administrator)

- **Rule:** an active person who holds `reports.schedule.manage` is a report administrator. A suspension notice goes to the owner, the
  creator, and every report administrator (read at send time). The rule is applied in `ReportDeliveryService.reportAdministrators()`.
  Report-ready notices are unchanged. Assistant choice to confirm: "holds the permission" is the definition, rather than a named list.
- **DEV data change (owner approval "ok" after the choice was offered):** `permission_set_items` gained one row linking
  `reports.schedule.manage` (`75900000-0000-0000-0000-000000000007`) to the set `ROLE_ADMINISTRATOR`
  (`10d40b75-949f-416c-8cb5-51e210ccae4b`), which the DEV `admin` account holds. Only this permission was granted. The permission
  `reports.schedule.view` was not granted, and the permission `reports.schedule.manage` depends on it in `permission_dependencies`
  (status PROPOSED, not enforced by the code path used here). The DEV `admin` account can therefore manage schedules but still cannot
  open the schedules screen through that permission alone; the owner should decide whether to grant the view permission as well.
- **Verification:** `ReportDeliveryServiceTest` 9/9 (includes a new test: an active administrator with the permission receives the notice)
  and `ReportScheduleOwnerTest` 4/4 pass. Backend rebuilt; on DEV the two test schedules were re-armed and suspended again; `admin` and
  `approver.test1` each received an in-app notice and an e-mail (all `SENT`).
- **Not verified:** that a second, non-owner administrator receives the notice on DEV (only one account holds the permission).

## Scheduled Report Delivery screen uses the real delivery log

- **Backend:** `GET /reports/deliveries?page&limit` (`ReportPlatformService.deliveries`) lists `report_delivery_attempts` newest first,
  paged on the server, limit capped at 100. Needs `reports.schedule.manage` (or the legacy `report.module.export`), the same as the
  schedule administration. Assistant choice to confirm: the log shows recipient names, so it is restricted to the schedule administrators.
- **Frontend:** `ReportDeliveryView` reads that API. The sample `SAMPLE_DELIVERIES` is no longer used. The "most recipients" control was
  a local value that Save did not store; it is now a fixed text (200, enforced when a schedule is created). The screen is read-only.
- **Verification:** `ReportDeliveryLogTest` 1/1 (paging and the limit cap); `ReportDeliveryServiceTest` 9/9 and `ReportScheduleOwnerTest` 4/4
  still pass. Frontend report tests 32/32 pass; type-check clean apart from the existing `ReportLists.test.tsx` error. DEV: backend and
  frontend rebuilt, backend healthy, the endpoint answers 403 without a login (route present), and the query used by the endpoint returns
  the existing attempt rows. The screen itself has not been checked in a browser.
- **Not done:** the DEV grant of `reports.schedule.view` to the administrator set (the permission change was refused by the auto-approval
  check in this session; it has not been applied). Not done: the QA scope for "Official" reports (phase 3.1), which needs the QA Manager.

## Templates for GMP decisions: creation switch, QA approval, disable instead of delete

Decision: REPORT-GMP-USE-APPROVAL-2026-10-14 (`docs/governance/DECISION_LOG.md`), owner answers 2026-10-14. Assistant choices are listed there
for confirmation (permission code, signature meaning, approval not changing the version, author rule, no existing template marked).

### Impact analysis and change detection

- `impact` could not be run per method for this change (index stale; see the 2026-10-14 section above). Symbols edited:
  `ReportTemplateService` (`TemplateWrite`, `save`, `storedForm`, `definition`, `snapshot`, `delete`, new `approveForGmp`),
  `ReportTemplateController` (new endpoint), `ReportTemplateCatalog` and `ReportTemplateEditor` (frontend).
- `detect_changes` (working tree, 2026-10-14): 15 files, 25 symbols, **0 affected processes, risk low**. Not committed.

### Files

- `V581__report_gmp_use_approval_2026_10_14.sql`: columns `gmp_use`, `gmp_approved_version`, `gmp_approved_by_user_id`, `gmp_approved_at`,
  `gmp_approval_signature_id` on `report_definitions`; permission `reports.definition.approve_gmp`; signature meaning `REPORT_GMP_APPROVAL`.
- `ReportTemplateService`:
  - `TemplateWrite` gains `gmpUse` (older constructors kept, so existing callers are unchanged). The flag is part of the form compared for
    a signed change, so turning it on or off needs an e-signature like any other change of meaning.
  - `snapshot()` (used by manual runs, previews and schedules): refuses a GMP template unless `gmp_approved_version` equals the current
    `definition_version` (`REPORT_NOT_APPROVED_FOR_GMP`).
  - `approveForGmp()`: needs the approval permission; the version must be current; the template must be GMP, enabled and not deleted; the
    author of the current version (from `report_definition_versions`) must not be the approver (`REPORT_APPROVER_IS_AUTHOR`); a version with
    no author is refused (`REPORT_AUTHOR_UNKNOWN`); a valid e-signature is required before anything is written; the approval and an audit
    record (`REPORT_TEMPLATE_GMP_APPROVED`, with the signature id) are written. The definition version is not changed.
  - `delete()`: refuses a GMP template (`REPORT_GMP_TEMPLATE_CANNOT_BE_DELETED`). Disabling still works through a normal save.
- `ReportTemplateController`: `POST /reports/templates/{code}/approve-gmp` with `{version, reason, signatureToken}`.
- Frontend: editor has "Use for GMP decisions" (with the disable-not-delete note), a status line for GMP templates, "Approve for GMP use"
  (reason, then e-signature with meaning `REPORT_GMP_APPROVAL`), which is hidden while the form has unsaved changes of meaning; the catalog
  hides "Delete Report Template" for GMP templates.

### Verification

- Backend unit tests, pass: `ReportGmpApprovalTest` 5/5 (author refused; non-GMP refused; no signature writes nothing; signed approval
  records the current version and audits it; a GMP template is disabled, not deleted), plus `ReportTemplateSignatureTest` 5/5, the
  delivery and owner tests, `ReportLegalHoldTest` 7/7.
- Frontend: report feature tests 32/32 pass. Type-check clean apart from the existing `ReportLists.test.tsx` error.
- DEV: V581 applied ("now at version v581"); the columns, the permission and the meaning exist; no template is marked for GMP use.

### Not verified and not done

- The run guard (`REPORT_NOT_APPROVED_FOR_GMP`) and the approval have no unit test for `snapshot()` and no DEV run. Approval on DEV needs a
  QA test user with `reports.definition.approve_gmp`, which needs a permission grant the owner has not yet approved for this purpose.
- Schedules of an unapproved GMP template are suspended with the existing reason `SUSPENDED_AUTHORIZATION_CHANGED` (imprecise; open).
- The notice text on each file ("Not confirmed for GMP decisions") is not in the output yet (PLAN 3.2, waiting for QA's text).
- Browser check of the editor switch and the approval dialogs.

## Template creation with approval flow and configurable name rules

Decision: REPORT-TEMPLATE-APPROVAL-2026-10-14 and REPORT-NAME-FORMAT-2026-10-14 (`docs/governance/DECISION_LOG.md`). The seven assistant
choices are listed there for confirmation. This replaces the GMP-only approval of the previous section.

### Impact analysis and change detection

- Per-method `impact` not run (index stale, see the 2026-10-14 section above). Changed classes: `ReportTemplateService` (`TemplateWrite`,
  `save`, `definition`, `snapshot`, approval methods replaced), `ReportTemplateController`, `ReportPlatformService` (schedule suspension
  reason), `ReportScheduleAdministrationService` (status filter), `ReportDeliveryService` (suspension text), `NavigationService` (one item),
  new `ReportNameFormatService`, `ReportNameFormatController`. Frontend: template editor, template catalog, scheduled view, new name-format
  list and editor, API clients, routes, navigation.
- `detect_changes` (working tree, 2026-10-14): 19 files, 26 symbols, **0 affected processes, risk low**. Not committed.

### Database (V582)

- Approval state on each version: `approval_status` (DRAFT, PENDING_APPROVAL, APPROVED), `submitted_version`, `submitted_by_user_id`,
  `submitted_at`, `approval_comment`; the V581 `gmp_approved_*` columns renamed to `approved_*`.
- Existing templates set to DRAFT (not approved by the migration).
- `report_name_formats`, `report_name_format_parts` (ordered parts, UNIQUE per order), `report_definitions.name_format_id`, `name_values`.
- Seed rule `EQMS_REPORT_TITLE` for testing (assistant choice 6).
- Permission `reports.definition.approve` (renamed), `reports.name_format.manage` (new); meaning `REPORT_TEMPLATE_APPROVAL` (renamed).

### Backend

- `save()`: a name rule builds `display_name` from the rule parts; every save sets the version to DRAFT; creation is DRAFT.
- `submitForApproval()` (manager), `approve()` (approval permission, e-signature, not the author nor the submitter, the version must be the
  pending one), `reject()` (approval permission, reason, no signature). A version with no recorded author cannot be decided.
- `snapshot()` (run, schedule, preview) refuses unless the current version is APPROVED (`REPORT_NOT_APPROVED`).
- `delete()` still refuses GMP templates.
- `ReportNameFormatService`: list (searched and paged on the server), detail, create, update (version checked, code fixed), enable/disable
  (reason, version checked). Rules: separator from a fixed set; 1 to 10 parts; at least one typed part; fixed text without markup; typed
  values checked by rule and length; the built name at most 255 characters.
- Schedules of an unapproved template are suspended with `SUSPENDED_TEMPLATE_NOT_APPROVED`.

### Verification

- Backend tests, all report classes: pass (`ReportTemplateApprovalTest` 9/9, `ReportNameFormatTest` 7/7, plus the earlier classes).
  The superseded `ReportGmpApprovalTest` was removed.
- Frontend: report tests 32/32; type-check clean apart from the existing `ReportLists.test.tsx` error.
- DEV: V582 applied ("now at version v582"); existing templates DRAFT; the seeded rule, permission and meaning present; endpoints
  `/reports/name-formats` and `/reports/templates/{code}/submit` answer 403 without a login (route present).

### Not done / to check on DEV

- Browser check of the whole flow (owner test): create from a rule, submit, approve as a second person, run.
- The approval permission must be granted to the approver (`approver.test1`) by an administrator; it is not granted by the migration.
- Unit tests for the run guard inside `snapshot()` and for the frontend composition are not written.
- Notice text on each file for non-approved versions (PLAN 3.2) still open.

### Owner answers and follow-up (2026-10-14)

- Names accepted. Lifecycle: Draft -> Pending approval -> Active -> Inactive (`lifecycleStatus` computed by the server: Inactive when disabled,
  otherwise from the approval state). Enabling again goes back through Draft and approval, because enabling is a change.
- Rejection is signed electronically (V583 seeds `REPORT_TEMPLATE_REJECTION`). Backend and editor updated; tests: `ReportTemplateApprovalTest`
  11/11 (rejection without a signature changes nothing; lifecycle mapping).
- The example rule `EQMS_REPORT_TITLE` is removed by V583 (only when no template uses it). DEV: no name format remains.
- Open: what a change to a name rule does to templates already using it (owner answer "chưa rõ").
- Schedules of an unapproved template: for the administrator to test.
- Approver test account: `approver.test1` needs `reports.definition.approve` granted by an administrator (not granted by any migration).

### Name rules: option A (owner, 2026-10-14)

- A template keeps its display name. `ReportTemplateService.nameFor()`: on a save of an existing template whose rule and typed values are
  unchanged, the stored name is kept; otherwise the name is built from the current rule. So a rule change does not rename existing
  templates; it applies to new templates and to templates whose typed values are edited.
- No unit test for `nameFor()` (it needs the full save path with database mocks). To be checked on DEV: edit a template after its rule was
  changed; its name must stay the same.

### DEV test access profiles and direct checks (owner instruction, 2026-10-14)

- **DEV data changed, by script:** `DEV_TEST_REPORT_ACCESS_PROFILES_2026_10_14.sql` (in this folder). Two permission sets
  (`PS_REPORT_AUTHOR_DEV_TEST`, `PS_REPORT_APPROVER_DEV_TEST`), two access profiles (`REPORT_AUTHOR_DEV_TEST`, `REPORT_APPROVER_DEV_TEST`),
  and their assignments: `admin` gets the author profile (kept: Administrator); `approver.test1` gets the approver profile (kept:
  Approver Test). This is a direct database change, not through the administration screens, so it has no application audit record. Owner
  instruction recorded here; revert by deactivating the two profiles if not wanted.
- **Checked on DEV as `approver.test1`:** login works; `GET /reports/name-formats` returns 200 (definition view); `GET
  /reports/templates/configuration` returns 200; `POST .../approve` and `.../reject` on the Draft `DOCUMENT_STATUS` return 409
  `REPORT_TEMPLATE_NOT_PENDING` (the permission is accepted; the state refuses); `GET /reports/catalog` returns 403 because the approver has no
  data scope on the template (role scopes), not because of a permission.
- **Defect found and fixed:** `GET /reports/name-formats` returned 500 for a user without permission; the report access handler did not
  cover the name-format controller. Fixed (controller added to the handler); now 403.
- **Not checked:** the full flow (create rule, create template, submit as author, approve with signature, run). The author needs a login
  (`admin` password not given). Approval with a real signature token not run.
- **Observed, not changed:** the approver's 409 error code is shown as `RESOURCE_NOT_FOUND`: `ResponseStatusException` is mapped generically.

### Direct end-to-end test on DEV (2026-10-14, accounts `admin` and `approver.test1`)

Each step was done through the application's API with the account's own password and signature (`/auth/verify-signature`).

1. As `admin`: name rule `EQMS_TOPIC` created (201).
2. As `admin`: template `EQMS_TOPIC_DOC_STATUS` created from DOCUMENT_STATUS fields, under the rule (201). Name built by the rule:
   "EQMS - Document status register". State DRAFT.
3. As `admin`: submitted (version 1) -> PENDING_APPROVAL.
4. As `approver.test1`: approved with a signature (version 1) -> APPROVED / ACTIVE, approver recorded.
5. As `admin`: run refused (403 REPORT_SCOPE_DENIED): the template had no role scope for the Administrator role. Expected.
6. As `admin`: role scope SYSTEM granted to Administrator (signed change) -> version 2, back to DRAFT. A run while DRAFT refused
   (`REPORT_NOT_APPROVED`): the approval guard works.
7. As `admin` submit v2; as `approver.test1` approve v2 with a signature -> ACTIVE.
8. As `admin`: run with filter `search=SOP` (4,058 rows) -> COMPLETED, PDF 593,288 bytes, `%PDF` header, SHA-256 matches the run record.
9. As `admin`: name rule renamed (version 2), template re-saved with the same typed value -> name kept "EQMS - Document status register"
   (option A verified). Version 3 -> DRAFT; submitted and approved again by `approver.test1` -> ACTIVE (final state).

**Finding (not fixed):** a run without a filter on DOCUMENT_STATUS fails with `REPORT_INVALID_CRITERIA`. The cause is
`REPORT_ROW_LIMIT_EXCEEDED` (export limit 10,000 rows; DEV has 10,435 rows). The refusal is correct (no silent truncation), but the code shown
to the user is generic. Decision needed: the row limit, and the error code shown.

**Finding (not fixed):** the standard DOCUMENT_STATUS template is Draft after V582 and must be approved before reports from it run again.

Temporary tokens and downloaded files were removed from the scratch folder; the test run artifacts remain on DEV.

### Fix: row-limit failure gets its own reason

- `ReportArtifactPublisher.fail()`: `REPORT_ROW_LIMIT_EXCEEDED` is recorded as reason `REPORT_ROW_LIMIT_EXCEEDED` with the text "The result
  has more than 10,000 rows. Add a filter to narrow it and start a new request." (before: `REPORT_INVALID_CRITERIA`). Limit unchanged.
- Test `ReportArtifactPublisherFailureTest` 2/2 pass (row limit has its own reason; other invalid criteria keep theirs).
- DEV, after rebuild: a run with no filter -> FAILED, `REPORT_ROW_LIMIT_EXCEEDED`; the same template with `search=SOP` -> COMPLETED.
- Not changed (decision open): the 10,000-row limit itself, and the standard DOCUMENT_STATUS template, which remains Draft until approved.

### Run details on their own page (owner request, 2026-10-14)

- The side drawer of Report Run History is replaced by a page: `/report/runs/:runId` (`ReportRunDetailPage`), built from the shared UI
  (PageHeader, FormSection, DataTable, Badge, Button, FormModal, ESignatureModal, DocumentPdfViewer). Row click and "View Detail" open it.
- Shows every field the server returns: run facts (status, progress, attempts, request type, schedule, requester, format, queued, started,
  completed, data as-of, run ID, reason code, message); the template as it was at run time (display name, approval status, approved version
  and date, GMP use, name rule); criteria (filters and parameters, fields, sort); each file (format, name, size, SHA-256, created, retention,
  download, preview, legal hold); the full timeline with parsed details; the notices sent.
- Backend `runDetail`: adds requester name, schedule, as-of time, and the approval facts of the template at run time (role scopes and the
  authorization snapshot are not returned); event details are returned as JSON, not as raw database values; notices are returned to users
  with `reports.schedule.manage` only (null for others).
- Notices now link to `/report/runs/<id>`. Old links `/report/history?run=<id>` redirect to the same page.
- Tests: `ReportRunDetailPage.test.tsx` 2/2; report frontend 34/34; backend report tests pass. DEV: rebuilt; the API returns the new fields
  and no snapshot; the page itself was not checked in a browser.

### Report list standard: server-side search, filters, sort and paging; custom columns (owner request, 2026-10-14)

- Rule: search, filters, sort and paging are applied by the server; the screen only sends parameters and shows the result. Custom columns
  (`useCustomColumnLayout`, shared `DataTable`) on every list.
- Shared: `features/report/shared/ReportListToolbar.tsx` (follows Document Name Formats: search, desktop filters via ConfiguredDesktopFilters,
  mobile Filters drawer, Clear Filters, column chooser). `ReportListFilters` removed (no longer used). Table state via the shared
  `useServerTable` hook.
- Lists converted: Report Run History (status, template, queued date range; server sort on queued, completed, status, template); Scheduled
  Reports (status filter, server sort, custom columns); Report Library / Report Definitions (search, four filters, server sort, custom
  columns); Report Name Formats (search, status Enabled/Disabled, server sort on name, code, version, status, last change); Scheduled Report
  Delivery log (search by recipient or schedule, channel, result, server sort, paging); Legal Hold Register (now the real list of held files;
  search, server sort, paging).
- Backend: `GET /reports/runs` (+ status, definitionCode, queuedFrom, queuedTo); `GET /reports/name-formats` (status, sortBy, sortDirection);
  `GET /reports/deliveries` (search, channel, status, sortBy, sortDirection); new `GET /reports/legal-holds` (search, sortBy, sortDirection,
  paging; needs `reports.retention.manage` or `report.module.export`).
- Run detail page tables (files, timeline, notices): custom columns added. No sort, search or paging: each list is the full, bounded list for
  one run, returned by the server. To page them on the server, the detail API needs paged endpoints; not done.
- Template run wizard preview: column sort is sent to the server (criteria sort), custom columns, server paging. Search and filters are on the
  criteria step, as before.
- Not changed: Template editor tables (fields, history, roles: configuration tables); Access & Scope matrix, Validation, and the Overview and
  Analytics screens (feature-flagged design previews on sample data; they need a server source before they can be standardised).
- Tests: `features/report/testing/browserStubs.ts` (matchMedia and ResizeObserver for jsdom) imported by the report tests only; the shared
  vitest setup is unchanged. Report frontend tests 34/34. The full suite has 2 failing tests in `effectiveByType.test.tsx` that also fail
  with the original setup (pre-existing, not from this change).
- Backend report tests: 116 run, 0 failures, 24 skipped (DB-backed, need `EQMS_REPORT_TEST_DB`). Backend image rebuilt; the four endpoints
  answer 200 on DEV with the new parameters; the legal hold endpoint was first deployed with a SQL error, found and fixed before this record.

### Detail screens on their own pages; list layout of User Management; real Access & Change History screens (owner request, 2026-10-14)

- **No drawer remains** in Reports & Analytics or Report Administration. The two that were left became pages:
  - Report schedule (new and edit): `/report/scheduled/new` and `/report/scheduled/:id` (`ScheduleEditorPage`); the form is in cards, two columns on a
    desktop and one on a phone; Cancel and Save Changes are in the page header; an edit needs a reason.
  - Report template: `/report/templates/:code` (library) and `/settings/report-configuration/:code/details` (Report Definitions), both
    `ReportTemplateDetailPage` (every field of the template, the fields table, and for Report Definitions the approval state and the role scopes);
    Create Report is the page `/report/templates/:code/run` (`ReportTemplateRunPage`, wrapping the existing wizard).
  - The run page (`/report/runs/:runId`) was already a page. Its breadcrumb wrongly said Report Administration; it now says Reports & Analytics.
- **Breadcrumbs and titles:** one builder, `reportBreadcrumbs`: Dashboard > Reports & Analytics > [parent list] > page, and for Report Administration the
  same System Administration trail as the other administration pages. Every detail page has a page title, the breadcrumb and a back button.
- **List layout** follows `UserManagementView`: one card with the filter section and the table section; on a desktop a three-column grid with Search,
  the filters, and in the last cell Clear Filters and Custom Column side by side; in the compact filter mode Custom Column is the trailing control of the
  shared filter panel; on a phone a Search box and a Filters button that opens the drawer. Clear Filters is always enabled, as there.
  The search box is the shared `FilterSearchInput`. Test `ReportListToolbar.test.tsx` fixes the position of these controls.
- **Report Administration:** Report Access & Data Scope (role scopes by template) and Report Change History & Validation (saved versions with
  approval state) now read the server (`GET /reports/access-scopes`, `GET /reports/change-history`), with search, filter, sort and paging on the
  server. The "Design preview" banner is shown only on Report Output Controls (still local switches) and on the feature-flagged analytics screens.
- **Tests:** report frontend all pass; new `ReportDetailPages.test.tsx` (title, breadcrumb, no drawer, navigation); backend report tests 116 pass,
  24 skipped (DB). The local `mvnw -o` build did not catch two invalid Java escapes that the Docker build did; the Docker build (clean, from source)
  is the check that counts.
- **Not done:** Overview, Analytics and the analytics run preview are still sample-data design previews behind the feature flag; no browser check of
  the responsive layout yet.

### Back button position (owner remark, 2026-10-14)

- On a detail or edit page the way back is the **Back button in the actions, first, to the left of the other buttons**, as on the Report Template editor. The
  arrow beside the title (`PageHeader onBack`) is no longer used by any report page. Changed: Report Template details, Report Schedule editor (Cancel is now
  Back), Run details, Report Name Format editor, the Create Report page (and its wizard button, "Back to Templates" is now "Back"), and the analytics run preview.
- Test `ReportDetailPages.test.tsx` checks that Back sits before the other action and that no page shows the title arrow. Report frontend tests 44/44.
- Not checked in a browser.

### Filter section touching the table (owner remark, 2026-10-14)

- Cause: the classic desktop grid and the phone row of `ReportListToolbar` used the shared `FilterSearchInput`. Its icon carries `data-advanced-search-icon`, and
  `styles/utilities.css` (`.compact-filter-section:has([data-advanced-search-icon])`) removes the bottom padding of the filter section when it finds that marker
  (meant for the compact filter toolbar). The filter row then touched the table. All report lists share this toolbar, so all were affected.
- Fix, as User Management does it: a plain search box in the classic grid and the phone row; `FilterSearchInput` only as the `search` of the compact filter panel.
- Tests in `ReportListToolbar.test.tsx`: the classic layout holds no marker and keeps `md:p-5`; the compact mode carries it. Report frontend tests 46/46.
- Not checked in a browser. Applies to Report Run History, Scheduled Reports, Report Definitions / Library, Report Name Formats, and the delivery log, legal hold register,
  access scope and change history sections of Report Administration.

### Page title and breadcrumb name the screen (owner remark, 2026-10-14)

- A detail page's title and the last item of its breadcrumb name the **screen**, not the record. The record's own name is a fact in the details below.
  Report Template Details (library and Report Definitions): "Report Template Details", with "Template name" as the first fact. Report Run Details:
  "Report Run Details", with "Report name" as the first fact. Report Name Format editor: "New Report Name Format" / "Edit Report Name Format"; the name is the Name field.
- Tests in `ReportDetailPages.test.tsx` and `ReportRunDetailPage.test.tsx`: the breadcrumb holds the screen name and not the template name; the name is in the details.
  Report frontend tests 46/46. Not checked in a browser.

### Run details page crash: `(run.selectedFields ?? []).map is not a function` (owner remark, 2026-10-14)

- Cause: `GET /reports/runs/{id}` returned the jsonb columns `parameters`, `selected_fields` and `sort_spec` as the database driver's own object
  (`{type, value, null}`), not as JSON, so the page's `.map` failed. Not caught earlier because the page test used a hand-written, well-formed response.
- Fix: `ReportPlatformService.runDetail` parses those three columns (arrays stay arrays; an unreadable value becomes `[]` or `{}`); the page also treats a
  value that is not an array as empty. Test added: the page does not crash on a wrongly shaped list.
- DEV: the detail API of all 8 runs now returns real arrays and objects. Report frontend tests pass.

### Display text of machine values (owner remark, 2026-10-14)

- Statuses, reasons and event names were shown as the machine value in capitals (COMPLETED, RETRY_SCHEDULED, REPORT_ROW_LIMIT_EXCEEDED). The machine value is unchanged
  (server, API, logic, filters); only the text shown is ordinary: "Completed", "Retry scheduled", "Report row limit exceeded". One helper, `features/report/shared/reportLabels.ts`
  (`runStatusLabel`, `scheduleStatusLabel`, `codeLabel`, `humanize`); an unknown value is turned into a sentence-case phrase, never left in capitals.
- Applied to: the status badge, the Reason column and the status filter of Report Run History; the run details page (status, reason, timeline events, notices);
  the status badge of Scheduled Reports; the reason column of the delivery log; the category, classification, data source and approval state of the template pages.
- Tests: `reportLabels.test.ts`; the run details test checks "Queued"/"Completed" and the absence of the capitals. Report frontend tests 51/51. Not checked in a browser.

## Template Number issued by the system (owner request, 2026-10-14)

Id: REPORT-TEMPLATE-NUMBER-2026-10-14. Owner request: the "Template Code" is renamed "Template Number"; users do not type it; the system numbers
a template from a rule, as a Document Number is numbered.

- Rule (assistant choice, **confirmed by the owner 2026-10-14**): `<prefix>.<serial>` such as `RPT.0001`; prefix 2-10 upper-case letters/digits, serial 3-8 digits;
  default `RPT` and 4 digits. One rule for all templates (table `report_template_number_rule`, V584, forward-only).
- The serial only moves forward and is allocated under a row lock in the creating transaction; a number already held by a template (also a deleted one)
  is skipped, so a number is never issued twice. A rule change affects only numbers issued afterwards; existing templates keep their number
  (`DOCUMENT_STATUS`, `EQMS_TOPIC_DOC_STATUS`, ...). The number stays the stable identifier of a template (not editable after creation).
- API: `POST /reports/templates` creates and numbers (the old `POST /reports/templates/{code}` that accepted a typed code is removed);
  `GET/PUT /reports/template-number-rule` (change needs `reports.name_format.manage`, version check, reason, audit `REPORT_TEMPLATE_NUMBER_RULE_UPDATED`).
- Screens: editor shows the number read-only ("Assigned automatically when saved"); new page Report Administration > Report Template Numbering
  (`/settings/report-template-numbering`); labels renamed in Library, Definitions, template details, run details and layout token.
- Evidence: `ReportTemplateNumberTest` (7), all `Report*Test` 127 run / 0 failures / 24 skipped (DB-backed); frontend report tests 51/51; DEV direct test as admin:
  two creations gave `RPT.0001`, `RPT.0002`; a typed-code create is refused (405); detail and search by a dotted number work; invalid prefix refused (400).
  The two DEV test templates (`RPT.0001`, `RPT.0002`, Draft) remain on DEV.
- Not done: no browser check of the new page; the number rule is not yet part of the SDS 23.x text; the SDS 23.x text still has to be updated.

## Revisions of a report template (owner request, 2026-10-14)

Id: REPORT-TEMPLATE-REVISION-2026-10-14. Owner finding: reports and their templates had no version management, as Documents have (Revision).

Finding before the change: every save raised an internal counter (a draft saved five times was "v5"), no earlier content could be read or compared
(only a reason and a date were listed), and editing an approved template returned it to Draft so it could not run until approved again.

Design (assistant choices, **to confirm** by the owner/QA):
- A template has numbered **revisions** (Rev 1, Rev 2, ...). Statuses: Draft, Pending Approval, Effective, Superseded. One revision is being written
  and one is effective at a time (unique indexes, V585). The number is given when the revision is started, not at approval.
- The live rows of a template always hold the **effective** revision, the only one that runs. The first change after approval starts the next revision;
  its content is kept in `report_template_revisions.snapshot` and the effective revision **keeps running until the new one is approved**
  (runs, schedules and the Library are not touched). Approval (signed, approver is not the author or submitter, as before) writes the revision into the
  live rows, supersedes the earlier one and records who approved it and when. A template never approved has Rev 1, whose content is in the live rows.
- Released revisions keep their whole content for ever; any revision can be opened and compared with the previous, with the effective, or with another one.
  The comparison is made on the server (fields, access, formats, name, GMP flag, layout).
- Disabling a template takes effect at once; enabling it again is part of a revision and needs its approval (the owner's earlier lifecycle decision).
- Optimistic version of an open revision = live version it grew from + number of saves; a stale client is refused (409).
- Runs record the revision they ran from (derived from the version the run recorded); the layout token `template.version` now prints the revision.
- Existing templates: an approved template became Rev 1 effective (content from its approved version); the others Rev 1 Draft/Waiting.
- API: `GET /reports/templates/{code}/revisions`, `/{code}/revisions/{n}`, `/{code}/revisions/{n}/compare?with=previous|effective|n`.
- Screens: Revisions section on the template details (library and Report Definitions); page "Report Template Revision" (facts, changes, content, fields, role scopes);
  Revision and "Revision in progress" columns in the lists; "Template revision" in Run History and run details; approval panel and messages speak of revisions.

Evidence: `ReportTemplateRevisionTest` (5), all `Report*Test` 132 run / 0 failures / 24 skipped (DB-backed); frontend report tests 52/52, `tsc` clean.
DEV direct test (admin author, approver.test1): new template Rev 1 approved; an edit started Rev 2 Draft while the list still showed Rev 1 Effective/Active;
a stale version was refused (409); Rev 2 submitted and approved, Rev 1 became Superseded, Rev 2 Effective; comparison listed the added output format; Rev 1 content still readable.
Test templates `RPT.0003` and `RPT.0004` (Rev 2 effective) remain on DEV.

Not done: no browser check of the new screens; a report run from the effective revision while a newer revision is open was not run end to end on DEV
(the run path itself is unchanged: it reads the live rows); the edit screen does not yet show a side-by-side comparison with the effective revision;
the revision rule is not in the SDS text yet; reports (runs) made before revisions show no revision.

### Upgrade Report Template and Obsoleted (owner decision, 2026-10-14)

Owner: a new revision is started by an explicit **Upgrade Report Template**, with a flow like Revision; the old revision becomes **Obsoleted** when the new one
takes effect and stays viewable. This replaces the earlier choice that the first edit started the next revision.

- `POST /reports/templates/{code}/upgrade` (version, reason; permission `reports.definition.manage`/`settings.configuration.manage`): only a template with an effective
  revision and no open revision; the new revision is a Draft with the effective content; refused with 409 for a stale version (`REPORT_TEMPLATE_VERSION_CHANGED`) or when
  one is already open (`REPORT_REVISION_ALREADY_OPEN`). Audit `REPORT_TEMPLATE_UPGRADED`.
- Saving a template whose revision is effective and has none open is refused (409 `REPORT_UPGRADE_REQUIRED`). The editor shows the effective revision read-only with an Upgrade button.
- Approval of the new revision makes it effective and the earlier one `OBSOLETE` (V586 renames SUPERSEDED); API fields `obsoletedAt`, `obsoletedByRevision`. Obsoleted revisions open and compare as before.
- Disabling a template that has an effective revision is done through an upgrade (untick Enabled, save: it stops at once); a separate signed Disable action was not built.
- Evidence: `Report*Test` 132 run / 0 failures / 24 skipped; frontend report tests 53/53, `tsc` clean. DEV (`RPT.0004`): edit without upgrade refused; stale upgrade refused;
  upgrade gave Rev 3 Draft with Rev 2 effective; second upgrade refused; edit, submit, approve by another user: Rev 3 Effective, Rev 2 and Rev 1 Obsoleted, Rev 2 content still readable.
- Not done: no browser check; the SDS text.

### Revision management completed (owner request, 2026-10-14)

Owner: Disable needs only a confirmation modal and the audit trail; build the revision function completely.

- **Disable / Enable** (`POST /reports/templates/{code}/disable|enable`): immediate, confirmation with an optional reason, audit `REPORT_TEMPLATE_DISABLED/ENABLED`, no signature, no revision. This replaces the
  earlier rule that enabling again went through approval. The "Template active" checkbox was removed from the editor; a revision no longer carries the enabled flag (approval does not change it).
  Assistant reading, **to confirm**: Enable is treated like Disable (confirmation and audit only), because the content of the effective revision was already approved.
- **Discard Revision** (`POST .../discard-revision`, V587): a Draft revision that has an effective one before it is discarded with a mandatory reason; it stays on record as Discarded. A revision pending approval is first returned to Draft by the reviewer; Rev 1 is not discarded.
- **Compare with**: the revision page compares with the previous revision, the effective one, or any other revision (server side).
- **Run details**: the template revision is a link to the revision page for people who may view templates.
- **SDS-RP-001** section 5.5 written (template number, revisions, Upgrade, approval, Discard, Disable/Enable, API).
- Evidence: `Report*Test` 138 run / 0 failures / 24 skipped (`ReportTemplateRevisionActionsTest` 6 new); frontend report tests 54/54, `tsc` clean. DEV (`RPT.0004`): disable, second disable refused, enable;
  upgrade to Rev 4; stale discard refused; discard: Rev 4 Discarded with its reason, Rev 3 still Effective; comparison with the effective revision; a new upgrade after the discard gave Rev 5 (left open on DEV).
- Not done: no browser check of the new screens; a run from the effective revision while a newer revision is open was not run end to end on DEV (the run path reads the live rows, unchanged).

### Enabled / Disabled only for templates in use (owner remark, 2026-10-14)

Owner: Active / Inactive only makes sense for a template that has an effective revision; a template still being written is not offered for use.

- `setEnabled` refuses a template with no effective revision (409 `REPORT_NO_EFFECTIVE_REVISION`); the Disable/Enable button shows only on a template with an effective revision.
- Found while checking: a schedule of a disabled template was retried every 5 minutes in silence. Now the schedule is suspended with `SUSPENDED_TEMPLATE_DISABLED` and the owner, creator and report administrators are notified (in-app and e-mail, link only); the status filter and labels know the new value. Enabling the template again does not restart the schedule; its owner does.
- Evidence: `Report*Test` 139 run / 0 failures / 24 skipped; frontend report tests 54/54, `tsc` clean. DEV: disable of `DOCUMENT_STATUS` (Rev 1 draft) refused 409; a due schedule of disabled `RPT.0004` became `SUSPENDED_TEMPLATE_DISABLED` with in-app and e-mail notices sent; `RPT.0004` enabled again. The test schedule `E2E disabled-template schedule` remains suspended on DEV.

#### Enabled / Disabled only for templates in use: second pass over database, API, server rules and screens (2026-10-14)

The first pass limited Disable/Enable to templates with an effective revision. A review of every layer found the rest of the rule not yet applied; now done:

- **DB (V588):** a template with no effective revision gets `active = true` (three seeded `TEST_` templates were `false`). No effective revision means no enabled state.
- **API / service:** a save no longer writes the enabled flag: a new template is on, an existing one keeps its flag, whatever the client sends (`active` in the request body is ignored). The flag is no longer part of a revision's content (not in the draft payload, the overlay, the comparison or the revision page).
  `lifecycleStatus` is Inactive only for an approved template; one being written is Draft or Pending Approval. A disabled template keeps Inactive while its next revision is written.
- **Library:** only templates with an effective revision are offered (`exists effective revision` in the list and in the source filter).
- **Definitions filter:** Active and Disabled mean "with an effective revision"; new Draft and Pending Approval filters list the ones still being written. Status column shows the lifecycle (Draft, Pending Approval, Active, Disabled), not the raw flag.
- Evidence: `Report*Test` 140 run / 0 failures / 24 skipped (new test of the lifecycle rule); frontend 54/54, `tsc` clean. DEV: filters ACTIVE = `RPT.0003`, `RPT.0004`, `EQMS_TOPIC_DOC_STATUS`; DRAFT = `DOCUMENT_STATUS`, `RPT.0001`, `RPT.0002`; library returned only `EQMS_TOPIC_DOC_STATUS`
  (the one with an effective revision that the admin account has a role scope for); a create sent with `active:false` was stored as active (`RPT.0005`, Draft); no template without an effective revision is inactive.

#### Records per page in the template lists (owner remark, 2026-10-14)

Report Library and Report Definitions had no records-per-page choice (fixed 10). Now: `limit` (10, 20, 50 or 100) on `GET /reports/templates` and `/configuration`, applied by the server (other values 400); the screens show the standard "Show:" selector and reset to page 1 on a change. The Revisions section uses the same selector (its API already took `limit`).
"Revision in progress" is shown only in Report Definitions, not in the Library. Evidence: `Report*Test` 140 run / 0 failures / 24 skipped; frontend report tests 55/55, `tsc` clean; DEV: limit 20 and 10 accepted, 2, 7 and "abc" refused with 400.

### Template actions follow permissions, not accounts (owner correction, 2026-10-14)

Owner: the screen decided what to show from fixed conditions in the page (the `admin` flag, `canManage`, state tests in the screen). The system must use its dynamic authorization (permissions in Permission Sets, as Document does), so that another person than `admin` can do the work.

- **What the page flag `admin` was:** the page variant (Report Administration route versus Report Library), not a user; it is renamed `inAdministration` in the template screens to avoid the confusion. It only chooses the route, breadcrumb and list source.
- **Per-action permissions (V589):** `reports.definition.upgrade`, `reports.definition.discard_revision`, `reports.definition.set_enabled`, beside the existing `reports.definition.manage` (edit, submit, delete), `reports.definition.approve` (approve, return to draft; not for the author or submitter) and `reports.definition.view`.
  The services now require the permission of the action; the general `manage` permission no longer covers Upgrade, Discard or Disable/Enable. The migration grants them to nobody.
- **Capabilities from the server:** `GET /authorization/resources/REPORT_TEMPLATE/{code}/capabilities` (shared `ResourceCapabilitiesResponse`) answers per action from permission, template state and actor, with stable reason codes (`REPORT_PERMISSION_REQUIRED`, `REPORT_UPGRADE_REQUIRED`, `REPORT_REVISION_ALREADY_OPEN`, `REPORT_APPROVER_IS_AUTHOR`, ...).
  The template details, the template editor (edit, submit, approve, upgrade) and the row menu of the lists show only what it allows. Creating a new template, which has no record yet, is still gated by the permission only, as in the other modules.
- **Not changed (listed, not done):** schedules, name rules, number rule, retention and legal hold screens still decide by permission codes in the page (list-level actions); they have no per-record state rules.
- Evidence: `Report*Test` 145 run / 0 failures / 24 skipped (new: capabilities per permission set, author cannot decide, no capability without report access, upgrade/discard/disable need their own permission); frontend report tests 56/56, `tsc` clean.
  DEV: capabilities differ between `admin` and `approver.test1` for the same template; without the new permissions `admin` got 403 on a direct Upgrade and no button; after the three permissions were added to the DEV test set `PS_REPORT_AUTHOR_DEV_TEST` (also in the DEV access-profile script), disable, enable, discard and upgrade worked.
- Open: whether `reports.definition.manage` should keep implying the three new actions for existing roles (now it does not; an administrator ticks them).

### Stepper on the template screens (owner request, 2026-10-14)

The template editor (new and edit), the template details and the revision page show the same stepper component as the document revisions (`WorkflowStepper`): Draft, Pending Approval, Effective, Obsoleted, Closed - Cancelled (a discarded revision). It follows the revision being written, else the effective one; the revision page follows that revision. Display only (frontend, `ReportRevisionStepper`); no change to the backend or the data. Frontend report tests 56/56, `tsc` clean. Not viewed in a browser.

### General tab laid out like the document General tab (owner request, 2026-10-14)

The General tab of the template editor no longer uses a section card. It is a plain two-column grid of labelled fields like the General tab of a new document: Template Number and Revision (read-only), Created Time and Last Updated (read-only), Metadata Source and Name Rule, the typed parts of the name rule, Template Name (full width), "Use for GMP Decisions?" with its checkbox, Allowed Output Formats, Description. Same label size, input height and read-only style (`CONTROL_STATE_CLASSES`). Frontend only; the fields and their meaning are unchanged. Frontend report tests 56/56, `tsc` clean; not viewed in a browser.

### Description replaces the change reason; logo error fixed (owner requests, 2026-10-14)

- **Description required, no separate "Change reason" field.** The template editor has no change-reason box. `description` is required (server: `REPORT_DESCRIPTION_REQUIRED`, also in the editor, Save is disabled without it) and the server keeps it as the reason of the change when the request carries none (up to 1000 characters; audit, revision `change_reason`, signature reason). Upgrade, Discard, approve and return still ask for their own reason in their dialogs.
  Tests: `ReportTemplateSignatureTest` (description required, description becomes reason, an explicit reason is kept); `Report*Test` 146 run / 0 failures / 24 skipped; frontend 56/56.
- **Layout Designer red error ("The server rejected this request. Check required columns, criteria and active role assignments.").** Cause, reproduced on DEV: the logo `logo_doc_nobg.png` is 2474 x 1736 pixels (4.29 megapixels, only 139 KB), above the 4-megapixel limit of the server, so the preview answered `REPORT_IMAGE_INVALID`, and the screen showed the general message. Fix: (1) a picture above the limit is reduced in the browser when it is uploaded (longest side 1600 px); (2) the error says what is wrong for `REPORT_IMAGE_INVALID`, `REPORT_LOGO_REQUIRED`, `REPORT_LOGO_INVALID`, `REPORT_LAYOUT_INVALID`, `REPORT_CHART_INVALID`. The server limit is unchanged. Re-upload the logo to clear the error on a template that already holds the large picture.

### Report Name Format editor laid out like the Document Name Format editor (owner request, 2026-10-14)

`ReportNameFormatEditView` now follows `DocumentNameFormatEditorView`: page layout and spacing, a General section with the info icon (Name, Code, Separator, Description; same labels and fields), a Parts section with the numbered list and arrows to reorder, a "New Part" button in the section header, a green Preview block, Back and Save in the header (Save is enabled only when the form differs from what the server returned and is valid), a loading panel and a load-error panel, and a toast on success or failure. The reason for the change is still asked in a dialog on Save, because the server records it. Frontend only; the fields and rules are unchanged. Report frontend tests 56/56, `tsc` clean. Not viewed in a browser.

### Report Name Formats list: No. column and a three-dot menu (owner request, 2026-10-14)

The list starts with a locked No. column and the action column is the three-dot menu used by the other tables: View Detail, Edit Report Name Format, Disable / Enable (Edit and Disable / Enable only for people with `reports.name_format.manage`). View Detail opens the format read-only (`?mode=view`, title "Report Name Format Details"; the name in the list also opens it); Edit opens the editor; Disable / Enable still asks for a reason and is audited by the server. Frontend only. Report frontend tests 57/57, `tsc` clean; not viewed in a browser.

### Report Name Formats list built like the Document Name Formats table (owner request, 2026-10-14)

`ReportNameFormatsView` and the new `ReportNameFormatsTab` / `ExpandedReportNameFormatRow` repeat `DocumentNameFormatsView` / `DocumentNameFormatsTab` / `ExpandedDocumentNameFormatRow`: page layout (header, a white card holding the tab), mobile search and Filters button with the filter drawer, desktop filters (Search, Status, Modified Date Range, Clear Filters, Custom Column), the table in its own bordered card with the columns Expand, No., Name (with "e.g." example), Code, Separator, Description, Status (Active / Inactive), Modified Date and Action (three dots), a row click that opens the format, the expanded row listing the name parts (Type, Text / Label, Rule, Order) in the same nested table, and the same pagination. Menu: View Detail, Edit Report Name Format, Disable / Enable (the last two for `reports.name_format.manage`). Disable / Enable uses the same warning dialog and asks for the reason that the server records.
Differences kept on purpose: a Code column (a report format is identified by its code), Name / Code / Status / Modified Date are sortable, and the dialog has a mandatory reason. The list takes `modifiedFrom` / `modifiedTo` (yyyy-MM-dd, validated) and returns each format's `parts`. A loop that reloaded the table on every render (an unstable fetcher) was found while testing and removed.
Evidence: `Report*Test` 146 run / 0 failures / 24 skipped; frontend report tests 57/57; `tsc` clean; DEV: date filters 200, an invalid date 400. Not viewed in a browser.

### Report Change History & Validation removed (owner decision, 2026-10-14)

Owner: the screen duplicates the Audit Trail (who did what, when, why) and the Revisions of a template (what the template was), so it is removed with what belonged only to it.
- **Frontend:** the screen `ReportValidationView`, its menu entry, route (`/settings/administration/report/validation`), route constant, client call `listChangeHistory`, type `ReportChangeRow`, its unused sample data, and its test row.
- **Backend / API:** `GET /reports/change-history`, `ReportPlatformService.changeHistory`, the navigation item `report-admin-validation`, and the two tests of it. DEV: the endpoint answers 404 and the menu no longer lists the screen.
- **Database:** nothing was dedicated to it, so no migration. The table `report_definition_versions` stays: saving and approving a template, the History tab of the template editor and the independent-reviewer check use it; the screen only read it. No user preference pointed at the removed route.
- **Where to look now:** Audit Trail for the events (entity REPORT_DEFINITION), and the Revisions section of the template details for each revision, its content and its approval.
- SDS-RP-001 updated (menu table, route list, GMP note). `Report*Test` 145 run / 0 failures / 24 skipped; frontend report tests pass; `tsc` clean.

### Audit Trail: report records searchable and readable (owner approval, 2026-10-14)

Impact analysis (GitNexus, `eqms-backend`): `AuditTrailService.listQuery` risk LOW (callers: list and export), `buildModuleFilterPredicate` LOW. Changes: (1) the Audit Trail search also matches the **name of the record** (`entity_name`), so a template number such as `RPT.0004` finds its events; this widens the search for every module, by the name that people see; (2) the screen shows the Reports record types as words (Report Template, Report Run, Report File, Report Schedule, Report Name Format, Report Properties) instead of machine codes; (3) the template details have an **Audit Trail** button (capability `viewAuditTrail`, permission `audit.view` / `audittrail.module.view`) that opens the Audit Trail searched for the template number. Stored values are unchanged.

### Report Properties (owner request, 2026-10-15) - REPORT-PROPERTIES-2026-10-15

The screen **Report Template Numbering** is renamed **Report Properties** and holds the settings of the Reports module, laid out like Document Properties (sections with an icon, groups, Save Changes in the header, a confirmation that names the Audit Trail).
- **Review of Report Administration.** Moved in: the numbering of templates (prefix, digits, next number; the rule table `report_template_number_rule` is replaced by `report_properties`, values and last serial copied, so no number is issued twice); the **Output Controls** preview screen was removed (its switches stored nothing; only a real value was kept: the largest file is expressed as the most rows); the **Retention** statement ("kept permanently", legal hold) is shown as a group. Not moved because they are lists or registers, not settings: Report Definitions, Report Name Formats, Access & Data Scope, Legal Hold Register, Scheduled Report Delivery.
- **Settings (all enforced by the server):** template number prefix and digits; default Report Name Format (a new template starts with it); most rows in a report file (was fixed 10,000; range 1,000-100,000); most recipients of a schedule (was 200; 1-500); retry of a schedule after a temporary failure (was 5 minutes; 1-60). The values of the code are the defaults, so behaviour is unchanged until an administrator changes them. A lowered row limit does not make an old report undownloadable (the check at download uses a fixed ceiling of 100,000).
- **Permissions (V590):** `reports.properties.view`, `reports.properties.manage`, granted to nobody by the migration; the menu entry and the route need one of them. Existing holders of `reports.name_format.manage` no longer reach the numbering by that permission.
- **Audit:** each save is `REPORT_PROPERTIES_UPDATED` (entity `REPORT_PROPERTIES`) with the values before and after; a first attempt failed on a missing entity id and was fixed (the transaction rolled back, nothing was saved).
- Evidence: `Report*Test` + `AuditTrail*Test` 151 run / 0 failures / 24 skipped (new `ReportPropertiesTest`); frontend report tests 58, `tsc` clean. DEV: `GET/PUT /reports/properties`: unchanged 409, stale version 409, value outside limit 400, save 200 with the audit text "Most rows in a report file: 10000 -> 20000; ...", a person without the permission 403, menu lists Report Properties and no longer Template Numbering or Output Controls. The DEV test permission set got the two permissions (also in the DEV script). Not viewed in a browser.

### Report Name Format editor: Parts laid out like Components (owner remark, 2026-10-15)

The Parts section of `ReportNameFormatEditView` still showed a form inside every row, unlike the Components section of the Document Name Format editor. It now has the same layout: compact numbered rows (the name of the part, a chip, the rule in small text), with edit, move up, move down and remove buttons at the right, the "New Part" button in the section header, and the green Preview below. A part is added or changed in a dialog (type, text or label, rule, longest); the dialog accepts it only when it is complete. The fields and rules are unchanged. Not done on purpose: the Document editor also has a picker of ready-made components under the list; parts are written by the author (fixed text or a typed value), so there is no catalog to pick from. Report frontend tests 59, `tsc` clean; not viewed in a browser.

### Report Administration list screens: no table inside a section (owner remark, 2026-10-15)

Report Access & Data Scope, Report Retention & Legal Hold and Scheduled Report Delivery put their table in a section card (FormSection) inside one more card. They now have the layout of the other report lists (Run History, Report Definitions): the header, a short note when needed, and the list in its own card with its filters, `DataTable`, pagination and Custom Column. The wording that sat in the sections is a note above the list: Retention says that files are kept permanently and that a legal hold blocks removal; Delivery says that the most recipients of a schedule is a setting of Report Properties and links to it (the old text "Fixed in the system" was wrong since Report Properties). The frame of these screens no longer has the Save Changes button and the design-preview banner, which they never used. Frontend only; report frontend tests 59, `tsc` clean; not viewed in a browser.

### Name format applied automatically, Access & Scope table, fonts, logo, charts (owner requests, 2026-10-15)

**1. One active Report Name Format; a new template is named by it (V591).** The author no longer chooses a rule. Only one format is active at a time (a partial unique index `ux_report_name_formats_one_active` makes the database refuse a second). Creating a format makes it active only when none is; enabling a format disables the one that was active in the same step, and both are written to the Audit Trail (`REPORT_NAME_FORMAT_DISABLED` says "Replaced by <code>"). A new template takes the active format whatever the client sends (the editor shows it read-only; the typed parts of its name are asked); with no active format the name is typed. An existing template keeps the format that named it and a request cannot move it to another one (a template whose format was disabled may still change its name values). The "Default Report Name Format" of Report Properties was removed (column dropped) because the active format is the one.
**2. Access & Scope tab** now has the standard table: No., Access Profile, Code, Data scope, Access; search, filters (Assignment, Data scope), sort, Custom Column, page size, all done by the server (`POST /reports/templates/roles/search`; the scopes set but not yet saved travel with the request so the server can filter and sort by them). A scope given to a profile that is not active any more is listed with a Remove button (before, it could not be seen and blocked saving). The old call that loaded every profile at once is no longer used.
**3. Page Templates and Charts, review.** Fixed or added: the font of the whole report (below); the default footer reads "Rev <n>" (it said "v<n>", but the number is the revision); two placeholders, **Template name** and **Run ID** (the run id lets a printout be traced to its record; "LAYOUT_PREVIEW" / "PREVIEW" in previews); a chart with more groups than it shows (new setting "Most groups shown", 5-20, default 20) adds the rest together as one "Other (n groups)" bar, in the open and with the total unchanged, instead of failing the whole report at run time; a monthly trend of more than 20 months is still refused; clearer messages for the chart errors that appear when a report is made (`REPORT_CHART_GROUP_LIMIT`, `..._DATE_REQUIRED`, `..._FIELD_NOT_SELECTED`). Not changed, on purpose: the paper is A4 (the EU GMP standard; other sizes are an owner decision); header and footer have a fixed position and size; charts use fixed colours.
**4. Fonts and logo.** *Konva:* the stamp, watermark and logo are already positioned with react-konva (`ReportMarkCanvas`, built on the same approach as the Controlled Copy marking preview, which the editors `MarkCard` share); nothing was replaced. *Times New Roman:* added for the stamp and the watermark and as a new setting **Report font** (cover, header, footer, table, charts; Noto Sans by default, five choices). It is printed in **Tinos** (SIL OFL, bundled with its licence; same letter widths as Times New Roman, Vietnamese supported), because the Microsoft font is not licensed for embedding; a cover, header or footer made from a Word file keeps the fonts of that file. *Logo:* up to 10 MB can be chosen; the picture is reduced in the browser to what the layout keeps (sides up to 1600 px, at most 3 megapixels and about 1 MB, JPEG when a PNG stays too heavy), so the preview and the report stay light; the limits of the server are unchanged.
Evidence: `Report*Test` 155 run / 0 failures / 24 skipped (new: `ReportFontTest`, `ReportChartGroupsTest`, `ReportRoleSearchTest`; `ReportAnalyticsTest` now expects the "Other" bar instead of a refusal); frontend report tests 62, `tsc` clean. DEV: a second format is created inactive; enabling it makes it the only active one; a new template (`RPT.0006`) got the name "SEC - Quarterly register" from the active format although the client sent another name; roles search 200 (27 profiles), assigned filter and sort by scope work, bad sort 400; layout preview in Times New Roman with Vietnamese text 200, unknown font 400. The test format `E2E_SECOND` (inactive) and template `RPT.0006` remain on DEV; `EQMS_TOPIC` is the active format again. Not viewed in a browser.

### Access & Scope tab: spacing (owner remark, 2026-10-15)

The filters and the table of the Access & Scope tab were indented twice: the tab already has its padding and the list toolbar added its own. `ReportListToolbar` has a new option `flush` for a list placed in a container that already has padding; the tab uses it, so the filters and the table line up with the note above them and with the edges of the tab. Other screens are unchanged. Frontend only; report frontend tests 62, `tsc` clean; not viewed in a browser.
