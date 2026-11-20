import { describe, expect, it } from "vitest";
import {
  DOCUMENT_CONTROL_BASE_VIEW_CODES,
  DOCUMENT_CONTROL_VIEW_ALL_CODES,
  DOCUMENT_CONTROL_VIEW_DEPARTMENT_CODE,
  DOCUMENT_CONTROL_VISIBILITY_COLOR,
  DOCUMENT_CONTROL_VISIBILITY_LABEL,
  KNOWLEDGE_VIEW_CODE,
  applyVisibilityChoice,
  classifyVisibility,
  missingViewAllCodes,
  withKnowledgePermission,
} from "../documentControlVisibility";

describe("missingViewAllCodes", () => {
  it("is empty when the profile holds none of the three, so a plain profile gets no warning", () => {
    expect(missingViewAllCodes(["documents.module.view", "documents.document.view"])).toEqual([]);
  });

  it("is empty when it holds all three", () => {
    expect(missingViewAllCodes([...DOCUMENT_CONTROL_VIEW_ALL_CODES])).toEqual([]);
  });

  it("names what is missing when it holds some", () => {
    expect(missingViewAllCodes(["documents.document.view_all"])).toEqual([
      "documents.controlled_copy.view_all",
      "documents.uncontrolled_copy.view_all",
    ]);
    expect(missingViewAllCodes(["documents.uncontrolled_copy.view_all", "documents.controlled_copy.view_all"])).toEqual(["documents.document.view_all"]);
  });

  it("ignores case and surrounding space", () => {
    expect(missingViewAllCodes([" DOCUMENTS.DOCUMENT.VIEW_ALL ", "Documents.Controlled_Copy.View_All", "documents.uncontrolled_copy.view_all"])).toEqual([]);
  });
});

describe("withKnowledgePermission", () => {
  it("adds the Knowledge permission to a new profile by default", () => {
    expect(withKnowledgePermission([], [], true)).toEqual([KNOWLEDGE_VIEW_CODE]);
    expect(withKnowledgePermission(["documents.module.view"], [], true)).toEqual(["documents.module.view", KNOWLEDGE_VIEW_CODE]);
  });

  it("leaves it out when the administrator unticked it", () => {
    expect(withKnowledgePermission(["documents.module.view"], [], false)).toEqual(["documents.module.view"]);
    expect(withKnowledgePermission([], [], false)).toEqual([]);
  });

  it("does not repeat it when a picked Permission Set already grants it, or when it was ticked by hand", () => {
    expect(withKnowledgePermission([], ["x", KNOWLEDGE_VIEW_CODE], true)).toEqual([]);
    expect(withKnowledgePermission([KNOWLEDGE_VIEW_CODE], [], true)).toEqual([KNOWLEDGE_VIEW_CODE]);
  });
});

describe("display of the visibility", () => {
  it("has a label and a colour for every machine value", () => {
    for (const value of ["VIEW_EVERYTHING", "DEPARTMENT", "INCOMPLETE", "NAMED_IN_FLOW"] as const) {
      expect(DOCUMENT_CONTROL_VISIBILITY_LABEL[value]).toBeTruthy();
      expect(DOCUMENT_CONTROL_VISIBILITY_COLOR[value]).toBeTruthy();
    }
  });
});

describe("classifyVisibility (mirrors the server)", () => {
  it("names the four values", () => {
    expect(classifyVisibility([])).toBe("NAMED_IN_FLOW");
    expect(classifyVisibility([DOCUMENT_CONTROL_VIEW_DEPARTMENT_CODE])).toBe("DEPARTMENT");
    expect(classifyVisibility([...DOCUMENT_CONTROL_VIEW_ALL_CODES])).toBe("VIEW_EVERYTHING");
    expect(classifyVisibility([DOCUMENT_CONTROL_VIEW_DEPARTMENT_CODE, "documents.document.view_all"])).toBe("INCOMPLETE");
  });
});

describe("applyVisibilityChoice", () => {
  const none = new Set<string>();

  it("department: adds the department permission and the base view permissions", () => {
    const next = applyVisibilityChoice(none, none, "DEPARTMENT");
    expect(next.has(DOCUMENT_CONTROL_VIEW_DEPARTMENT_CODE)).toBe(true);
    for (const code of DOCUMENT_CONTROL_BASE_VIEW_CODES) expect(next.has(code)).toBe(true);
    expect(classifyVisibility(next)).toBe("DEPARTMENT");
  });

  it("all: adds the three view-all permissions and drops the department one", () => {
    const next = applyVisibilityChoice(new Set([DOCUMENT_CONTROL_VIEW_DEPARTMENT_CODE]), none, "VIEW_EVERYTHING");
    expect(classifyVisibility(next)).toBe("VIEW_EVERYTHING");
    expect(next.has(DOCUMENT_CONTROL_VIEW_DEPARTMENT_CODE)).toBe(false);
  });

  it("named in flow: removes every level permission and keeps the rest", () => {
    const next = applyVisibilityChoice(new Set([...DOCUMENT_CONTROL_VIEW_ALL_CODES, DOCUMENT_CONTROL_VIEW_DEPARTMENT_CODE, "documents.workspace.manage"]), none, "NAMED_IN_FLOW");
    expect(classifyVisibility(next)).toBe("NAMED_IN_FLOW");
    expect(next.has("documents.workspace.manage")).toBe(true);
  });

  it("repairs an incomplete profile", () => {
    expect(classifyVisibility(applyVisibilityChoice(new Set(["documents.document.view_all"]), none, "VIEW_EVERYTHING"))).toBe("VIEW_EVERYTHING");
    expect(classifyVisibility(applyVisibilityChoice(new Set(["documents.document.view_all"]), none, "NAMED_IN_FLOW"))).toBe("NAMED_IN_FLOW");
  });

  it("never touches a permission that comes from a shared set", () => {
    const locked = new Set(["documents.document.view_all"]);
    const next = applyVisibilityChoice(new Set(), locked, "NAMED_IN_FLOW");
    expect(next.has("documents.document.view_all")).toBe(false); // not added to the direct permissions, and the locked one stays in its set
    expect(classifyVisibility([...locked, ...next])).toBe("INCOMPLETE");
  });
});
