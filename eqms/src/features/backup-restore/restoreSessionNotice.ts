import { ACCOUNT_NOTICE_STORAGE_KEY } from "@/services/api/client";

/**
 * A restore that replaces the database ends the session of the person who started it: their sign-in was made after the backup was taken,
 * so it does not exist in the restored data. The next request is refused and the person is sent to the sign-in page. This leaves a
 * notice for that page, so they are told the restore is done and why they are signed out, instead of meeting a bare sign-in screen.
 * The notice is removed again when the job ends and the session is still alive (the restore failed before it replaced anything).
 */
export type RestoreNoticeKind = "restored" | "rolled-back";

const NOTICES: Record<RestoreNoticeKind, { title: string; message: string }> = {
  restored: {
    title: "Restore completed",
    message:
      "The system was restored from the backup. Your session was not part of the restored data, so you have been signed out. Sign in again to see the result of the restore.",
  },
  "rolled-back": {
    title: "Restore rolled back",
    message:
      "The restore was rolled back and the previous data is live again. Your session was not part of that data, so you have been signed out. Sign in again to continue.",
  },
};

export const leaveRestoreNotice = (kind: RestoreNoticeKind): void => {
  try {
    sessionStorage.setItem(ACCOUNT_NOTICE_STORAGE_KEY, JSON.stringify(NOTICES[kind]));
  } catch {
    // sessionStorage unavailable: the person is still signed out, only the explanation is skipped
  }
};

export const clearRestoreNotice = (): void => {
  try {
    sessionStorage.removeItem(ACCOUNT_NOTICE_STORAGE_KEY);
  } catch {
    // nothing to clear
  }
};
