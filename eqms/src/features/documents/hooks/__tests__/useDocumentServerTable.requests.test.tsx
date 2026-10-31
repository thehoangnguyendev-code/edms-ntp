import React from "react";
import { act, renderHook } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDocumentServerTable } from "../useDocumentServerTable";

const mocks = vi.hoisted(() => ({ getDocumentsPage: vi.fn(), getDocumentFilters: vi.fn(), showToast: vi.fn() }));
vi.mock("@/services/api/documents", () => ({ documentApi: mocks }));
vi.mock("@/features/realtime/useEntityChanged", () => ({ useEntityChanged: vi.fn() }));
vi.mock("@/components/ui/toast", () => ({ useToast: () => ({ showToast: mocks.showToast }) }));
const wrapper = ({ children }: { children: React.ReactNode }) => <MemoryRouter>{children}</MemoryRouter>;

describe("document table request lifecycle", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mocks.getDocumentFilters.mockResolvedValue({ statuses: [], documentTypes: [], businessUnits: [], departments: [], authors: [] });
    mocks.getDocumentsPage.mockResolvedValue({ data: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 1 } });
  });
  afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); });

  it("only fetches the committed search once and aborts the superseded request", async () => {
    const { result, unmount } = renderHook(() => useDocumentServerTable({ viewType: "all", currentUser: null }), { wrapper });
    await act(async () => {});
    expect(mocks.getDocumentsPage).toHaveBeenCalledTimes(1);
    const initialSignal = mocks.getDocumentsPage.mock.calls[0][1] as AbortSignal;
    act(() => result.current.setSearchQuery("Form"));
    expect(mocks.getDocumentsPage).toHaveBeenCalledTimes(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(400); });
    expect(mocks.getDocumentsPage).toHaveBeenCalledTimes(2);
    expect(mocks.getDocumentsPage.mock.calls[1][0].search).toBe("Form");
    expect(initialSignal.aborted).toBe(true);
    unmount();
  });
});
