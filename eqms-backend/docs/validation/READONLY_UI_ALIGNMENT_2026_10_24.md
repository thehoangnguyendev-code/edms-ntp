# Readonly field visual alignment — 2026-10-24

Owner request: use the exact readonly appearance of Document Details General Information across input/select/textarea/date controls. Owner approved the HIGH/CRITICAL shared-component impact, explicitly limiting the change to UI (cursor, border, focus, background).

## Invariants

- Do not modify any readOnly/disabled expression, validation, handler, API value, authorization, lifecycle, audit, signature, artifact or async behavior. Native disabled controls remain disabled and non-focusable. Enabled readonly inputs remain focusable/copyable but cannot be typed into.
- Reuse CONTROL_STATE_CLASSES.readonlyField/readonlyTextarea/readonlyContainer. Editable and ordinary disabled input states retain their existing behavior and validation colors. Preserve layout except for correcting textarea wrappers that imposed a single-line input height.
- Keep hidden credential-manager fields (sr-only) hidden and do not restyle read-only document editors or permission explorers as input boxes.

## Scope and impact

- Source audit found 142 readOnly JSX attributes, including props on non-input components. Most visible fields already use the shared tokens (some through aliases). Remaining hardcoded styles and read-only focus suppression are aligned, not replaced with new controls.
- GitNexus: Select CRITICAL (134 direct callers, 25 processes), DateTimePicker CRITICAL (19 direct, 5 processes), DateRangePicker CRITICAL (42 direct, 17 processes), ResponsiveForm Input/Textarea CRITICAL (32/37 direct, 4 processes each). Owner approved changes to shared controls with UI-only scope. Other indexed feature components LOW. Some reorganized Training helpers are not in the index; review the source diff separately.
- Shared Input/textarea previously used read-only:border-slate-200, which competes with the focus border, and disabled:cursor-not-allowed even when readOnly is also set. Use the reference token based on the existing prop, without touching the prop itself.

## Verification

- TypeScript: npx tsc --noEmit --pretty false passed.
- New readonly-control suite: 8 tests passed (readonly typing prevention/focus, native disabled preservation, editable change handler, validation styling, textarea rows, compact token equality, disabled selects/pickers remaining inert). Existing Select tests also passed (11 total in the first targeted run).
- AST source audit: 128 native readOnly input/textarea controls across the FE; all visible controls use the shared tokens directly or through local aliases/conditional classes. The only hidden credential-manager field is excluded deliberately.
- JSX-attribute comparison to HEAD for 18 changed TSX source files: no change outside className/style. All disabled/readOnly values, event handlers and validation props are identical.
- First full FE run: 925/926 passed, one Media Register test failed to find a header under concurrent load. The failing file passed on isolated rerun (31/31 including the readonly suite). Full rerun with maxWorkers=4: 926/926 passed across 166 files. Reports are local target/readonly-*.json, not committed.
- Live DEV browser: Training Status remains readOnly=true and disabled=true; computed cursor=default, background rgb(241,245,249), text rgb(71,85,105), border rgb(226,232,240), height 36px. The enabled readonly Revision Number remains focusable and its focused border is rgb(16,185,129). No business data was changed.
- Responsive smoke check at 375px: document client width and scroll width both 375px. Temporary viewport override reset. Screenshot: target/readonly-desktop.png (local evidence, not committed).
- GitNexus detect-changes includes pre-existing/concurrent Training and earlier test-repair changes; it cannot isolate this slice completely. The own-file Git diff and JSX-attribute comparison were reviewed separately. No commit/push included.

This is presentation-only work, not a statement of regulated-workflow compliance. No DB migration or data rewrite. Browser checks used the supplied logged-in DEV session; no credentials were read or changed. Existing layout/brand retained per UI/UX skill; no new screens, fake data or dark mode.

Rollback: revert only the readonly-style alignment files; leave pre-existing test repairs and concurrent Training work intact.

## Follow-up: click border for natively disabled controls

Owner reported the missing emerald border after clicking readonly fields. Native disabled controls never receive focus, so focus: classes alone cannot satisfy this visual requirement. Added ReadonlyFocusIndicator at the FE root: it marks the last pointer-selected disabled reference field with a data attribute used only by CSS. It does not enable/focus a field, cancel or forward events, invoke application callbacks, read/change values, or call an API. Native disabled/readOnly flags and serialization stay unchanged. An ancestor scroll-container focus caused by Chrome after the click does not discard the visual selection; a genuine focus move, outside pointer click, Tab/Escape, window blur, route change or unmount clears it.

Verification: five new indicator tests plus the eight readonly control tests passed. Full FE report: target/readonly-click-full.json. Frontend Docker rebuilt (no backend/DB changes). In the logged-in DEV Training Revision page, clicking Training Status produces border rgb(16,185,129), 1px matching box shadow, while disabled/readOnly remain true and value remains In progress. Clicking the disabled Planned Date transfers the indicator and keeps aria-expanded=false; clicking the page heading clears it. This explicitly checks the click state that the earlier smoke check missed.
