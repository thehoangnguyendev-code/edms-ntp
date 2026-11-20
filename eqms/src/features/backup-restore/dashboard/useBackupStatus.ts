import { useEffect, useSyncExternalStore } from "react";
import { backupRestoreApi, type BackupDailyPoint, type BackupOverview } from "@/services/api/backupRestore";
import { getApiErrorMessage } from "@/utils/apiError";

/** The status is read again this often while a backup card is on the dashboard and the tab is visible. */
export const BACKUP_REFRESH_MS = 30_000;
export const BACKUP_HISTORY_DAYS = 30;

export interface BackupStatus {
  overview?: BackupOverview;
  /** Why the last read of the overview failed; the last good values stay in `overview`. */
  error: string;
  daily: BackupDailyPoint[] | null;
  dailyFailed: boolean;
  updatedAt?: Date;
}

let state: BackupStatus = { error: "", daily: null, dailyFailed: false };
let subscribers = 0;
let timer: number | undefined;
const listeners = new Set<() => void>();

const publish = (next: Partial<BackupStatus>) => {
  state = { ...state, ...next };
  listeners.forEach((listener) => listener());
};

/** Each request fails on its own: a broken chart does not hide the status, and a failed refresh keeps the last values. */
const load = () => {
  backupRestoreApi
    .overview()
    .then((overview) => publish({ overview, error: "", updatedAt: new Date() }))
    .catch((e) => publish({ error: getApiErrorMessage(e, "Unable to read the backup status.") }));
  backupRestoreApi
    .overviewDaily(BACKUP_HISTORY_DAYS)
    .then((daily) => publish({ daily, dailyFailed: false }))
    .catch(() => publish({ dailyFailed: true }));
};

const start = () => {
  if (subscribers++ > 0) return;
  load();
  timer = window.setInterval(() => {
    if (!document.hidden) load();
  }, BACKUP_REFRESH_MS);
};

const stop = () => {
  if (--subscribers > 0) return;
  window.clearInterval(timer);
  timer = undefined;
  state = { error: "", daily: null, dailyFailed: false }; // the next card to appear reads afresh, never shows an old figure as current
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};

/**
 * One shared reading of the backup status for every backup card on the page: the agent is asked once per
 * interval however many cards are shown, and not at all when none is.
 */
export function useBackupStatus(): BackupStatus {
  useEffect(() => {
    start();
    return stop;
  }, []);
  return useSyncExternalStore(subscribe, () => state);
}

/** Reads the status again now, for a card's Retry button. */
export const refreshBackupStatus = () => {
  if (subscribers > 0) load();
};
