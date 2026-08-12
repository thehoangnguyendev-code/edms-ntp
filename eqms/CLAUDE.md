# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

See also: [Project-level CLAUDE.md](../CLAUDE.md) for architecture overview, Docker commands, and domain model.

## Guidelines

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

### 1. Think Before Coding
Before implementing: state assumptions, surface tradeoffs, push back when a simpler approach exists.

### 2. Simplicity First
Minimum code that solves the problem. No features beyond what was asked. No abstractions for single-use code. If you write 200 lines and it could be 50, rewrite it.

### 3. Surgical Changes
Touch only what you must. Don't refactor adjacent code. Match existing style. Remove imports/variables that YOUR changes made unused — don't remove pre-existing dead code.

### 4. Goal-Driven Execution
Transform tasks into verifiable goals. For multi-step tasks, state a brief plan with verification steps.

---

## Frontend-Specific Notes

### Vite Dep Cache
After any `package.json` change or `npm install`, always restart with:
```bash
npm run dev -- --force
```
The `node_modules/.vite` cache must be rebuilt or stale module graphs cause `useState`/`useContext` null errors.

### Adding New Features
- New pages go in `src/features/{module}/` as a `{Name}View.tsx`
- Register the route in `src/app/routes/{Module}Routes.tsx` using `lazy()`
- Gate with `usePermissions().hasPermission('module.action')` where needed

### Component Conventions
- Shared UI atoms: `src/components/ui/` — use existing before creating new
- Portal-rendered dropdowns: use `usePortalDropdown` hook + `PortalDropdownMenu`
- Tables with drag-scroll: use `useTableDragScroll` hook
- Toasts: `useToast()` from `@/components/ui/toast/Toast`
- Loading states: `SectionLoading` (inline) or `FullPageLoading` (full-page overlay)

### Tailwind
CDN-based JIT — class names are scanned from the DOM at runtime. No PostCSS build step. Custom utilities go in `src/styles/utilities.css`. Inline config lives in `index.html` (`tailwind.config` script block) — extend it there, not with a separate `tailwind.config.js/ts` file.

### Style Conventions (see `STYLE_REFACTOR_PLAN.md` for full audit/rationale)
Use these values for new/edited code — do not introduce new one-off variants:
- **Border-radius**: control (button/input/select) = `rounded-lg`; container (card/modal/section) = `rounded-xl`; pill/badge = `rounded-full`
- **Icon size**: inline/small = `h-4 w-4`; medium = `h-5 w-5`; icon-tile (icon in a circle/square avatar) = `h-9 w-9`
- **Status/badge color**: always via `Badge`/`StatusBadge` using the `-50/-700` shade pair — never hand-roll `getXColor()` helpers or override with raw Tailwind classes
- **Table header (`<th>`) font size**: always `text-2xs md:text-xs` (canonical reference: `UserManagementView.tsx`'s table head)
- **Micro text elsewhere (badges, chips, non-header labels)**: `text-2xs` (10px token, added to the `index.html` tailwind config) — avoid `text-[10px]`/`text-[11px]` arbitrary values
- **Hex colors**: never inline a hex literal in JSX; use `src/styles/tokens.ts` constants (add to it if reused) — exception: genuinely dynamic values (e.g. live color-picker preview)
- **Card body padding**: `p-4 md:p-5`; **card header padding**: `px-4 md:px-5 py-3`
- **Page section rhythm**: `space-y-4 md:space-y-6` (matches `MainLayout`)
- **Form grid gap**: `gap-4`, breakpoint `md:` for the 1→2 column collapse (not `sm:`)
- **Table cell padding**: `px-4 py-3` (matches `ResponsiveTable` default)
- **Toolbar/button-group gap**: `gap-2`; modal footers: `gap-2 sm:gap-3`
- **Icon-to-text gap**: `gap-1.5`
