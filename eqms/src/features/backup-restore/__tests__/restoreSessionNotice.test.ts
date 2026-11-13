import { afterEach, describe, expect, it } from "vitest";
import { ACCOUNT_NOTICE_STORAGE_KEY } from "@/services/api/client";
import { clearRestoreNotice, leaveRestoreNotice } from "../restoreSessionNotice";

afterEach(() => sessionStorage.clear());

describe("the notice left for the sign-in page after a restore", () => {
  it("tells the person the restore is done and why they are signed out, in the shape the sign-in page reads", () => {
    leaveRestoreNotice("restored");
    const notice = JSON.parse(sessionStorage.getItem(ACCOUNT_NOTICE_STORAGE_KEY)!);
    expect(notice.title).toBe("Restore completed");
    expect(notice.message).toMatch(/Sign in again/);
  });

  it("says a rollback was rolled back, not restored", () => {
    leaveRestoreNotice("rolled-back");
    expect(JSON.parse(sessionStorage.getItem(ACCOUNT_NOTICE_STORAGE_KEY)!).title).toBe("Restore rolled back");
  });

  it("is removed when the session is still alive after the job, so it never shows at an unrelated sign-out", () => {
    leaveRestoreNotice("restored");
    clearRestoreNotice();
    expect(sessionStorage.getItem(ACCOUNT_NOTICE_STORAGE_KEY)).toBeNull();
  });
});
