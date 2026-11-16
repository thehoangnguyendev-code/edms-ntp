import { describe, expect, it, vi } from "vitest";
import { reportRevisionParent } from "../reportRevisionParent";
import { reportBreadcrumbs } from "../reportBreadcrumbs";

/** REPORT-REVISION-TITLES-2026-11-15: where a page of a revision was opened from names its parent in the breadcrumb, and Back leads there. */
describe("reportRevisionParent", () => {
  const parentOf = (from: string | undefined, fallback = "/report/template-revisions") => {
    const navigate = vi.fn();
    const parent = reportRevisionParent(from, navigate, fallback);
    parent.onClick();
    return { label: parent.label, went: navigate.mock.calls[0]?.[0] };
  };

  it("names the list or page the person came from, and goes back to it", () => {
    expect(parentOf("/report/template-revisions/pending-approval")).toEqual({ label: "Pending My Approval", went: "/report/template-revisions/pending-approval" });
    expect(parentOf("/report/template-revisions")).toEqual({ label: "All Revisions", went: "/report/template-revisions" });
    expect(parentOf("/report/template-management")).toEqual({ label: "Report Templates", went: "/report/template-management" });
    expect(parentOf("/report/template-management/RPT.0003/details")).toEqual({ label: "Report Template Details", went: "/report/template-management/RPT.0003/details" });
    expect(parentOf("/report/template-revisions?x=1")).toEqual({ label: "All Revisions", went: "/report/template-revisions" });
  });

  it("uses the fallback when the page was opened by its address, and ignores an address it does not know", () => {
    expect(parentOf(undefined).label).toBe("All Revisions");
    expect(parentOf(undefined, "/report/template-revisions/pending-approval").label).toBe("Pending My Approval");
    expect(parentOf(undefined, "/report/template-management").label).toBe("Report Templates");
    expect(parentOf("/somewhere/else").label).toBe("All Revisions");
  });

  it("gives every revision page a breadcrumb that ends with its title and names the menu group of its parent", () => {
    const trail = (title: string, from?: string, fallback?: string) => {
      const navigate = vi.fn();
      return reportBreadcrumbs(navigate, title, false, reportRevisionParent(from, navigate, fallback ?? "/report/template-revisions")).map((item) => item.label);
    };
    expect(trail("Approve Revision", undefined, "/report/template-revisions/pending-approval").slice(-3)).toEqual(["Template Management", "Pending My Approval", "Approve Revision"]);
    expect(trail("Edit Revision", "/report/template-management").slice(-3)).toEqual(["Template Management", "Report Templates", "Edit Revision"]);
    expect(trail("Create Report Template", undefined, "/report/template-management").slice(-3)).toEqual(["Template Management", "Report Templates", "Create Report Template"]);
    expect(trail("Revision Details", "/report/template-management/RPT.0003/details").slice(-4)).toEqual(["Template Management", "Report Templates", "Report Template Details", "Revision Details"]);
  });
});
