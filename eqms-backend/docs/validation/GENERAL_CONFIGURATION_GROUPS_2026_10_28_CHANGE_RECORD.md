# General configuration grouping — 2026-10-28

Status: rolled back at the user's request. General again displays all original sections in one continuous page, with dashboard defaults beneath it and the original header actions. The group navigation, collapsible backgrounds, embedded editor variant and mobile action bar were removed. The earlier Configuration navigation-loading optimization is retained.

Approved UI: six groups (Branding, Interface, Page Backgrounds, Dashboard Defaults, Localization, System), desktop navigation at 1280px and above, a compact group selector below that width, and a bottom save bar below 768px.

Invariants: configuration remains owned by ConfigurationView; group selection does not save, discard or modify settings. Existing permissions, confirmation, change detection, request payload and server-side audit remain unchanged. Dashboard defaults retain their existing independent save action and authorized-parent visibility. The dashboard editor mounts on first visit and remains mounted while hidden so its local draft is retained.

Implementation: GeneralTab reuses Button, Select, Checkbox, FormSection, CollapsibleFormSection, ColorPickerInput and the existing background editor. Background editors are no longer mixed with interface controls; the embedded variant omits duplicate title/border within the collapsible section. Mobile actions use the existing configuration handlers through a portal, include safe-area bottom padding and reserve content space. The group selector and desktop navigation are sticky.

GitNexus: GeneralTab LOW, one direct caller and no indexed affected execution flows; ConfigurationView LOW with no indexed affected flows. PageBackgroundEditor is not indexed (UNKNOWN); its direct callers were inspected.

Evidence: 23 focused tests passed across six test files, including config persistence across groups, compact-selector navigation, deferred background-editor mounting, retained dashboard draft, and mobile Save requiring the existing confirmation and submitting only the changed section. TypeScript and production build passed. The final frontend image was built and only frontend recreated. An authenticated Chrome QA tab was inspected at 390x844, 820x1180 and 1440x1000; the group-selector/navigation and save-bar transitions were visible, with no document horizontal overflow measured at 390px and 1440px. Temporary viewport overrides were reset and the QA tab closed.

Limitations: browser viewport checks are not an installed-device PWA, virtual-keyboard or operating-system safe-area certification. No live configuration values were saved during visual inspection. No backend or database change was required for this UI.
