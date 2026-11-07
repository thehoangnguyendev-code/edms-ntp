import { describe, expect, it } from "vitest";
import { uncontrolledCopyBaseCode } from "../RequestUncontrolledCopyModal";

describe("the document part of an Uncontrolled Copy number", () => {
  it("is cut at every separator and joined with dots, as the server writes it (UCC.SOP.0007.001)", () => {
    expect(uncontrolledCopyBaseCode("SOP.0007")).toBe("SOP.0007");
    expect(uncontrolledCopyBaseCode("SOP-0007")).toBe("SOP.0007");
    expect(uncontrolledCopyBaseCode("SOP_0007")).toBe("SOP.0007");
    expect(uncontrolledCopyBaseCode("  SOP 0007 ")).toBe("SOP.0007");
    expect(uncontrolledCopyBaseCode("SOP.EXT.0007")).toBe("SOP.0007");
    expect(uncontrolledCopyBaseCode("QA.SOP.0037")).toBe("QA.SOP.0037");
  });

  it("is DOC when there is no document number", () => {
    expect(uncontrolledCopyBaseCode(undefined)).toBe("DOC");
    expect(uncontrolledCopyBaseCode("")).toBe("DOC");
    expect(uncontrolledCopyBaseCode("   ")).toBe("DOC");
  });
});
