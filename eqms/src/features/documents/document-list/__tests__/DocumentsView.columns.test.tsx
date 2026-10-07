import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  table: {} as Record<string, unknown>,
  handleSort: vi.fn(),
  filterProps: {} as Record<string, unknown>,
  setReviewer: vi.fn(),
}));

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "u-admin", fullName: "Admin" } }) }));
vi.mock("@/hooks", () => ({
  useNavigateWithLoading: () => ({ navigateTo: vi.fn(), navigateToPrepared: vi.fn(), isNavigating: false }),
  usePortalDropdown: () => ({ openId: null, position: { top: 0, left: 0 }, getRef: () => vi.fn(), toggle: vi.fn(), close: vi.fn() }),
}));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ hasPermissionAlias: () => true }) }));
vi.mock("@/features/documents/shared/useDocumentPermissions", () => ({ useDocumentPermissions: () => ({ canCreateDocumentShell: false }) }));
vi.mock("@/components/ui/toast", () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock("@/components/ui/table/useTableColumnPreferences", async () => {
  const actual = await vi.importActual<typeof import("@/components/ui/table/useTableColumnPreferences")>("@/components/ui/table/useTableColumnPreferences");
  return {
    ...actual,
    useTableColumnPreferences: (_key: string, defaults: unknown[]) => ({ columns: defaults, saveColumns: vi.fn(), resetColumns: vi.fn() }),
  };
});
vi.mock("@/features/documents/hooks", () => ({ useDocumentServerTable: () => mocks.table }));
vi.mock("@/features/documents/shared/components/ExpandedDocumentRow", () => ({
  ExpandedDocumentRow: () => null,
  preloadExpandedDocumentDetails: vi.fn(),
}));
vi.mock("@/features/documents/shared/components/DocumentFilters", () => ({
  DocumentFilters: (props: Record<string, unknown>) => {
    mocks.filterProps = props;
    return <div data-testid="filters" />;
  },
}));
vi.mock("@/components/ui/page/PageHeader", () => ({ PageHeader: ({ title, actions }: any) => <div><h1>{title}</h1>{actions}</div> }));
vi.mock("@/services/api/documents", () => ({ documentApi: {} }));

import { DocumentsView } from "../DocumentsView";

const documentItem = (overrides: Record<string, unknown> = {}) => ({
  id: "d1", documentNumber: "SOP.0007", documentName: "Computerized system validation", revisionNumber: "1.0",
  status: "Active", statusCode: "ACTIVE", type: "SOP", businessUnit: "BU", department: "QA", author: "Lan Tran", owner: "Lan Tran",
  openedBy: "Lan Tran", created: "2026-10-01", createdDate: "2026-10-01", effectiveDate: "", validUntil: "", hasRelatedDocuments: false,
  hasCorrelatedDocuments: false, isTemplate: false, lastModifiedDate: "", lastModifiedBy: "",
  reviewerNames: ["Minh Le", "Hoa Pham"], approverNames: ["Quang Vo"], requiresTraining: true, trainingPeriodDays: 14,
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: true, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(), onchange: null, dispatchEvent: vi.fn() }));
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} unobserve() {} });
  mocks.table = {
    searchQuery: "", setSearchQuery: vi.fn(), applyFilters: vi.fn(),
    statusFilter: "All", setStatusFilter: vi.fn(), typeFilter: "All", setTypeFilter: vi.fn(),
    businessUnitFilter: "All", setBusinessUnitFilter: vi.fn(), departmentFilter: "All", setDepartmentFilter: vi.fn(),
    relatedDocumentFilter: "All", setRelatedDocumentFilter: vi.fn(), correlatedDocumentFilter: "All", setCorrelatedDocumentFilter: vi.fn(),
    templateFilter: "All", setTemplateFilter: vi.fn(), authorFilter: "All", setAuthorFilter: vi.fn(),
    reviewerFilter: "u-reviewer", setReviewerFilter: mocks.setReviewer, approverFilter: "All", setApproverFilter: vi.fn(),
    requiresTrainingFilter: "yes", setRequiresTrainingFilter: vi.fn(),
    participantOptions: [{ label: "All", value: "All" }],
    createdFromDate: "", setCreatedFromDate: vi.fn(), createdToDate: "", setCreatedToDate: vi.fn(),
    effectiveFromDate: "", setEffectiveFromDate: vi.fn(), effectiveToDate: "", setEffectiveToDate: vi.fn(),
    validFromDate: "", setValidFromDate: vi.fn(), validToDate: "", setValidToDate: vi.fn(),
    currentPage: 1, setCurrentPage: vi.fn(), itemsPerPage: 10, setItemsPerPage: vi.fn(), totalItems: 2, totalPages: 1,
    documents: [
      documentItem(),
      documentItem({ id: "d2", documentNumber: "FRM.0001", reviewerNames: [], approverNames: [], requiresTraining: false, trainingPeriodDays: null }),
    ],
    isLoading: false, isExporting: false, isLookupLoading: false, error: null,
    sortConfig: { key: "created", direction: "desc" }, handleSort: mocks.handleSort, clearFilters: vi.fn(),
    statusOptions: [], typeOptions: [], businessUnitOptions: [], departmentOptions: [], authorOptions: [], searchAuthors: vi.fn(),
    authorFilterDisabled: false, exportDocuments: vi.fn(),
  };
});

