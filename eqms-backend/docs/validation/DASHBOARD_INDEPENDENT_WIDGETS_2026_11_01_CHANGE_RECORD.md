# Independent dashboard widgets — 2026-11-01

Owner request: split every grouped dashboard card, especially System monitoring, into independently configurable widgets and add useful cards backed by real data.

## Scope and invariants

- Admin dashboard has 18 widgets; user dashboard has 10. Existing overview KPI groups are individual cards. Monitoring exposes uptime, connections, sessions, failed logins, users by status, compliance queues, runtime, locked accounts and electronic-signature counts separately.
- No data endpoint, SQL aggregation or authorization guard changes. Monitoring is fetched once by the administrative dashboard and retains one realtime/visibility subscription. User dashboard does not acquire administrative monitoring data.
- Personal layout GET/PUT/DELETE still derives user identity from CurrentUserService. Role defaults remain fallback only. Widget IDs are presentation preferences and cannot grant data access.
- Server layout validation accepts the expanded catalogue and legacy group IDs, preserving strict shape, uniqueness, maximum 30 entries and half/full width checks. Existing JSON storage requires no schema migration.
- FE expands legacy grouped preferences in place, preserves visibility, uses half-width defaults for independent children, and gives explicit child preferences precedence. Existing stored rows are not rewritten during reads.
- Document lifecycle, parent-child effects, files/checksums, signatures, audit policy and async jobs are unchanged. The signature widget is an existing aggregate count, not a signing operation.

## Source evidence

- `eqms/src/features/self-service/dashboard/shared/dashboardWidgetCatalog.ts`: shared UI catalogue and legacy expansion.
- `AdminDashboardView.tsx`, `UserDashboard.tsx`, `admin/SystemMonitoringSection.tsx`: independent content and one monitoring resource.
- `DashboardWidgets.tsx`, `DashboardRoleDefaults.tsx`: personal and role layout compatibility.
- `UserUiPreferenceService.validateDashboardLayout`: expanded server whitelist only.
- `DashboardController.getSystemMonitoring`: existing administrative permission remains required.

GitNexus reported LOW for dashboard views, shared DashboardWidgets, SystemMonitoringSection and validateDashboardLayout. New catalogue helper is not indexed; its two source callers were inspected directly. No HIGH/CRITICAL edit was required.

## Test evidence

- 71 frontend tests passed across dashboard and role-default suites. Coverage includes real fixture values, unavailable metrics shown as dashes, one monitoring request, realtime/visibility refresh and cleanup, queue links subject to existing permissions, legacy expansion and explicit child precedence, save/cancel and role defaults.
- 17 backend tests passed: UserUiPreferenceServiceTest (12), DashboardControllerAuthorizationTest (4), DashboardRoleLayoutControllerTest (1). Includes expanded IDs, legacy compatibility, unknown/duplicate/invalid settings and authenticated-user ownership.
- Final TypeScript check passed. Backend/frontend Docker builds passed; backend is healthy after deployment.
- Authenticated Chrome verification found 18 independent Admin widgets. Hiding uptime retained database/runtime widgets; changing database connections to Full retained Active sessions at Half. Cancel restored the saved layout. Mobile viewport 390px had document width 390px and retained all 18 widgets. No browser errors were reported. All trial layout changes were discarded; no user preference was overwritten for testing.

The referenced generic change-record template and evidence-conventions file are absent from this checkout; this source/test record uses the available project record format. This is implementation evidence, not a claim of GMP compliance.
