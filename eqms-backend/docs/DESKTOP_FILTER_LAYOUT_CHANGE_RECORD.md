# Compact desktop filters — change record (rollout in progress)

## Approved request
2026-10-01: administrator-selectable expanded versus compact desktop filters. Compact has Search + Filter, field labels on the left and controls on the right. User explicitly chose Apply before filtering. Mobile remains unchanged.

## Invariants
- Presentation-only setting `general.appearance.compactDesktopFilters`, default false. Admin Save, authorization, configuration audit and after-commit global branding SSE are reused, not bypassed.
- List draft edits/Clear all do not call list setters, update URL or request filtered results before Apply. Cancel, close and Escape discard drafts. Browser Back/Forward invalidates open stale drafts.
- Search retains each existing screen's debounce behavior independently of filter Apply.
- Document filters commit all changed query keys in one replace navigation, resetting page while preserving unrelated URL/sort/limit parameters. State-owned lists batch their existing setters on Apply.
- Context-locked status/author controls stay locked. No modification of object permissions, lifecycle, parent-child transitions, stored artefacts/checksum, e-signatures or record audit workflows.
- Missing configuration keeps expanded view. New flag is exposed through existing safe branding API; connected users re-read after `branding-updated` commits.

## Source/impact evidence
GitNexus upstream impact completed before editing: DocumentFilters LOW / 4 direct / 1 process; DocumentsView LOW / 0 direct; useDocumentServerTable LOW / 1 direct / 1 process; GeneralTab LOW / 1 direct; handleChange LOW / 2 direct; handleAppearanceChange LOW / 1 direct; getPublicBranding LOW / 4 direct / 1 process; updateConfiguration LOW / 2 direct; ControlledCopiesView, UncontrolledCopiesView, PublishingTemplatesView, NotificationsView and PermissionSetsView LOW / 0 direct.

Source confirms existing `publishBrandingInvalidationAfterCommit` emits only after General configuration and its audit commit. The existing useBranding hook refreshes from SSE and shared polling. No new stream/endpoint or authorization shortcut.

Repository evidence conventions, governance decision log and one-change-record template referenced by skill instructions are absent. This focused record captures request and evidence; it is not a GMP-compliance claim.

## Implemented rollout
- Shared DesktopFilterPanel: independent draft, two-column panel, Clear all/Cancel/Apply, accessible field buttons and Escape/focus restore. Controls stay mounted while switching field labels to preserve async option labels.
- Select/date adapters for state-owned lists; URLs remain owned by existing list hooks.
- DocumentFilters: All/Owned Documents, All/Owned Revisions, Pending Review/Approval via its four callers.
- Controlled Copies (All/Ready/Distributed), Uncontrolled Copies (all contextual list routes).
- Publishing Templates, Notifications, Permission Sets.
- GeneralTab toggle, FE/API branding types, BE response and boolean validation. V514 adds false to missing existing configuration without overwriting other appearance keys.

## Test evidence
- Full FE suite: 153 tests / 23 files passed. Includes 4 shell draft/cancel/stale-state tests and 2 DocumentFilters integration tests (atomic Apply and locked fields).
- BE configuration suite: 8 passed (DesktopFilterConfigurationTest 1; SystemConfigurationServiceBrandingTest 7). Includes missing/false/true branding values and rejection of nonboolean input.
- TypeScript noEmit passed; git diff --check passed (line-ending warnings only).
- No actual browser visual QA, multi-user SSE runtime test, Docker rebuild or DB migration execution. Before release verify both desktop layouts, Cancel/Apply/clear, field switching with async lookups, reload/Back/Forward, mobile invariance and another user's live setting update.

## Remaining scope
Not a finished all-screen migration. A source scan still finds 33 other `hidden md:grid` filter containers without the setting (Audit Trail, other Security & Authorization, Settings, Training and detail tabs). Additional FilterDrawer callers use different desktop containers and need inventory too. These retain the old UI intentionally until explicit typed draft bindings and tests are added; enabling the flag does not convert them yet.

No commit, push or deployment was requested/performed. Unrelated dirty-worktree changes are preserved.

## Portal / direct-list correction — 2026-10-01

User requested portal dropdown matching the reference, direct options instead of nested
Select triggers, and Clear all / Cancel / Apply at the bottom of the right column.
After GitNexus reported CRITICAL, the user explicitly approved shared rollout with "làm đi".
Impact: DesktopFilterPanel 3 direct callers / 6 affected processes (CRITICAL);
DesktopSelectFilters 3 direct / 3 processes (HIGH); CopyDesktopFilters 2 direct / 2 processes
(LOW); DocumentFilters 4 direct / 1 process and addSelect 1 direct (LOW).

