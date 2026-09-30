import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { TableMarkup } from "@/components/ui/table/TablePrimitives";

const mocks = vi.hoisted(() => ({ getDocumentVersions: vi.fn(), getRevisionById: vi.fn() }));
vi.mock("@/hooks", () => ({ useNavigateWithLoading: () => ({ navigateTo: vi.fn(), navigateToPrepared: vi.fn(), isNavigating: false }) }));
vi.mock("@/services/api/documents", () => ({ documentApi: mocks }));
import { ExpandedDocumentRow } from "../ExpandedDocumentRow";

describe("ExpandedDocumentRow empty-data guard", () => {
  it.each(["documentId", "revisionId"] as const)("does not render or fetch %s when hasDocs is false", (key) => {
    render(<TableMarkup.Root><TableMarkup.Body>
      <ExpandedDocumentRow {...{ [key]: "empty" }} isExpanded hasDocs={false} visibleColumnsLength={3} />
    </TableMarkup.Body></TableMarkup.Root>);
    expect(document.querySelector("tbody tr")).toBeNull();
    expect(mocks.getDocumentVersions).not.toHaveBeenCalled();
    expect(mocks.getRevisionById).not.toHaveBeenCalled();
  });
});
