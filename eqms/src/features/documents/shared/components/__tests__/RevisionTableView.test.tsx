import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

vi.mock("../ExpandedDocumentRow", () => ({ ExpandedDocumentRow: () => null }));
import { RevisionTableView } from "../RevisionTableView";

const mount = (shouldShowExpandIcon?: () => boolean) => {
  const onExpandRow = vi.fn();
  render(<RevisionTableView
    revisions={[
      { id: "empty", documentId: null, relatedDocuments: [], correlatedDocuments: [] },
      { id: "parent", documentId: "document" },
      { id: "relation", relatedDocuments: [{ id: "related", documentNumber: "SOP.1" }] },
    ]}
    columns={[{ id: "no", label: "No.", visible: true, order: 0 }]}
    expandedRowId={null}
    sortConfig={{ key: "no", direction: "asc" }}
    currentPage={1} itemsPerPage={10} isTableLoading={false}
    onExpandRow={onExpandRow} onSort={vi.fn()} onPageChange={vi.fn()} onMenuAction={vi.fn()}
    renderCell={(_column, _item, index) => index + 1}
    getMenuActions={() => []} shouldShowExpandIcon={shouldShowExpandIcon}
  />);
  return onExpandRow;
};

describe("RevisionTableView expansion controls", () => {
  it("leaves the expand cell empty when no companion data exists", () => {
    const onExpand = mount();
    expect(screen.queryByRole("button", { name: "Expand revision empty" })).toBeNull();
    fireEvent.click(screen.getByRole("cell", { name: "1" }).parentElement!.firstElementChild!);
    expect(onExpand).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Expand revision parent" }));
    expect(onExpand).toHaveBeenCalledWith("parent");
    expect(screen.getByRole("button", { name: "Expand revision relation" })).toBeTruthy();
  });

  it("allows callers to hide expansion without allowing them to force empty rows", () => {
    mount(() => true);
    expect(screen.queryByRole("button", { name: "Expand revision empty" })).toBeNull();
  });

  it("honours callers that disable expansion", () => {
    mount(() => false);
    expect(screen.queryByRole("button", { name: /Expand revision/ })).toBeNull();
  });
});
