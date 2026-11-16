# Configuration compact workspace — 2026-11-16

**Status: rolled back at the user's explicit request.** Configuration again uses its pre-redesign PageHeader actions, horizontal TabNav and continuous original FormSections on desktop, tablet and mobile. The workspace/context, section menu/catalog, mobile category navigation/icons/frame, custom layout stylesheet and redesign-specific tests were removed. This document retains historical evidence only; the design below is no longer the implemented UI. Pre-existing AuditTabViewSection, Save labels, storage changes and unrelated work were preserved. A local backup of the redesigned source was retained before rollback. No backend/database or saved configuration value was reverted.

Rollback checks: 16 Configuration test files / 75 tests passed; production build passed (existing chunk-size advisory only). No workspace/catalog imports remain. Frontend image rebuilt and only frontend recreated. Baseline Save-label/Audit Trail/storage changes remain in the working tree.

## Request and approved scope

The user selected compact concept 01 for desktop/tablet. The later mobile instruction authorizes vertical main categories, a corresponding function list, and a mobile-only Back button beside the page-header Save actions. This replaces the earlier instruction to defer mobile. This record concerns presentation/navigation only; it does not approve a new business or compliance rule.

The referenced `08_ONE_CHANGE_RECORD_TEMPLATE.md` and `docs/system/` evidence directory are absent in the current checkout. This record follows the existing Configuration change-record structure and cites the inspected source/tests directly.

## Invariants

- Actor/permission/object scope: keep `settings.configuration.manage` and existing administrator-only panels/actions. Search never includes configuration values or secrets.
- Lifecycle/parent-child/artifact checksum/async generation: no business lifecycle, stored artifact, e-signature, worker or generation changes.
- Save/audit: retain ConfigurationView's original change detection, payload construction, confirmation, system configuration request, network policy sequencing and retry/reset behavior. The backend continues to own its audit. Navigation never saves.
- Independently saved panels: DashboardRoleDefaults and StorageUsagePanel retain their own existing requests/actions; do not silently merge them into System Configuration Save.
- Drafts: section navigation and mobile Back hide rather than unmount editors. Layout changes across 768px preserve mounted child state. Existing top-level tab/page-reload persistence semantics are not expanded.

## Source and implementation

- `eqms/src/features/settings/configuration/ConfigurationView.tsx`: existing state/save handlers; responsive navigation integration and action placement.
- `ConfigurationWorkspace.tsx`: local context, responsive groups, retained editors, mobile category/function lists, local debounced section search.
- `configurationSections.ts`: stable presentation IDs/catalog; administrator-only navigation follows existing panel gates.
- `configuration-workspace.css`: flat desktop/tablet form, container-aware field alignment, local mobile list styles. Shared UI components are unchanged.
- Tab files replace only their FormSection import with the local presentation adapter. GeneralTab additionally wraps its interface groups and Audit Trail editor. Existing field values and handlers remain intact.
- `DESIGN.md`: approved layout and scope.

## Impact analysis

GitNexus upstream checks: ConfigurationView and the inspected tab/panel functions LOW; zero indexed direct callers/processes for most React component implementations. ImageWatermarkCard has one indexed direct caller (ImageWatermarkTab), LOW, no affected indexed execution process. React lazy route callers were also inspected in source because the index does not represent all JSX/lazy relationships. AuditTabViewSection is unindexed/new in this checkout; its implementation was not edited and is grouped through the parent only. No shared FormSection, Select, Checkbox, Radio or authorization symbol was modified.

## Verification

- Existing network-save regression suite covers unchanged payloads, normalized CIDR lines, draft/reset, rejected network retries after system-save success, and no network save when system-save fails. Its navigation steps now use the approved mobile path.
- New workspace tests cover retained drafts, per-tab section selection, administrator-only navigation, debounced cross-category search, responsive child-state retention, and section ID uniqueness.
- New ConfigurationView mobile tests cover category → function → editor, Back alongside Save, no Back on desktop/tablet, read-only Back without Save, retained drafts, and confirmation before any save request.
- Browser-confirmed: authenticated application at 1440×1000, 834×1180 and 390×844. No document horizontal overflow at those widths. Desktop/tablet have no Back; mobile Back returns editor → function list → categories. Configuration and network editors remain reachable. No live configuration values were changed or saved.
- Browser viewport override reset after inspection. Screenshots: `desktop-implemented.jpg` and `mobile-implemented.jpg` in the local `evon-design/configuration-20261116` artifact folder.
- Frontend-only Docker image rebuilt/recreated; backend/database not restarted or changed.

Final automated checks: 18 Configuration test files, 86 tests passed; after the final sidebar-return navigation adjustment, the four Configuration navigation/workspace suites were rerun (17 tests passed). `npx tsc --noEmit --pretty false` passed. `npm run build` passed (existing large-chunk warning remains); `git diff --check` for the scoped files passed. Vitest emits the known jsdom canvas warning for chart components; no test failed. Frontend image `eqms-frontend:local` was rebuilt and only the frontend service recreated with `--no-deps`.

## Limits

Responsive browser checks do not certify installed-device PWA/virtual-keyboard behavior. Backend policies/audit are preserved by keeping the original handlers and regression contracts; this task did not execute a live settings update merely for visual QA. Existing unrelated working-tree changes were retained.

## User-requested UI alignment revision — 2026-11-16

This revision supersedes the earlier search/action-placement/mobile-navigation design above. The user supplied DetailDocumentView and Configuration screenshots and requested four specific presentation changes:

- Remove search and bottom actions. Restore Reset/Save in PageHeader on desktop/tablet as well as mobile; PageHeader is outside all card surfaces.
- Match the shared DetailDocumentView tab frame/content padding and TabNav; keep the section menu inside the tab content. Change displayed section labels to Title Case without changing IDs, values or API codes.
- On mobile open every original FormSection of a category directly from the category list. Back returns directly to categories. Remove the outer workspace/fieldset card and redundant inner preview option cards. Stored previews and functional preview canvas boundaries are preserved.
- Remove local CSS font-size overrides (11/13/17px etc.); use shared component typography and standard Tailwind text sizes.

Source changes are confined to the Configuration presentation wrapper, section labels, view markup and tests. The existing save/reset/confirmation/network sequencing and independently saved panels are unchanged. GitNexus upstream ConfigurationView remains LOW with no indexed affected processes; the local workspace/presenter symbols are not yet indexed, so their local callers were inspected directly.

Tests updated for direct mobile category navigation, full FormSection visibility, header actions on desktop/tablet, no search, retained drafts and original network-save negative cases. All 18 Configuration test files pass (86 tests); TypeScript passes. Browser inspection confirms Title Case labels and 14px standard navigation/header typography on tablet, outside-card PageHeader, no bottom save bar, and direct General/Preview File navigation on mobile. No real configuration update was submitted.

Revision release checks: production build passed (existing chunk-size advisory only), scoped `git diff --check` passed, frontend image rebuilt and only frontend recreated. Authenticated browser checks used 1440px desktop, 834px tablet and 375px mobile, with no document horizontal overflow. The mobile Preview File page contains both OnlyOffice Preview and PDF Preview immediately after selecting the category; decorative inner option frames have zero border, while the functional watermark sample canvas keeps its dashed boundary. Viewport override was reset. Current desktop evidence: `desktop-system-aligned.jpg` in the local artifact folder.
