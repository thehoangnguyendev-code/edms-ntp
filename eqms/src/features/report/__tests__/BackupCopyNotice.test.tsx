import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { BackupCopyNotice } from "../shared/BackupCopyNotice";
import { reportsApi } from "@/services/api/reports";

vi.mock("@/services/api/reports", async (original) => {
  const actual = await original<typeof import("@/services/api/reports")>();
  return { ...actual, reportsApi: { ...actual.reportsApi, backupCopyStatus: vi.fn() } };
});

const status = (over: object = {}) => ({ enabled: true, lastAttemptAt: "2026-11-15T02:10:00Z", lastSuccessAt: "2026-11-15T02:10:00Z", lastRows: 201, lastError: null, stale: false, staleAfterMinutes: 30, ...over });

describe("BackupCopyNotice", () => {
  beforeEach(() => vi.mocked(reportsApi.backupCopyStatus).mockReset());

  it("says when the copy was last refreshed when it is current", async () => {
    vi.mocked(reportsApi.backupCopyStatus).mockResolvedValue(status());
    render(<BackupCopyNotice />);
    expect(await screen.findByText(/last refreshed/i)).toBeInTheDocument();
  });

  it("warns that the report may be out of date and names the last problem", async () => {
    vi.mocked(reportsApi.backupCopyStatus).mockResolvedValue(status({ stale: true, lastError: "SQLException: connection refused" }));
    render(<BackupCopyNotice />);
    expect(await screen.findByText(/may be out of date/i)).toBeInTheDocument();
    expect(screen.getByText(/connection refused/)).toBeInTheDocument();
  });

  it("says the copy is switched off", async () => {
    vi.mocked(reportsApi.backupCopyStatus).mockResolvedValue(status({ enabled: false, lastSuccessAt: null }));
    render(<BackupCopyNotice />);
    expect(await screen.findByText(/switched off/i)).toBeInTheDocument();
  });
});
