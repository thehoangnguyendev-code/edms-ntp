import { useEffect } from 'react';

/**
 * A screen that keeps edits until its own Save (the Configuration pages) tells the shell that it holds some, so the sidebar asks before it leaves for another
 * page, and a closed tab or a reload asks too. The sidebar otherwise warns only on the routes listed as transactional, whether or not anything was typed.
 */
const screensWithChanges = new Set<string>();

export const hasUnsavedScreen = (): boolean => screensWithChanges.size > 0;

/**
 * A screen that has just asked the person and got "Leave" lets the move that follows through, so the browser-history guard (UnsavedChangesPopGuard) does not ask a second time for
 * a move such as navigate(-1). The permission is short: it covers that move only.
 */
let leaveAllowedUntil = 0;
export const allowNextLeave = (): void => {
  leaveAllowedUntil = Date.now() + 1500;
};
export const isLeaveAllowed = (): boolean => Date.now() < leaveAllowedUntil;

export const useReportUnsavedChanges = (screenId: string, dirty: boolean): void => {
  useEffect(() => {
    if (!dirty) return undefined;
    screensWithChanges.add(screenId);
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => {
      screensWithChanges.delete(screenId);
      window.removeEventListener('beforeunload', warn);
    };
  }, [screenId, dirty]);
};