/** The cell of a row that sits under the given column header. */
const cellUnder = (row: HTMLElement, header: string) => {
  const headers = screen.getAllByRole("columnheader");
  const index = headers.findIndex((candidate) => candidate.textContent?.includes(header));
  expect(index, `column ${header}`).toBeGreaterThanOrEqual(0);
  return within(row).getAllByRole("cell")[index];
};

describe("DocumentsView participant and training columns", () => {
  it("shows Reviewers, Required Training?, Training Period (Days) and Approvers for each document", () => {
    render(<MemoryRouter><DocumentsView viewType="all" /></MemoryRouter>);

    for (const header of ["Reviewers", "Required Training?", "Training Period (Days)", "Approvers"]) {
      expect(screen.getByRole("columnheader", { name: new RegExp(header.replace(/[?()]/g, "\\$&")) })).toBeInTheDocument();
    }
    const withTraining = screen.getByText("SOP.0007").closest("tr") as HTMLElement;
    expect(cellUnder(withTraining, "Reviewers")).toHaveTextContent("Minh Le, Hoa Pham");
    expect(cellUnder(withTraining, "Approvers")).toHaveTextContent("Quang Vo");
    expect(cellUnder(withTraining, "Required Training?")).toHaveTextContent("Yes");
    expect(cellUnder(withTraining, "Training Period (Days)")).toHaveTextContent("14");

    // No reviewer, no approver, no training and no period: a dash or "No", never a zero or a blank.
    const without = screen.getByText("FRM.0001").closest("tr") as HTMLElement;
    expect(cellUnder(without, "Reviewers")).toHaveTextContent("-");
    expect(cellUnder(without, "Approvers")).toHaveTextContent("-");
    expect(cellUnder(without, "Required Training?")).toHaveTextContent("No");
    expect(cellUnder(without, "Training Period (Days)")).toHaveTextContent("-");
  });

  it("sorts on the server from the four new headers", () => {
    render(<MemoryRouter><DocumentsView viewType="all" /></MemoryRouter>);

    for (const [header, key] of [["Reviewers", "reviewers"], ["Required Training?", "requiresTraining"], ["Training Period (Days)", "trainingPeriodDays"], ["Approvers", "approvers"]]) {
      fireEvent.click(screen.getByRole("columnheader", { name: new RegExp(header.replace(/[?()]/g, "\\$&")) }));
      expect(mocks.handleSort).toHaveBeenLastCalledWith(key);
    }
  });

  it("gives the filters the reviewer, approver and training choices that are applied on the server", () => {
    render(<MemoryRouter><DocumentsView viewType="all" /></MemoryRouter>);

    expect(mocks.filterProps.showReviewerFilter).toBe(true);
    expect(mocks.filterProps.showApproverFilter).toBe(true);
    expect(mocks.filterProps.showRequiresTrainingFilter).toBe(true);
    expect(mocks.filterProps.reviewerFilter).toBe("u-reviewer");
    expect(mocks.filterProps.requiresTrainingFilter).toBe("yes");
    (mocks.filterProps.onReviewerChange as (value: string) => void)("u-other");
    expect(mocks.setReviewer).toHaveBeenCalledWith("u-other");
  });
});
