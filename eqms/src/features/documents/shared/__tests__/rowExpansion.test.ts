import { describe, expect, it } from "vitest";
import { hasControlledCopyExpansion, hasDocumentExpansion, hasRevisionExpansion } from "../rowExpansion";

describe("row expansion metadata", () => {
  it.each([
    [{}, false],
    [{ hasAnyRevision: false, relatedDocuments: [], correlatedDocuments: [] }, false],
    [{ hasAnyRevision: true }, true],
    [{ relatedDocuments: [{ id: "related" }] }, true],
    [{ correlatedDocuments: [{ id: "correlated" }] }, true],
  ])("Document %j => %s", (row, expected) => {
    expect(hasDocumentExpansion(row)).toBe(expected);
  });

  it.each([
    [{}, false],
    [{ documentId: null, relatedDocuments: [], correlatedDocuments: [] }, false],
    [{ documentId: " " }, false],
    [{ documentId: "parent" }, true],
    [{ relatedDocuments: [{ id: "related" }] }, true],
    [{ correlatedDocuments: [{ id: "correlated" }] }, true],
  ])("Revision %j => %s", (row, expected) => {
    expect(hasRevisionExpansion(row)).toBe(expected);
  });

  it.each([
    [{}, false],
    [{ batchId: "batch", batchQuantity: 0 }, false],
    [{ batchId: "batch", batchQuantity: 1 }, false],
    [{ batchId: "batch", batchQuantity: 2 }, true],
    [{ distributionBatchId: "batch", copyIds: ["a", "b"] }, true],
    [{ batchQuantity: 3 }, false],
    [{ batchId: "batch", batchQuantity: 0, copyIds: ["a", "b"] }, false],
    [{ batchId: "batch", batchQuantity: Number.NaN }, false],
  ])("Controlled Copy %j => %s", (row, expected) => {
    expect(hasControlledCopyExpansion(row)).toBe(expected);
  });

  it("does not confuse totalCopies with a child count", () => {
    const row = { distributionBatchId: "batch", totalCopies: 10 };
    expect(hasControlledCopyExpansion(row)).toBe(false);
  });
});
