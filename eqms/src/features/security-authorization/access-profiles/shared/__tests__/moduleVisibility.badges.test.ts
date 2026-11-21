import { describe, expect, it } from "vitest";
import { moduleVisibilityBadges } from "../moduleVisibility";

describe("moduleVisibilityBadges", () => {
  it("shows nothing for a profile with no Training or Reports permission", () => {
    expect(moduleVisibilityBadges(["documents.module.view"])).toEqual([]);
  });
  it("shows Training by department until the all-departments permission is held", () => {
    expect(moduleVisibilityBadges(["training.record.view"])).toEqual([{ module: "Training Management", label: "My department", color: "blue" }]);
    expect(moduleVisibilityBadges(["training.record.view", "training.scope.all"])[0]).toMatchObject({ label: "All departments", color: "emerald" });
  });
  it("shows Reports by own or all runs, nothing without a level", () => {
    expect(moduleVisibilityBadges(["report.module.view"])).toEqual([]);
    expect(moduleVisibilityBadges(["reports.run.view_own"])[0]).toMatchObject({ module: "Reports", label: "Own runs" });
    expect(moduleVisibilityBadges(["reports.run.view_own", "reports.run.view_all"])[0]).toMatchObject({ label: "All runs" });
  });
});
