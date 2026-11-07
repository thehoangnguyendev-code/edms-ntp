import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

vi.mock("../ExpandedDocumentRow", () => ({ ExpandedDocumentRow: () => null }));
import { ToastProvider } from "@/components/ui/toast/Toast";
import { RevisionTableView, useRevisionColumnLayout } from "../RevisionTableView";

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
    currentPage={1} itemsPerPage={10} isTableLoading={false} totalItems={3} totalPages={1}
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

describe("RevisionTableView revision number link", () => {
  beforeEach(() => {
    window.matchMedia = ((query: string) => ({
      matches: true, media: query, addEventListener: () => undefined, removeEventListener: () => undefined,
      addListener: () => undefined, removeListener: () => undefined, onchange: null, dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
    window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
  });

  it("opens the clicked revision's detail through onViewItem", () => {
    const onViewItem = vi.fn();
    render(<RevisionTableView
      revisions={[{ id: "rev-1" }, { id: "rev-2" }]}
      columns={[{ id: "revisionNumber", label: "Revision Number", visible: true, order: 0 }]}
      expandedRowId={null}
      sortConfig={{ key: "revisionNumber", direction: "asc" }}
      currentPage={1} itemsPerPage={10} isTableLoading={false} totalItems={2} totalPages={1}
      onExpandRow={vi.fn()} onSort={vi.fn()} onPageChange={vi.fn()} onMenuAction={vi.fn()}
      renderCell={(_column, item) => `v-${item.id}`}
      getMenuActions={() => []} onViewItem={onViewItem}
    />);
    fireEvent.click(screen.getByText("v-rev-2"));
    expect(onViewItem).toHaveBeenCalledTimes(1);
    expect(onViewItem).toHaveBeenCalledWith("rev-2");
  });

  it("keeps the link when the columns come from useRevisionColumnLayout", () => {
    const onViewItem = vi.fn();
    const columns = [
      { id: "documentNumber", label: "Document Number", visible: true, order: 0 },
      { id: "revisionNumber", label: "Revision Number", visible: true, order: 1 },
    ];
    const Harness = () => {
      const { layout } = useRevisionColumnLayout("test.revisions", {
        columns,
        sortConfig: { key: "revisionNumber", direction: "asc" },
        onSort: vi.fn(),
        renderCell: (column, item: { id: string }) => `${column.id}-${item.id}`,
        expandedRowId: null,
        onExpandRow: vi.fn(),
        onViewItem,
      });
      return <RevisionTableView
        revisions={[{ id: "rev-1" }]}
        columns={columns}
        columnLayout={layout}
        expandedRowId={null}
        sortConfig={{ key: "revisionNumber", direction: "asc" }}
        currentPage={1} itemsPerPage={10} isTableLoading={false} totalItems={1} totalPages={1}
        onExpandRow={vi.fn()} onSort={vi.fn()} onPageChange={vi.fn()} onMenuAction={vi.fn()}
        renderCell={(column, item) => `${column.id}-${item.id}`}
        getMenuActions={() => []} onViewItem={onViewItem}
      />;
    };
    render(<ToastProvider><Harness /></ToastProvider>);
    fireEvent.click(screen.getByText("revisionNumber-rev-1"));
    fireEvent.click(screen.getByText("documentNumber-rev-1"));
    expect(onViewItem).toHaveBeenNthCalledWith(1, "rev-1");
    expect(onViewItem).toHaveBeenNthCalledWith(2, "rev-1");
  });
});
