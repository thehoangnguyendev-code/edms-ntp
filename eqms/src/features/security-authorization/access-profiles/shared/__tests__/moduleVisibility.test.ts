import { describe, expect, it } from "vitest";
import { REPORTS_VISIBILITY, TRAINING_VISIBILITY, applyModuleVisibility, classifyModuleVisibility, levelCodesOf, levelRank } from "../moduleVisibility";

const none = new Set<string>();

describe("Training visibility (department / all departments)", () => {
  it("is the department level by default, and all departments with training.scope.all", () => {
    expect(classifyModuleVisibility(TRAINING_VISIBILITY, [])).toBe("DEPARTMENT");
    expect(classifyModuleVisibility(TRAINING_VISIBILITY, ["training.module.view"])).toBe("DEPARTMENT");
    expect(classifyModuleVisibility(TRAINING_VISIBILITY, [" TRAINING.SCOPE.ALL "])).toBe("ALL");
  });

  it("choosing all departments adds the permission; choosing the department takes it off", () => {
    const all = applyModuleVisibility(TRAINING_VISIBILITY, new Set(["training.module.view"]), none, "ALL");
    expect(all.has("training.scope.all")).toBe(true);
    expect(all.has("training.module.view")).toBe(true);
    const back = applyModuleVisibility(TRAINING_VISIBILITY, all, none, "DEPARTMENT");
    expect(back.has("training.scope.all")).toBe(false);
    expect(back.has("training.module.view")).toBe(true);
  });

  it("never touches a permission that comes from a shared set", () => {
    const locked = new Set(["training.scope.all"]);
    const next = applyModuleVisibility(TRAINING_VISIBILITY, new Set(), locked, "DEPARTMENT");
    expect(next.size).toBe(0);
    expect(classifyModuleVisibility(TRAINING_VISIBILITY, [...locked, ...next])).toBe("ALL");
  });
});

describe("Reports visibility (own runs / all runs)", () => {
  it("is no level when the profile holds none of the report-history permissions", () => {
    expect(classifyModuleVisibility(REPORTS_VISIBILITY, [])).toBeNull();
    expect(classifyModuleVisibility(REPORTS_VISIBILITY, ["report.module.view"])).toBeNull();
  });

  it("reads own runs from reports.run.view_own and all runs from both permissions", () => {
    expect(classifyModuleVisibility(REPORTS_VISIBILITY, ["reports.run.view_own"])).toBe("OWN");
    expect(classifyModuleVisibility(REPORTS_VISIBILITY, ["reports.run.view_all"])).toBeNull(); // view_all alone does not open the history
    expect(classifyModuleVisibility(REPORTS_VISIBILITY, ["reports.run.view_own", "reports.run.view_all"])).toBe("ALL");
  });

  it("choosing a level adds its permissions and the report module permission", () => {
    const own = applyModuleVisibility(REPORTS_VISIBILITY, none, none, "OWN");
    expect([...own].sort()).toEqual(["report.module.view", "reports.run.view_own"]);
    const all = applyModuleVisibility(REPORTS_VISIBILITY, own, none, "ALL");
    expect(classifyModuleVisibility(REPORTS_VISIBILITY, all)).toBe("ALL");
    const lower = applyModuleVisibility(REPORTS_VISIBILITY, all, none, "OWN");
    expect(lower.has("reports.run.view_all")).toBe(false);
    expect(classifyModuleVisibility(REPORTS_VISIBILITY, lower)).toBe("OWN");
  });

  it("keeps the ladder ordered and lists the managed permissions", () => {
    expect(levelRank(REPORTS_VISIBILITY, "OWN")).toBeLessThan(levelRank(REPORTS_VISIBILITY, "ALL"));
    expect(levelCodesOf(REPORTS_VISIBILITY).sort()).toEqual(["reports.run.view_all", "reports.run.view_own"]);
  });
});
