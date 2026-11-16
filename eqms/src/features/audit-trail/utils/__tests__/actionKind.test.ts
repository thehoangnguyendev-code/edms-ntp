import { describe, expect, it } from "vitest";
import { auditActionKind, AUDIT_KIND_TONE } from "../actionKind";

describe("auditActionKind", () => {
  it("reads the kind from the words of the action code, whatever its spelling", () => {
    const cases: Array<[string, string]> = [
      ["TRAINING_ACTIVITY_CREATED", "create"],
      ["Update", "update"],
      ["publish_to_effective", "publish"],
      ["Failed Login", "failed"],
      ["Login", "login"],
      ["logout", "logout"],
      ["Submit", "submit"],
      ["Approve", "approve"],
      ["REJECTED", "reject"],
      ["Reviewed", "review"],
      ["Add Working Note", "note"],
      ["Upload to Office Online", "upload"],
      ["Download Evidence", "download"],
      ["Export", "download"],
      ["Delete", "delete"],
      ["Assign", "assign"],
      ["Disable", "disable"],
      ["Obsoleted", "disable"],
      ["Open Preview", "view"],
      ["Edit Online Synced Back to MinIO", "update"],
      ["SOMETHING_UNKNOWN", "system"],
      ["", "system"],
    ];
    for (const [action, kind] of cases) expect(auditActionKind(action), action).toBe(kind);
  });

  it("puts a failure before a sign-in and a note before an addition", () => {
    expect(auditActionKind("FAILED_LOGIN")).toBe("failed");
    expect(auditActionKind("ADD_WORKING_NOTE")).toBe("note");
  });

  it("gives every kind a colour group of the audit badge", () => {
    for (const tone of Object.values(AUDIT_KIND_TONE)) expect(["emerald", "sky", "rose", "slate", "amber", "violet"]).toContain(tone);
    expect(AUDIT_KIND_TONE.reject).toBe("rose");
    expect(AUDIT_KIND_TONE.approve).toBe("emerald");
  });
});
