# Dashboard Permission Sets (User and Admin), dashboard split, Effective Documents by Type, System monitoring

## Request and scope
Owner request, 2026-10-07 (decision `DASHBOARD-PERMISSION-SETS-2026-10-07` in `../governance/DECISION_LOG.md`).
1. Split the dashboard feature into an **admin** and a **user** part.
2. Create two separate **Permission Sets**, one for each dashboard. Owner answers: bundles of the existing permissions, created
   but not assigned to any Access Profile.
3. Earlier in the same work (no separate decision needed, read-only): a new count endpoint behind the existing dashboard permission,
   `GET /dashboard/effective-documents-by-type`, used by the "Effective documents by type" chart.
4. System-monitoring cards on the administrative dashboard (decision `ADMIN-SYSTEM-MONITORING-2026-10-07`): a read-only endpoint
   `GET /dashboard/system-monitoring` behind `dashboard.admin.view`, and a redesigned "Documents by status" card.

## Invariants
- **Actor and permission:** unchanged. User dashboard and its endpoints: `dashboard.module.view`. Administrative dashboard and
  its endpoints: `dashboard.admin.view` (V403: REQUIRES `dashboard.module.view`). The screen shows the administrative dashboard only
  to a holder of `dashboard.admin.view`, else the user dashboard. Enforcement is server-side in `DashboardController`; the screen
  choice is a display hint.
- **Permission Sets (V551):** `DASHBOARD_USER` = {`dashboard.module.view`}; `DASHBOARD_ADMIN` = {`dashboard.admin.view`,
  `dashboard.module.view`}. Active, not system. **Assigned to no Access Profile**, so no user gains or loses a permission.
  `BASELINE_PERSONAL_WORKSPACE` (system, attached to every Access Profile) still grants `dashboard.module.view`.
- **Machine values:** permission and set codes are the stable values; the names are display text only.
- **Effective Documents by Type:** "Effective" is the Document Master status `ACTIVE`, the same definition `getSummary()` uses, so the
  per-type counts add up to `summary.totalEffectiveDocuments`. Types with no effective Document are not listed; an inactive type
  that still has effective Documents is counted. Read-only; the same permission and the same global scope as `summary`.
- **System monitoring:** `GET /dashboard/system-monitoring` is refused unless the server finds `dashboard.admin.view`; holding
  `dashboard.module.view` is not enough. It counts only (no write, no audit entry, no signature). Definitions: active session =
  status ACTIVE, not revoked, not expired; locked account = `locked_until` in the future; failed login = auth audit event
  `login_failed` in the last 24 h; e-signature = status SIGNED in the last 30 days; open review/discrepancy = status IN_PROGRESS /
  OPEN. User statuses are every `UserStatus` value, so they add up to all users. Pool figures are null, and shown as a dash,
  when the pool does not report them. The response omits OS, vendor, driver and host details.
- **Not changed:** every other dashboard endpoint, the authorization engine, e-signature, audit.

## Changes
System monitoring: `DashboardSystemMonitoringResponse`, `SystemMonitoringService` (new), seven additive count methods on
`UserAccountRepository`, `AuthSessionRepository`, `AuthAuditLogRepository`, `ElectronicSignatureRepository`,
`AccessReviewCampaignRepository`, `AuditTrailReviewCampaignRepository`, `ControlledCopyBatchStatusDiscrepancyRepository`;
`DashboardController` gains the service and the endpoint. Frontend: `admin/SystemMonitoringSection`, `admin/DocumentsByStatusPanel`.
DB: `V551__dashboard_user_and_admin_permission_sets.sql` (idempotent). Backend: `DashboardDocumentTypeCountResponse`,
`DocumentRecordRepository.countDocumentsGroupedByTypeForStatus`, `DashboardService.getEffectiveDocumentsByType`,
`DashboardController` `GET /dashboard/effective-documents-by-type`. Frontend: `features/self-service/dashboard/` now has `admin/`,
`user/` and `shared/`; `DashboardView` chooses between `admin/AdminDashboardView` and `user/UserDashboard`; `FlatTable` now uses the
shared `TableMarkup` primitives (it used native table tags, which `TableArchitecture` forbids).

## Source and impact evidence
GitNexus was **not available in this session**, so `impact` and `detect_changes` were not run. The backend edits only add members
(one record, one repository method, one service method, one endpoint) and one migration; no existing statement was changed (the diff
of those three files is additions only). Callers of the existing `DashboardService` constructor and endpoints are unaffected. Run
`detect_changes` against `main` before committing; the working tree also holds many unrelated uncommitted changes.

## Test evidence
2026-10-07, Java 23 and vitest.
- `DashboardPermissionSetsMigrationIntegrationTest` (3, real schema, migration V551 applied to the development database by the run):
  the user set bundles exactly `dashboard.module.view`; the admin set bundles `dashboard.admin.view` with the
  `dashboard.module.view` that V403 says it requires; both are active, not system, with the expected names.
- Checked directly in the database afterwards: `DASHBOARD_ADMIN` 2 permissions and `DASHBOARD_USER` 1 permission, **0 assigned
  Access Profiles each**.
- `DashboardServiceTest` (3) and `DashboardEffectiveDocumentsByTypeIntegrationTest` (1, real schema): rows map in repository order,
  the sum equals `countByStatus_Code("ACTIVE")`, rows are largest first with no duplicate type, an empty result is an empty list.
- System monitoring, backend (2026-10-07): `DashboardControllerAuthorizationTest` (4): the monitoring endpoint is refused to a user who
  holds `dashboard.module.view` but not `dashboard.admin.view` and the service is not called; it is served to a holder of
  `dashboard.admin.view`; effective-documents-by-type needs `dashboard.module.view`. `SystemMonitoringServiceTest` (4): runtime and
  database facts and no OS/vendor detail, every user status in order, the 24 h and 30 day windows and the statuses queried, a missing pool
  stays null. `SystemMonitoringIntegrationTest` (1, real schema): the derived queries run and the user statuses add up to all users.
- System monitoring, frontend: the admin dashboard tests (14) cover the figures, a missing pool shown as a dash, user statuses largest
  first, queue links only with the matching permission, the runtime facts, Refresh, the one-minute re-read and its stop on unmount, and a
  failed read that leaves the rest of the page working. Whole frontend suite: 406 of 407; the failure is `ReportLists`, unrelated.
- Frontend: 93 tests in `components/ui/table`, `features/self-service` and `components/ui/animated-card`, including the admin and
  user dashboards (figures, errors, search, fixed header), the bar/donut chart, "My documents", and `TableArchitecture`.

## Limitations and open risks
- **Not run through the browser or the HTTP API** with an account that holds only the new sets; the endpoints' denial for a user
  without `dashboard.module.view` was not exercised by a direct API test.
- System monitoring was verified through the service and the real schema, not against a running server or the HTTP API. No health
  threshold exists, so the cards cannot raise an alarm; the reachability of MinIO, ClamAV, OnlyOffice, Redis and mail is not monitored.
- The new sets do nothing until an Administrator assigns them. Assigning `DASHBOARD_ADMIN` to a profile grants
  `dashboard.admin.view`; that is an access decision for the Administrator (V278 removed it from DCO on purpose).
- `DASHBOARD_USER` overlaps `BASELINE_PERSONAL_WORKSPACE`; assigning it adds nothing today.
- The running backend and frontend images predate these changes (the endpoint and the screen need a rebuild).
