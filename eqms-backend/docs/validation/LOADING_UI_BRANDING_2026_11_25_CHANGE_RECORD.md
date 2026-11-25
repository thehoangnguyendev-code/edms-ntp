# Loading UI in shared Branding — 2026-11-25

Status: implemented and deployed to the local application containers; pending QA review.
Owner request: integrate loading-ui.com into the shared loading components, with a
style select, colour picker and live preview in General > Branding, saved for all users.
The user explicitly approved the reported HIGH/CRITICAL shared-component scope and
updating the frontend/backend Docker containers with the current workspace.

## Scope and invariants

- Add `general.appearance.loadingStyle` and `loadingColor` to the existing server
  configuration JSON. No migration or new authorization route is needed.
- Save still requires the existing General Manage permission; existing per-page
  permission checks, mandatory before/after audit and transaction boundaries remain.
- Only after the existing save and audit commit does the existing `branding-updated`
  invalidation cause browsers to re-read the public Branding API. No configuration
  data is put in the SSE payload. Existing polling handles disconnected browsers.
- Public Branding exposes only the selected identifier and validated six-digit hex
  colour. Unsupported identifiers, wrong types and arbitrary CSS/URLs are rejected
  on save. Missing/invalid legacy public values fall back to `system` / `#059669`.
- Preview is a controlled, local draft. It never updates runtime Branding before a
  successful save. Its two changes patch only their own fields; discarding Branding
  restores legacy configurations without introducing unrelated Appearance defaults.
- Loading/full-page overlays, button disabled state, handlers, API payloads, object
  scope, business lifecycle, e-signatures, artefacts/checksums and async jobs are unchanged.
- Existing explicit caller colour overrides and white indicators on filled buttons
  retain contrast. Skeletons retain their existing layout-preserving read placeholders.

## Implementation

Frontend: `config/loading.ts`; `ui/loading/LoadingIndicator.tsx`, `Loading.tsx`,
`loading.css`; `ui/button/Button.tsx`; `configuration/tabs/LoadingSettings.tsx`,
`GeneralTab.tsx`, `generalTabs.ts`, `configuration/types.ts`; `api/branding.ts`.

Backend: `LoadingAppearancePolicy`, `SystemConfigurationService` (one validation call
and two public response values), `PublicBrandingResponse` (two additive fields).

22 compact Loading UI components plus the existing default are available. Their MIT
source and license are vendored under `ui/loading/loading-ui/` using the documented
manual installation method. The original keyframes are loaded once; no runtime CDN
request or additional animation dependency is introduced. A static indicator is used
for reduced-motion preferences. Size, wrappers and accessibility are shared.

Upstream: https://github.com/turbostarter/loading-ui
Installation: https://www.loading-ui.com/docs/usage

## Impact review

After rebuilding the stale index without changing source context files:
- Loading: CRITICAL, 9 direct, 368 impacted symbols, 25 process groups.
- ButtonLoading: CRITICAL, 6 direct, 302 impacted symbols, 21 process groups.
- Button: CRITICAL, 330 direct, 606 impacted symbols, 23 process groups.
- getPublicBranding: CRITICAL, 8 direct, 32 impacted symbols, 1 process group.
- updateConfiguration (2 arguments): LOW, 2 direct, 3 impacted symbols.
- GeneralTab and general-tab field mapping: LOW in the index.

The user approved the shared Loading/Branding change before these edits. Tests and
new symbols not yet indexed were reviewed by file. Pre-existing Training, audit UI
and other workspace changes are outside this feature; no commit/push was performed.

## Executed evidence

- 69 related frontend tests passed, including all 23 style choices, size/colour
  forwarding, legacy defaults, explicit colour override, filled-button contrast,
  disabled actions, overlay preservation, unsaved preview isolation and exact reset.
- A mounted-loader test uses the real shared Branding hook: the server invalidation
  refreshes the style/colour and caches the saved values for returning users.
- 44 backend tests passed across LoadingAppearancePolicyTest,
  SystemConfigurationLoadingTest, SystemConfigurationServiceBrandingTest,
  SystemConfigurationServicePageAuthorizationTest and SystemConfigurationAuditChangesTest.
  Coverage includes invalid input before persistence, General permission denial,
  before/after audit values and transaction-synchronization tests for commit,
  rollback and audit failure. These are unit/service tests, not a database commit test.
