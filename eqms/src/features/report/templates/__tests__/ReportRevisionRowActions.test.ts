import { describe, expect, it } from "vitest";
import { reportRevisionRowActions } from "../reportRevisionRowActions";

const caps = (allowed: string[]) => ({
  resourceType: "REPORT_TEMPLATE",
  resourceId: "RPT.0001",
  state: "ACTIVE",
  actions: Object.fromEntries(["edit", "submitForApproval", "approve", "reject", "upgrade"].map((name) => [name, { allowed: allowed.includes(name) }])),
});

/** REPORT-REVISION-ROW-MENU-2026-11-15: the row menu follows the status of the revision and what the server lets this person do, as the Document Control revision menu does. */
describe("reportRevisionRowActions", () => {
  it("always offers View Details, and nothing else to a person with no permission", () => {
    for (const status of ["DRAFT", "PENDING_APPROVAL", "EFFECTIVE", "OBSOLETE", "DISCARDED"] as const) {
      expect(reportRevisionRowActions({ status, capabilities: caps([]) })).toEqual(["view"]);
      expect(reportRevisionRowActions({ status })).toEqual(["view"]);
    }
  });

  it("offers Edit Revision on a Draft to a person who may edit, or send it for approval", () => {
    expect(reportRevisionRowActions({ status: "DRAFT", capabilities: caps(["edit"]) } as never)).toEqual(["view", "edit"]);
    expect(reportRevisionRowActions({ status: "DRAFT", capabilities: caps(["submitForApproval"]) } as never)).toEqual(["view", "edit"]);
  });

  it("offers Approve Revision only on a revision Pending Approval that the person may decide (never the author)", () => {
    expect(reportRevisionRowActions({ status: "PENDING_APPROVAL", capabilities: caps(["approve"]) } as never)).toEqual(["view", "approve"]);
    expect(reportRevisionRowActions({ status: "PENDING_APPROVAL", capabilities: caps([]) } as never)).toEqual(["view"]);
    expect(reportRevisionRowActions({ status: "DRAFT", capabilities: caps(["approve"]) } as never)).toEqual(["view"]);
  });

  it("offers Upgrade only on the revision in force, never on an older or discarded one", () => {
    expect(reportRevisionRowActions({ status: "EFFECTIVE", capabilities: caps(["upgrade"]) } as never)).toEqual(["view", "upgrade"]);
    expect(reportRevisionRowActions({ status: "OBSOLETE", capabilities: caps(["upgrade", "edit"]) } as never)).toEqual(["view"]);
    expect(reportRevisionRowActions({ status: "DISCARDED", capabilities: caps(["upgrade", "edit"]) } as never)).toEqual(["view"]);
  });

  it("decides on the status code, so the permission to edit does not open a revision in force", () => {
    expect(reportRevisionRowActions({ status: "EFFECTIVE", capabilities: caps(["edit", "submitForApproval"]) } as never)).toEqual(["view"]);
  });
});
