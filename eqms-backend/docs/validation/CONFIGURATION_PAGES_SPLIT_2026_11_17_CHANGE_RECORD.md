# Change record: Configuration split into pages (2026-11-17)

Decision: `CONFIGURATION-PAGES-SPLIT` in `governance/DECISION_LOG.md`. Risk: low (navigation and screen structure; no permission, API, data or audit change).

## What changed
| Area | Change |
|---|---|
| Menu (server) | `NavigationService`: `config` is a group with `config-general`, `config-navigation-labels`, `config-security`, `config-notifications`, `config-integrations`, `config-preview-file`, `config-image-watermark`, `config-features`, all behind `settings.configuration.view` |
| Menu (fallback) | `eqms/src/app/navigation.ts`: the same group |
| Routes | `routes.constants.ts` (`CONFIGURATION_*`), `SettingsRoutes.tsx` (eight routes, index redirect), `ConfigurationIndexRedirect.tsx` (old `?tab=` links) |
| Screen | `ConfigurationView.tsx` follows the address; state keyed by page; `configurationPages.ts` is the one list of pages (label, path, menu id, old tab) |
| Titles | `PageHeader` title and last breadcrumb = menu text; breadcrumb `configuration()` is System Administration > Configuration > page |
| Leave guard | `useReportUnsavedChanges` (new) feeds `Sidebar.tsx` at both places that decide to warn; also asks on reload/close |
| Links | `NotificationsDropdown`, `NotificationDock` go to the Notifications page; `StorageUsageAlertService` links to Integrations (text and test updated) |
| Removed | tab strip, `?tab=` state, `TabNav` use in the view |

## Evidence
- Frontend: `tsc` clean; full vitest 306 files / 1763 tests pass. New: `configurationPages.test.ts` (list, paths, old tabs, parity with `navigation.ts` and with the Navigation Labels options), `SettingsRoutes.configuration.test.tsx` (eight addresses with the view permission, bare address, eight old `?tab=` links, unknown tab/page), `ConfigurationView.pages.test.tsx` (title and breadcrumb of each page, content of each page, panels needing manage, save sends only the changed section, Reset, an unsaved edit does not follow to another page, failed save keeps the edit), `useReportUnsavedChanges.test.tsx`, `Sidebar.unsavedChanges.test.tsx`; rewritten `ConfigurationView.loading.test.tsx` and `ConfigurationView.networkSave.test.tsx`.
- Backend (clean build): `NavigationConfigurationGroupTest` (new, 5), `NavigationReportTemplatesTest`, `RecordsNavigationTest`, `TrainingNavigationTest`, `DocumentControlMenuAccessTest`, `StorageUsageAlertServiceTest`, `CountriesRetirementTest`, `Sprint10AuthorizationHardcodeRegressionTest`: all pass.
- DEV browser run (Edge, `dco.test1`): 42 checks pass: bare address and `?tab=notification` redirects; the group and its eight entries in the sidebar; for each page the address, the title and the breadcrumb; an edit then a click on another page asks, "Stay on page" keeps the edit, "Leave Anyway" goes and the edit is not saved; a clean page leaves at once. Real save: General saved and `PUT /settings/system` carried only `general`; the value was there after a reload; Features had Save disabled; the value was restored and checked.

## Not done
- GitNexus is not available in this session: no `impact` or `detect_changes` was run; callers were found by search (every use of `ROUTES.SETTINGS.CONFIGURATION`, the `config` id, `?tab=` and the bare address).
- No browser check of the bell's settings shortcut (its target is the new constant, covered by type check only), of a narrow phone screen, or of an account that holds only `settings.configuration.view`.
- Spring integration tests were not run (the app context does not start here).
- Not committed.

## Addendum: Audit Trail follows the pages, and the leave guard (same day)
**Audit.** Backend: new `ConfigurationAuditPage` (util), `SystemConfigurationService` (changes grouped by page, one record per page, `addConfigurationChanges` is static), `AuditObjectRegistry`, `AuditMenuModule`, `AuditTrailService` (entity group and label), `AuditNotificationEvents`, `StorageUsageAlertService`. Tests: `ConfigurationAuditPageTest` (7), two new cases in `SystemConfigurationAuditChangesTest`, and the existing registry/module/scan tests pass (they fail for a kind that is written and not registered). DEV, real saves as `dco.test1`: a General save is written with Object Type General, a menu label with Navigation Labels, and one save that changed both wrote two records; module System Administration; the configuration was restored and checked.
**Leave guard.** Frontend: `hooks/useLeaveGuard.tsx` (moved, extended), `hooks/useFormDirty.ts` (new), `hooks/useReportUnsavedChanges.ts` (from the first part), 30 screens (list in the Decision Log, LEAVE-GUARD-2026-11-17). Tests: `useLeaveGuard.test.tsx` (9), `useFormDirty.test.tsx` (5), screen tests for the School form (6), E-Sign Config (3) and the Document Component form (2, with the state that carries a draft); two Notifications assertions updated to the shared wording. Full run: `tsc` clean; vitest 311 files / 1788 tests pass. DEV browser run (Edge, `dco.test1`): 25 checks pass, 2 skipped (below). For School, E-Sign Config (sidebar), Time-Limited User, Shared Permission Set, SoD Constraint, Document Properties and the Preferences tab change: the question appears, "Stay on page" keeps the page and the typing, "Leave Anyway" goes, a clean page goes at once, and an edit that was left is not saved.
**Not checked.** Announcement and Report Appearance in the browser (the account could not open the form); the other screens of the list were checked by the hook tests and the type check only, not one by one in the browser; the browser's Back button; a narrow phone screen. GitNexus was not available: callers were found by search. Spring integration tests were not run. Not committed.
