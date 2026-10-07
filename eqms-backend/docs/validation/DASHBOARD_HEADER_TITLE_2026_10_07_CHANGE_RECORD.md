# Configurable top-bar title on the Dashboard

## Request and scope
Owner request, 2026-10-07 (decision `DASHBOARD-HEADER-TITLE-2026-10-07` in `../governance/DECISION_LOG.md`). On the Dashboard, on desktop,
the top bar shows "Electronic Quality Management Software" and keeps it while the page scrolls (it does not turn into the page title).
The text is configured in Settings > Configuration > General > Branding. Presentation only: no lifecycle, permission, signature or
audit rule changes.

## Invariants
- **Who may change it:** unchanged. Saving the General configuration is the existing `updateConfiguration` path with its existing
  permission; the new field adds no endpoint and no permission.
- **Machine value:** `systemHeaderTitle` (General configuration, top level). The text is display only; nothing keys on it.
- **Validation (server):** absent or null is allowed; otherwise a string of at most 120 characters (after trimming) without control
  characters. A non-string, a longer text or a line break is refused with `IllegalArgumentException`, as the other General settings are.
  The form also limits the input to 120 characters and turns tabs into spaces.
- **Public value:** `GET /branding` returns it trimmed, or `null` when it is empty or blank. The screen owns the default text, so the
  server invents none.
- **Rendering:** shown as text (never markup). Desktop/tablet only; phones are unchanged. On the Dashboard it replaces the breadcrumbs
  and does not fade out on scroll; on every other page nothing changes.
- **Audit and refresh:** the change is part of the "General Configuration" diff the save already writes to the audit trail, and the
  existing `branding-updated` event refreshes open sessions after the commit.
- **Stored at the top level on purpose.** The form writes the General configuration fields at its top level, and the merge on save
  keeps them (`mergeGeneralConfigForStorage`).

## Changes
Backend: `PublicBrandingResponse.systemHeaderTitle`; `SystemConfigurationService` (`getPublicBranding`, `validateSystemHeaderTitle`
called by `updateConfiguration`). Frontend: `Header` (`pinSystemTitle`), `MainLayout` (passes it on the Dashboard through
`isDashboardPath`), `GeneralTab` ("Header" group in Branding), `PublicBranding` and `GeneralConfig` types, `DEFAULT_SYSTEM_HEADER_TITLE`.

## Source and impact evidence
GitNexus was **not available in this session**: `impact` and `detect_changes` were not run. The backend change adds a record component,
one private method, one static validator and one call; the frontend adds an optional prop and an optional field. Run `detect_changes`
against `main` before committing; the working tree holds many unrelated uncommitted changes.

## Test evidence
2026-10-07, Java 23 and vitest.
- Backend, `SystemConfigurationServiceBrandingTest` (11): the public value is the trimmed text, null when missing, null or blank, and is
  read from the General settings, not from `appearance`; validation accepts missing, blank, a normal title (also with accents) and exactly
  120 characters, and refuses 121 characters, a number, an object, a line break and a tab.
- Frontend: `Header.systemTitle.test.tsx` (5): the configured text replaces the breadcrumbs; it stays when the page has scrolled while the
  page title is hidden on desktop; empty, missing or blank brings back the default; markup in the text is shown as text; other pages are
  unchanged. `GeneralTab.headerTitle.test.tsx` (5): the field is in Branding with the default as placeholder and the explanation, shows
  the saved text, changes only that field, keeps one line of at most 120 characters, and can be cleared. `dashboardPath.test.ts` (2):
  `/dashboard` with or without a trailing slash is the Dashboard; other paths, including `/dashboards`, are not. Affected folders: 155 tests.

## Limitations and open risks
- **Not looked at in a browser, and not saved through the real HTTP API.** The save path (merge, audit, refresh) was read, not exercised.
- The running images are older than these changes: the frontend and the backend must be rebuilt to see the field. Until then the Dashboard
  shows the default text.
- **Found, not changed:** the existing **System Footer** has the same shape of setting but the server reads it from
  `general.appearance.systemFooter` while the form writes `general.systemFooter`, and the stored configuration has neither. A footer
  entered in the form is therefore saved but not published, and the screen shows its built-in text. It needs its own decision before
  anyone changes which one is right.
