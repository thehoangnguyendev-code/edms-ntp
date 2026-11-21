import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TableExportModal, estimateExportBytes, formatBytes } from "../TableExportModal";
import { fetchTableExportColumns } from "@/services/api/tableExport";

vi.mock("@/services/api/tableExport", () => ({ fetchTableExportColumns: vi.fn() }));

const COLUMNS = ["Code", "Name", "Created At"];

beforeEach(() => {
  vi.mocked(fetchTableExportColumns).mockResolvedValue(COLUMNS);
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const open = (onExport = vi.fn().mockResolvedValue(undefined), onClose = vi.fn(), totalRecords?: number) => {
  render(<TableExportModal isOpen onClose={onClose} dataset="users" title="Users" totalRecords={totalRecords} onExport={onExport} />);
  return { onExport, onClose };
};

describe("TableExportModal", () => {
  it("lists the columns the server returns, all ticked, with Excel chosen", async () => {
    open();
    expect(await screen.findByLabelText("Name")).toBeChecked();
    expect(fetchTableExportColumns).toHaveBeenCalledWith("users");
    expect(screen.getByRole("radio", { name: /Excel/ })).toBeChecked();
    expect(screen.getByText("3 of 3 columns")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Export Excel" })).toBeEnabled();
  });

  it("exports every column when none was unticked (no column list is sent)", async () => {
    const { onExport, onClose } = open();
    await screen.findByLabelText("Name");
    fireEvent.click(screen.getByRole("button", { name: "Export Excel" }));
    await waitFor(() => expect(onExport).toHaveBeenCalledWith({ format: "xlsx", columns: undefined }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("sends the chosen format and only the ticked columns", async () => {
    const { onExport } = open();
    fireEvent.click(await screen.findByRole("radio", { name: /CSV/ }));
    fireEvent.click(screen.getByLabelText("Code"));
    fireEvent.click(screen.getByRole("button", { name: "Export CSV" }));
    await waitFor(() => expect(onExport).toHaveBeenCalledWith({ format: "csv", columns: ["Name", "Created At"] }));
  });

  it("cannot export with no column ticked", async () => {
    open();
    fireEvent.click(await screen.findByLabelText("Select all"));
    expect(screen.getByText("0 of 3 columns")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Export Excel" })).toBeDisabled();
    fireEvent.click(screen.getByLabelText("Select all"));
    expect(screen.getByRole("button", { name: "Export Excel" })).toBeEnabled();
  });

  it("shows an estimate that follows the format and the ticked columns", async () => {
    open(undefined, undefined, 1000);
    await screen.findByLabelText("Name");
    const excel = formatBytes(estimateExportBytes("xlsx", 1000, 3));
    expect(screen.getByText(`About ${excel} · 1,000 records`)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: /CSV/ }));
    expect(screen.getByText(`About ${formatBytes(estimateExportBytes("csv", 1000, 3))} · 1,000 records`)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Code"));
    expect(screen.getByText(`About ${formatBytes(estimateExportBytes("csv", 1000, 2))} · 1,000 records`)).toBeInTheDocument();
  });

  it("says so when the columns cannot be loaded and keeps Export disabled", async () => {
    vi.mocked(fetchTableExportColumns).mockRejectedValue(new Error("down"));
    open();
    expect(await screen.findByRole("alert")).toHaveTextContent("columns could not be loaded");
    expect(screen.getByRole("button", { name: "Export Excel" })).toBeDisabled();
  });
});

describe("export size helpers", () => {
  it("grows with the records and the columns, CSV bigger than Excel", () => {
    expect(estimateExportBytes("xlsx", 2000, 5)).toBeGreaterThan(estimateExportBytes("xlsx", 1000, 5));
    expect(estimateExportBytes("csv", 1000, 6)).toBeGreaterThan(estimateExportBytes("csv", 1000, 3));
    expect(estimateExportBytes("csv", 1000, 4)).toBeGreaterThan(estimateExportBytes("xlsx", 1000, 4));
  });
  it("prints readable sizes", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
  });
});
