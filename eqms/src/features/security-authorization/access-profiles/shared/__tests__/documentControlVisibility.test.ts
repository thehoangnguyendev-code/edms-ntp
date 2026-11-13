import { describe, expect, it } from "vitest";
import {
  DOCUMENT_CONTROL_VIEW_ALL_CODES,
  DOCUMENT_CONTROL_VISIBILITY_COLOR,
  DOCUMENT_CONTROL_VISIBILITY_LABEL,
  KNOWLEDGE_VIEW_CODE,
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
    for (const value of ["VIEW_EVERYTHING", "INCOMPLETE", "NAMED_IN_FLOW"] as const) {
      expect(DOCUMENT_CONTROL_VISIBILITY_LABEL[value]).toBeTruthy();
      expect(DOCUMENT_CONTROL_VISIBILITY_COLOR[value]).toBeTruthy();
    }
  });
});
