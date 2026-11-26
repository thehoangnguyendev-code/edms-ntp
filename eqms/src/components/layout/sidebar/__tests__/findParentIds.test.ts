import { describe, expect, it } from "vitest";
import { NAV_CONFIG, findNodeByPath } from "@/app/navigation";
import { findParentIds } from "../Sidebar";

describe("the menu opens down to the screen", () => {
  const parentsOf = (path: string) => findParentIds(NAV_CONFIG, findNodeByPath(NAV_CONFIG, path)!.id);

  it("opens the module and the group of a screen three levels deep", () => {
    expect(parentsOf("/training-management/personnel-reviews")).toHaveLength(2);
    expect(parentsOf("/training-management/assessments")).toHaveLength(2);
  });

  it("does the same on a detail page of that screen", () => {
    expect(parentsOf("/training-management/personnel-reviews/abc")).toEqual(parentsOf("/training-management/personnel-reviews"));
  });

  it("has nothing to open for an entry at the top of the menu", () => {
    expect(findParentIds(NAV_CONFIG, NAV_CONFIG[0].id)).toEqual([]);
  });
});
