import { beforeEach, describe, expect, it, vi } from "vitest";

const get = vi.fn();
vi.mock("../client", () => ({ api: { get: (...args: unknown[]) => get(...args), post: vi.fn(), put: vi.fn() } }));
import { documentApi } from "../documents";

describe("document filter people lookups", () => {
  beforeEach(() => get.mockReset());

  it("searches the dedicated server endpoint, including an empty query", async () => {
    get.mockResolvedValue({ data: [{ label: "Author", value: "user-id" }] });
    const result = await documentApi.getDocumentFilters("");
    expect(get).toHaveBeenCalledWith("/documents/filter-authors", { params: { search: "" } });
    expect(result.authors).toEqual([{ label: "Author", value: "user-id" }]);
  });

  it("retains selected user labels without requesting the entire user directory", async () => {
    get.mockResolvedValue({ data: { statuses: [], documentTypes: [], businessUnits: [], departments: [], authors: [] } });
    await documentApi.getDocumentFilters(undefined, ["user-b", "All", "user-a", "user-b"]);
    expect(get).toHaveBeenCalledWith("/documents/filters", { params: { selectedUsers: "user-a,user-b" } });
  });

  it("a caller-owned abort does not reuse another consumer's shared request", async () => {
    get.mockResolvedValue({ data: { data: [], pagination: { total: 0 } } });
    const controller = new AbortController();
    await documentApi.getDocumentsPage({ search: "Form" }, controller.signal);
    expect(get.mock.calls[0][1]).toEqual({ signal: controller.signal });
  });
});
