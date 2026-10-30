# Alternating record backgrounds — 2026-10-27

## Authorization and invariants

The user requested a system-wide opt-in appearance setting and explicitly approved work on the shared high-impact components. The setting affects presentation only; actor permissions/object scope, record data, lifecycle and parent-child transitions, artifact versions, audit/e-signatures and async generation do not change. The existing configuration save, authorization, audit, public-branding cache eviction and update notifications remain in place. Both fields are optional in stored general appearance JSON; no migration is required. The server rejects non-boolean switches and non-hex colors, and public branding sanitizes legacy invalid colors to #F8FAFC. Existing appearance fields are preserved by the General tab.

## Implementation and impact

General > User Interface > Record Lists has an opt-in switch and ColorPickerInput. Default off; enabled color defaults to #F8FAFC. Public branding distributes settings and the root uses a validated CSS custom property. DataTable annotates only actual record rows so expanded rows do not change parity; pinned and action cells follow the row. CSS excludes rows with explicit background classes, selection states and spanning detail/group rows. The shared CSS covers ordinary HTML table rows, divided record lists and explicitly marked record lists; custom layouts with their own backgrounds or nonstandard markup require individual review and may not display stripes. The user-requested universal coverage is therefore not yet verified.

GitNexus: DataTable CRITICAL (107 direct callers, 18 processes); DataTableBase CRITICAL (2 direct callers, 17 processes); getPublicBranding CRITICAL (5 direct callers, 58 processes, partial index); useStickyPinnedColumns CRITICAL (2 direct callers, 16 processes), inspected but not modified; GeneralTab LOW (1 direct caller); SystemConfigurationService.updateConfiguration LOW (2 direct callers); handleAppearanceChange LOW (1 direct caller). User explicitly authorized proceeding after these risks were reported.

## Verification and limitations

Frontend TypeScript passed. Five targeted frontend suites passed 18 tests including setting preservation, picker, pinned-column table regression, expanded-row parity and drag scrolling. Three backend suites passed 15 tests including existing branding, desktop-filter settings and invalid new values. Chrome headless evaluated a standalone CSS fixture: enabled/default rows, custom color, pinned/action cells, preserved explicit red status, selected and spanning detail rows, generic-table record parity, list rows and disabled state behaved as expected. This is not a signed-in application test, a complete visual survey or released-system validation; the running backend and frontend were not updated. No claim of GMP compliance is made. The AGENTS-referenced 08_ONE_CHANGE_RECORD_TEMPLATE.md and docs/system evidence conventions are absent; this follows the existing local change-record format.

Rollback: revert the appearance fields, branding response/validation and UI components/styles. Stored JSON fields may remain ignored by the old application; no database migration or record conversion is needed.

Additional build verification: `npm run build` completed successfully, with the existing Vite large-chunk warning. The project's postbuild script regenerated `eqms/dist.zip` from the new build output.

## Hover follow-up

Removed the hover exclusion from alternating record CSS, keeping the configured background on striped rows and their pinned/action cells while hovered. Explicit status and selection exclusions remain. Three focused frontend suites passed (7 tests). A Chrome headless fixture simulated hover CSS and confirmed the row, pinned/action cells and record list retain the selected background. This is not a signed-in application visual test.
