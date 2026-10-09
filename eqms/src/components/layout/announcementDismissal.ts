/**
 * Which announcements the user has closed during this sign-in. It lives in sessionStorage and is cleared when a user signs
 * in or out, so every successful sign-in shows the active announcements again. Every access is guarded: storage can be
 * blocked, and the banner must still work (it then simply reappears on the next load).
 */
const KEY = "eqms:announcements:dismissed";

export const getDismissedAnnouncementIds = (): string[] => {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
  } catch {
    return [];
  }
};

export const dismissAnnouncement = (id: string): void => {
  try {
    const ids = new Set(getDismissedAnnouncementIds());
    ids.add(id);
    window.sessionStorage.setItem(KEY, JSON.stringify([...ids]));
  } catch {
    /* storage unavailable: the banner stays closed for this page view only */
  }
};

export const clearDismissedAnnouncements = (): void => {
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    /* nothing to clear */
  }
};
