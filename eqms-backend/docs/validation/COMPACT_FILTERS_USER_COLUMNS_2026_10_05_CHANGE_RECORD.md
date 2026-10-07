# Compact desktop filters and User Management identity columns

## Request and scope

Owner request, 2026-10-05: honor Use compact desktop filters on the named audit,
security, dictionary, education, email, notification and document-administration
screens; pin No., Employee ID and Full Name on desktop User Management only.
Document Types/Sub-Types/Name Formats and Lifecycle Policies delegate their
filters to child tabs; changes are at those filter owners. Notifications already
uses DesktopSelectFilters and was retained without source changes.

## Invariants

- Presentation-only. Actor, authorization/object scope, lifecycle, parent/child
  effects, file versions/checksums, audit/e-signature and asynchronous generation
  are unchanged. No backend, API contract or database changes.
- Existing handlers/queries are preserved. Only Apply commits compact filter
  drafts; Cancel and closing discard them. Clear all is also draft-only.
- Saved branding controls the layout. Classic children and mobile FilterDrawer
  remain in place. Action Matrix retains its original mobile filters.
- User Management pins only the three locked identity fields at >=1280 CSS px.
  Action retains shared styles; tablet/mobile identity cells remain non-sticky.
- Department options reflect the draft Business Unit; current table scope does
  not change while looking up draft options.

## Source and impact evidence

ConfiguredDesktopFilters composes DesktopFilterPanel, FilterOptionList and inline
DateRangePicker. Explicit field descriptors preserve existing screen callbacks,
including atomic date-range commits and audit includeTime. No JSX inspection at
runtime. usePinnedUserColumns measures header widths and tracks resizing/mounting;
the scroll area supports keyboard navigation as well as existing drag scrolling.

GitNexus upstream impacts for edited existing screen owners: LOW, 0-1 direct
callers (up to 2 total impacted dictionary symbols), no affected execution flows
reported. ActionStatusMatrix: LOW, 1 direct caller. DesktopSelectFilters: HIGH,
4 direct callers/3 affected processes; it was deliberately NOT edited.
New adapter/hook/tests are not present in the existing index.

## Test evidence

2026-10-05:
- `npx vitest run src/components/ui/filter/__tests__ src/features/security-authorization/user-management/profile/hooks/__tests__/usePinnedUserColumns.test.tsx`
  — 6 files, 54 tests passed. Includes draft Apply/Cancel/Clear, dependent options,
  atomic date/time commits, delayed table mounting, CSS breakpoint scope, and
  structural coverage for all requested filter-owning screens.
- `npx vite build` — passed; existing large-chunk warning remains.
- `npx tsc --noEmit` — blocked by two pre-existing ReportLists.test.tsx errors
  at lines 165/167 (`exact` is not a Testing Library ByRoleOptions field).
  No new diagnostics from this change were reported.
- Chrome runtime: User Management selecting Suspended leaves URL and 5174-result
  table unchanged before Apply; Apply produces `?status=Suspended` and server
  results. Clear all/Apply restores the original scope.
- Chrome runtime: draft Quality Unit lists only its department options. Inline
  calendar renders all October days and presets in the shared compact panel.
- Chrome runtime: horizontal scroll from 40px to 440px keeps the three identity
  cell x-coordinates unchanged; other columns move. At 1024x768 and 375x812 the
  three cells are static, and document width does not overflow the viewport.
- Screenshots: `target/compact-user-filters-desktop.png` and
  `target/user-pinned-columns-desktop.png`.
- Frontend Docker rebuilt/recreated; backend and database untouched.

## Limitations

Runtime checks cover User Management and representative shared behavior, not
every filter on all screens. Structural coverage is not end-to-end verification.
No GMP-compliance certification is claimed. Referenced repository change-record
template/evidence-conventions files were absent at the time of this cosmetic
change; this record captures the request, invariants, implementation and evidence.
Unrelated pre-existing working-tree changes were preserved; no commit/push made.

## Follow-up: chevron pinning and compact toolbar spacing (2026-10-05)

Approved request: include the expand/chevron column in the frozen identity block,
add a visible right divider after Full Name, and match Documents/Revision List
toolbar-to-table spacing on all compact-filter table screens.

Invariants: cosmetic-only; no change to actors, permission/object scope, lifecycle,
parent/child effects, artefact versions/checksums, signatures, audit, async jobs,
API query parameters or database. Desktop pinning remains >=1280px; tablet/mobile
remain unpinned. Classic/mobile filters keep their previous spacing.

Source evidence:
- `usePinnedUserColumns` includes expand/no/employeeCode/fullName in measured offsets.
- Header and body chevron cells use the same column marker; Full Name has an inset
  1px right divider without changing measured width.
- Shared CSS utilities remove only extra padding/margins/gaps from 20 identified
  compact-filter screen/layout owners. DesktopFilterPanel retains its existing
  16px bottom padding. Reference screens and already-correct screens are unchanged.
- GitNexus upstream analysis for every edited screen owner: LOW, 0-1 direct
  callers, no reported execution flows. The new hook is still unindexed (UNKNOWN);
  manual source tracing confirms UserManagementView is its sole production caller.
- No shared filter function, authorization function or backend source was edited.

Test/runtime evidence:
- Filter/pinning suite: 7 files, 57 tests passed, including classic-selector negative
  cases, spaced-stack banner preservation, chevron offsets and divider scope.
- Vite production build passed (existing large-chunk warning).
- TypeScript still reports only the two pre-existing ReportLists.test.tsx 165/167
  Testing Library `exact` option errors; not repaired as unrelated changes.
- Chrome: All Documents, Audit Trail, User Management and Business Units each
  measure 16.8px from Filter button bottom to thead top (16px spacing plus the
  table border at current browser zoom). Business Units stack row-gap is 0px.
- Chrome: scrolling User Management by 400px keeps expand/no/employeeCode/fullName
  positions fixed; username moves. Chevron remains clickable and expands/collapses.
- Chrome 1024x768 and 375x812: all four columns static; document width equals viewport;
  compact toolbar hidden on mobile. No settings or business records were written.
- Screenshot: `target/user-pinned-chevron-spacing-desktop.png`.
- Frontend Docker rebuilt/recreated; backend/database untouched; no commit/push.

Limitations: browser checks cover representative layouts rather than every screen.
The skill's standalone Playwright probe was not used because browser control is
restricted to the supplied CUA interface; actual DOM measurements/screenshots and
responsive viewport checks were performed through that interface instead.