Implemented fixed-position body portal anchored to Filter, viewport clamping, resize/scroll
repositioning, outside-click cancellation, Escape/focus restore, independent column scrolling,
and right-column footer. Nested calendar portal events are recognized via React capture so
choosing dates does not dismiss the filter. Inactive calendars unmount while draft dates remain.
FilterOptionList shows direct single-value choices, local search or debounced existing server
lookup with loading/error/retry and stale-response protection. Hidden option lists remain mounted;
server lookups run only when their field is active. No new multi-select semantics are introduced.

Invariants unchanged: only outer Apply commits filters; Cancel/outside click discards; fixed
status/owner scope survives clearing; no authorization/API/DB/lifecycle/audit/e-signature changes.
Classic desktop layout and mobile drawer are untouched. This affects only already-integrated
compact filter callers; it does not complete the remaining all-screen rollout above.

Verification: full FE suite 165 tests / 26 files passed; TypeScript noEmit passed;
git diff --check passed. Includes 16 focused tests for portal placement in body, right-column
footer ownership, outside dismissal, nested portal containment, direct choices, locked filters,
async error/retry and stale results, atomic Apply, and actual DateRangePicker selections.
GitNexus detect-changes across the already-dirty workspace reports CRITICAL (48 files,
89 symbols, 69 processes), including unrelated existing backend/document changes; no commit.
Production Vite build passed (existing large-chunk warnings only).
No browser visual QA or Docker rebuild yet.

## Inline date filters — 2026-10-01

User explicitly approved the opt-in inline calendar after the shared DateRangePicker
impact warning (CRITICAL: 43 direct callers / 23 processes). renderTimePicker has
one direct caller / 23 processes at CRITICAL. CopyDesktopFilters is LOW (2 direct /
2 processes), DesktopSelectFilters HIGH (3 direct / 3 processes), and DocumentFilters
LOW (4 direct / 1 process).

DateRangePicker now supports inline rendering, sharing the same calendar, month/year
selection, time inputs and presets with its default dropdown. Compact filter adapters
embed it directly in the right column. Inline selections/reset/time edits update only
the parent draft; there is no inner Apply/Cancel. The outer Apply remains the only
filter commit. Date drafts survive switching categories. Existing includeTime flags
and date serialization are preserved; default dropdown and mobile/classic callers
remain unchanged. No actor/permission/object-scope, lifecycle, parent-child, artefact,
audit/e-signature or asynchronous-generation behavior changes; no BE/API/DB change.

Source evidence: DateRangePicker.tsx, CopyDesktopFilters.tsx, DesktopSelectFilters.tsx,
DocumentFilters.tsx. Test evidence: DateRangePicker.inline.test.tsx (direct rendering,
presets/reset, manual dates, time format, disabled state and default dropdown regression);
DesktopFilterAdapters.test.tsx (draft persistence and outer-Apply-only behavior).

Full FE suite passed: 173 tests / 27 files. TypeScript noEmit and production Vite
build passed (existing large-chunk warnings).
Git diff --check passed (line-ending warnings only). GitNexus detect-changes reports
49 files / 96 symbols / 69 processes at CRITICAL across the entire dirty workspace,
including unrelated pre-existing backend changes; this is not the scoped feature count.
No browser visual QA, Docker rebuild, deployment or commit performed.

## Compact calendar / right-hand presets — 2026-10-01

User requested a smaller inline calendar with quick ranges in a vertical right-hand
column. Cosmetic-only change: inline day cells are 24px, navigation and paddings
are compact, presets use a fixed 100px sidebar and one-column list, and Reset stays
under the calendar. No filter/date/permission/API/DB semantics change. Default
dropdown sizing remains unchanged. Upstream impact remains CRITICAL for the shared
picker (43 direct / 23 processes); calendar/presets each have 1 direct caller and
23 processes. The user was warned; implementation stays within the approved inline scope.

Focused verification: 24 tests / 5 files passed, including assertions for horizontal
inline layout, one-column sidebar, compact day cells, draft/Apply behavior and the
default dropdown regression. Actual browser fit/visual QA and Docker rebuild remain
not performed.

## Advanced search icon — 2026-10-01

Cosmetic-only request: add the standard 16px slate search icon beside the Filter
button across all existing compact-filter callers. DesktopFilterPanel provides a
decorative, pointer-events-none icon and 36px input left padding. Hidden searches
do not render an icon. Search callbacks, draft/Apply, classic/mobile UI and BE/API/DB
are unchanged. Upstream impact: CRITICAL, 3 direct callers / 6 processes; user warned.
Focused suite: 21 tests / 4 files passed, including decorative icon, padding,
unchanged search callback and absent icon when search is hidden.