- TypeScript and production build passed on the final feature source.
- Broader frontend run: 2330/2332 passed. NotificationEventView's placeholder test
  passed on a focused rerun; PageBackgroundEditor.test.tsx `uploads video to the
  server and enables repeat` still fails looking up `Video preview`. Neither the
  video editor nor that test is changed by this feature (49/50 on focused recheck).
- Local Docker frontend/backend updated with owner approval. Backend is healthy;
  live `GET /api/branding` returns `loadingStyle: system`, `loadingColor: #059669`.
- Browser: selecting Ring and #1565C0 changes the preview immediately. Desktop:
  two columns; tablet 1024px: two columns without horizontal overflow; mobile 390px:
  one column with preview below and scrollWidth equal to viewport width. Temporary
  viewport overrides were reset and the test draft discarded; no test choice was
  saved to the shared configuration.
- During UI checks another process temporarily wrote an invalid newline literal in
  AuditTimeline.tsx, then corrected it. No patch from this feature was applied to
  that file; the frontend image was refreshed from the corrected source.

Reports/logs/screenshots: `%TEMP%/eqms-loading-ui-20261125/`, especially
`fe-related-complete.json`, `fe-full.json`, `fe-recheck.json`, `tsc-complete.log`,
`build-final.log`, `loading-desktop.png`, `loading-mobile.png`, Docker logs and impact reports.

## Limits

The workspace contains changes from other work. Whole-workspace GitNexus/diff
results include them; this record describes only the feature files listed above.
Browser save/audit across multiple live accounts was not executed: server save/
transaction behavior and frontend invalidation were tested separately, and the
saved runtime defaults were checked read-only. This is not QA release approval.

Follow-up: the video-preview test failure recorded above is resolved by test-only
endpoint-aware mocks and cleanup. See `VIDEO_PREVIEW_TEST_2026_11_25_CHANGE_RECORD.md`
for the cause and passing regression evidence; no video business logic changed.

## Follow-up: preview animation and sizing repair (2026-11-25)

- Source-confirmed causes: the shared adapter passed a replacement `style` that
  overwrote six vendor root animations, and a `block` class that replaced the
  flex layout required by dot/bar styles. Dots Ring's Tailwind 4 container utility
  also needed a native CSS equivalent in this Tailwind 3 application.
- Change: preserve vendor animation/display props, give only the adapted Arc and
  Dual Arc span roots an inline box, and scope `container-type: size` to Dots Ring.
  The fix applies to preview and saved shared indicators through the same adapter.
- Invariants: no change to loading conditions, disabled actions, actor/permission
  or object scope, lifecycle, artefacts, server persistence, audit, signatures or
  async processing. Reduced-motion static fallback remains intact. Existing owner
  approval for shared Loading/Branding integration applies to this visual repair.
- GitNexus upstream impact: LoadingVisual has 2 direct callers, 22 affected flows,
  CRITICAL indirect scope through shared Loading/Button; warning reported before
  editing. Whole-workspace compare to main reports unrelated changes as well
  (292 files, 873 symbols, 80 processes); no commit was made.
- Test-confirmed: 15 new regression cases fail before the adapter fix and pass
  afterwards. All 54 tests in the focused loading/Branding/draft/video set pass.
  TypeScript and production build pass.
- Runtime-confirmed on the updated frontend container: all 22 Loading UI choices
  retain 56px root dimensions and their CSS/Motion/SMIL animation mechanism.
  Dots/bar families have nonzero shape sizes; Dots Ring dots are 11.2px rather
  than viewport-sized. At 390px the page scroll width is 390px and preview fits.
  Test draft was discarded and viewport reset; no global configuration was saved.
- Evidence: `%TEMP%/eqms-loading-ui-20261125/animation-before.log`,
  `animation-after.log`, `preview-tsc.log`, `preview-build.log`,
  `preview-detect-changes.log`, `preview-browser-checks.json`, `preview-fixed.png`.
