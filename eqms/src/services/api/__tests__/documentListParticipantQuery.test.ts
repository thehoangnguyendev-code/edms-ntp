import { beforeEach, describe, expect, it, vi } from "vitest";

const get = vi.fn();
vi.mock("../client", () => ({ api: { get: (...a: unknown[]) => get(...a), post: vi.fn(), put: vi.fn() } }));

import { documentApi } from "../documents";

describe("Documents list: reviewer, approver and training filters travel to the server", () => {
  beforeEach(() => {
    get.mockReset().mockResolvedValue({ data: { data: [], pagination: { total: 0, totalPages: 1 } } });
  });

  it("sends reviewerId, approverId, requiresTraining and the new sort keys in the list request", async () => {
    await documentApi.getDocumentsPage({ reviewerId: "u1", approverId: "u2", requiresTraining: "yes", sortBy: "reviewers", sortDirection: "asc" });

    const url = String(get.mock.calls[0][0]);
    const query = new URLSearchParams(url.split("?")[1]);
    expect(query.get("reviewerId")).toBe("u1");
    expect(query.get("approverId")).toBe("u2");
    expect(query.get("requiresTraining")).toBe("yes");
    expect(query.get("sortBy")).toBe("reviewers");
    expect(query.get("sortDirection")).toBe("asc");
  });

  it("sends the same filters to the CSV export, so the file matches what the table shows", async () => {
    get.mockResolvedValue({ data: new Blob(["x"]) });

    await documentApi.exportDocumentsPage({ reviewerId: "u1", approverId: "u2", requiresTraining: "no" });

    const query = new URLSearchParams(String(get.mock.calls[0][0]).split("?")[1]);
    expect(query.get("reviewerId")).toBe("u1");
    expect(query.get("approverId")).toBe("u2");
    expect(query.get("requiresTraining")).toBe("no");
  });

  it("leaves the filters out when none is chosen", async () => {
    await documentApi.getDocumentsPage({});

    const query = new URLSearchParams(String(get.mock.calls[0][0]).split("?")[1]);
    for (const key of ["reviewerId", "approverId", "requiresTraining"]) {
      expect(query.has(key)).toBe(false);
    }
  });
});
