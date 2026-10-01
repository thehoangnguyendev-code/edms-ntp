# Shared non-filter Drawer UI change — 2026-10-01

## Approved scope

User requested a shared component based on the existing Training drawer and adoption
by every non-filter drawer, including the Calendar drawer. FilterDrawer is excluded.
This is a UI-shell refactor, not a regulated business-rule decision or a compliance claim.
The prescribed validation template and system/governance directories are absent in
this checkout; this scoped record captures source/test evidence without inventing rules.

## Invariants

- Actor, authorization and object scope: existing per-user Calendar API and selected
  permission-set API calls are unchanged; the Drawer neither fetches nor authorizes data.
- Lifecycle and parent-child effects: no status transition, assignment, deadline,
  completion policy or parent/child mutation is introduced.
- Artefacts/version/checksum: no file, published PDF, stored version or checksum changes.
- Audit/e-signature: no audit or signature API/meaning/persistence changes.
- Async generation: no worker/job/notification projection changes.
- UI callbacks: existing navigation/expansion handlers are retained; user close callbacks
  execute once after animation. Calendar retains its exit-before-opening-personal-modal contract.

## Source changes

`eqms/src/components/ui/drawer/Drawer.tsx`, its CSS module and barrel expose one
Training-style shell: floating rounded desktop panel, mobile bottom sheet, common
header/body/footer slots, portal, reduced-motion animation, keyboard focus management,
scroll restoration, and mobile pointer/keyboard resize. The UI barrel exports it.

Migrated consumers:

1. `features/calendar/CalendarDayDrawer.tsx`
2. `features/training/materials/components/VersionHistoryDrawer.tsx`
3. `features/training/records-archive/components/LearningHistoryDrawer.tsx`
4. `features/training/compliance-tracking/components/matrix/CellDetailDrawer.tsx`
5. `features/training/compliance-tracking/components/matrix/HeaderActionDrawer.tsx`
6. `features/security-authorization/access-profiles/views/tabs/AccessProfilePermissionSetDrawer.tsx`
7. `WorkflowRoleDrawer` in `accessProfileDetailShared.tsx`

Removed duplicate portals, close timers, body locks, mobile drag hooks and injected
animation styles, plus the unreferenced Training `DRAWER_STYLES` export. Training
timeline marker styling is scoped to the shared body. Filter sources are not edited.
No BE/API/DB changes are needed for this UI-only scope.

## Impact and verification

- Exact upstream GitNexus impacts for the shell, consumers and removed local handlers:
  LOW. Direct parent callers are CalendarView, MaterialsView, EmployeeTrainingFilesView,
  TrainingMatrixView, AccessProfileDetailView and WorkflowTab. Materials and Access Profile
  have existing indexed authentication/realtime flows; these handlers are unchanged.
- Index repaired/rebuilt before impact checks after an interrupted incremental FTS update.
- `detect_changes --scope unstaged` was run: the pre-existing dirty worktree also contains
  unrelated BE/auth/document changes, so aggregate risk is CRITICAL and must not be
  interpreted as this UI refactor's blast radius. No commit, push or deploy was performed.
- Focused Drawer + consumer + Calendar tests: 29 passing. Includes closed-state scroll
  behavior, stacked drawers, Escape/backdrop/ref closing, focus trap/restore, external
  exit/reopen, mobile keyboard resize, existing Training expansion/navigation, permission
  set API ID, and inactive workflow-policy exclusion.
- Full FE regression suite: 34 files / 209 tests passing. Existing jsdom scrollTo notices
  are non-failing test-environment limitations.
- TypeScript check and Vite production build passed. Existing large-chunk warnings remain.
- Actual-component browser harness uses fixtures exclusively under OS Temp, never in
  production source. Checked 375/768/1280/1440px, no page/panel horizontal overflow or
  page errors across 32 consumer/width cases; inspected Calendar and Training screenshots. Mobile pointer dismissal,
  keyboard resizing, Escape, focus restoration and scroll unlocking were exercised.
- Skill probe: fixed focus-induced background scroll and Calendar action text contrast.
  Remaining P1–P5 are hover findings for background Calendar controls behind the modal
  backdrop, outside this drawer change; not silently treated as passing. Existing shared
  Button focus treatment, border palette and Training-style scrollbar are retained to
  match the requested project reference. Missing favicon is a temporary harness asset.

## Handoff limitations

No authenticated production-data browser session or Docker deployment was performed.
User should visually confirm Calendar, Training history/matrix and Access Profile drawers
in their running environment. Evidence above is source/test/isolated-browser confirmed,
not a claim of production validation or GMP compliance.
