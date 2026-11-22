/** Same keyboard-focus treatment the shared Button uses (without the offset, which is too loose for dense lists). */
export const FOCUS_RING = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500";

/** Small uppercase caption used above groups of items, matching the labels used across the app. */
export const GROUP_LABEL = "text-xs font-semibold uppercase tracking-wider text-slate-600";

/** Secondary metadata: never below 12px, even on the narrowest phone. */
export const META_TEXT = "text-xs text-slate-600";

/** A toolbar icon button: quiet at rest, clear on hover/focus. */
export const ICON_BUTTON = "shrink-0 text-slate-500 hover:text-slate-900 disabled:opacity-40";
