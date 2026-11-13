/**
 * Width (px) of the application sidebar. The user can drag the sidebar edge between the minimum and
 * the maximum below; the default is what a person sees until they do. The Knowledge Base explorer's
 * own sidebar follows the same stored width.
 */
export const APP_SIDEBAR_WIDTH = 320;
export const APP_SIDEBAR_MIN_WIDTH = 256;
export const APP_SIDEBAR_MAX_WIDTH = 400;
export const APP_SIDEBAR_COLLAPSED_WIDTH = 80;
/** The slide-in menu on a phone has its own fixed width (it is never resized). */
export const MOBILE_SIDEBAR_WIDTH = 360;
/** Keyboard step of the resize handle (arrow keys). */
export const APP_SIDEBAR_KEYBOARD_STEP = 16;

export const clampSidebarWidth = (value: number): number => {
  if (!Number.isFinite(value)) return APP_SIDEBAR_WIDTH;
  return Math.min(APP_SIDEBAR_MAX_WIDTH, Math.max(APP_SIDEBAR_MIN_WIDTH, Math.round(value)));
};
