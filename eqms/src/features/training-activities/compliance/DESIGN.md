# Training Compliance: M1 / G1

Owner selection: M1 for Matrix Completion and G1 for Gap List, 28 November 2026.
Reference: the approved eight-option preview under `%TEMP%/evon-design/training-compliance-20261127`.

## Layout contract

- Retain the application's Inter typography, slate/emerald palette and existing
  Select, TabNav, FilterSearchInput, ClearFiltersButton and Custom Column controls.
- M1: Department, Work Position and view switch share the top row on wide screens.
  Search and conditional person filters follow. Keep the person-mode legend.
- G1: compact inline totals, a Department/Search/Status/Employees grid, then training
  chips with Clear Filters and Custom Column. Employee definitions are expandable.
- Mobile uses one column and larger touch targets. Tablet uses two-column filters;
  the Matrix row table scrolls horizontally rather than clipping its last columns.
- ComplianceFilterFields owns presentation only. Existing tab handlers remain owners
  of values, API queries, page resets and clearing behavior. Its search has no added
  debounce, preserving the classic toolbar's immediate change callback and the
  existing server-table debounce. No additional search timer is introduced.

## Preserved invariants

Both tabs' pre-render business logic is byte-equivalent to HEAD (excluding the
presentation-only GapStat). No service, permission, status, lifecycle, signature,
audit, file or backend changes are included. Training selection, conditional person
filters, server query parameters, paging, print registration and permission checks
retain their existing behavior. Clear Filters retains the current Department,
Work Position and selected training, as before.

## Evidence

- GitNexus upstream impact: both tabs LOW, one direct caller each; GapStat and
  CompletionByRow LOW, one direct caller each; no affected execution processes.
- 11 compliance tests passed, including four new integration tests covering mode
  filters, server query parameters, clear behavior and denied/allowed selection.
- TypeScript and production Vite build passed. Build retains existing bundle warnings.
- Responsive browser checks used the actual React components with synthetic API
  fixtures, outside the production routes, at 375, 768 and 1280 px. This does not
  assert live authenticated backend acceptance. Existing table scroll areas are
  still flagged by the style probe for lacking a faded edge cue; no page overflow
  or clipped Matrix table remains. Shared table behavior is outside this UI change.
- Evidence: `%TEMP%/eqms-compliance-layout-*` and
  `%TEMP%/evon-design/compliance-implementation/{matrix,gap}`.

No Docker update, commit or push is included in this change.
