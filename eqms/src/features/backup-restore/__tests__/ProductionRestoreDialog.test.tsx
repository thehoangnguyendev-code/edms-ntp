import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProductionRestoreDialog } from "../components/ProductionRestoreDialog";

const api = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock("@/services/api/backupRestore", async () => {
  const actual = await vi.importActual<typeof import("@/services/api/backupRestore")>("@/services/api/backupRestore");
  return { ...actual, backupRestoreApi: api };
});

const row = (n: number, parts: string[] = ["DATABASE", "OBJECT_STORE"]) => ({
  id: `BK-2026110${n}-0001`,
  type: "FULL",
  trigger: "MANUAL",
  status: "COMPLETED",
  startedAt: `2026-11-0${n}T01:00:00Z`,
  components: parts.map((key) => ({ key, status: "COMPLETED", sizeBytes: 1, sha256: "a" })),
});
const page = (rows: ReturnType<typeof row>[], total: number, number = 1) => ({ data: rows, pagination: { page: number, limit: 5, total, totalPages: Math.max(1, Math.ceil(total / 5)) } });

beforeEach(() => {
  api.list.mockReset();
  api.list.mockResolvedValue(page([row(1), row(2), row(3)], 7));
});
afterEach(cleanup);

const open = (onContinue = vi.fn(), initialBackup?: string) => render(<ProductionRestoreDialog isOpen onClose={() => {}} onContinue={onContinue} initialBackup={initialBackup} />);

describe("Restore a Backup: choosing the backup in a table", () => {
  it("lists the verified backups five to a page, asked of the server, newest first", async () => {
    open();
    await screen.findByText("BK-20261101-0001");
    expect(api.list).toHaveBeenCalledWith({ status: "COMPLETED", verification: "VERIFIED", sortBy: "startedAt", sortDirection: "desc", page: 1, limit: 5 });
    fireEvent.click(screen.getByRole("button", { name: /Next/ }));
    await waitFor(() => expect(api.list).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2, limit: 5 })));
  });

  it("chooses one backup with the checkbox in its row, shows what it holds, and continues only after the confirmation", async () => {
    const onContinue = vi.fn();
    open(onContinue);
    await screen.findByText("BK-20261102-0001");
    const next = () => screen.getByRole("button", { name: "Continue to Sign" }) as HTMLButtonElement;
    expect(next().disabled).toBe(true);
    fireEvent.click(screen.getByRole("checkbox", { name: "Choose BK-20261102-0001" }));
    expect((screen.getByRole("checkbox", { name: "Choose BK-20261102-0001" }) as HTMLInputElement).checked).toBe(true);
    // choosing another unticks the first: only one backup is restored
    fireEvent.click(screen.getByRole("checkbox", { name: "Choose BK-20261103-0001" }));
    expect((screen.getByRole("checkbox", { name: "Choose BK-20261102-0001" }) as HTMLInputElement).checked).toBe(false);
    expect(await screen.findByRole("checkbox", { name: "Database" })).toBeTruthy();
    expect(next().disabled).toBe(true);
    fireEvent.click(screen.getByRole("checkbox", { name: /I understand/ }));
    expect(next().disabled).toBe(false);
    fireEvent.click(next());
    expect(onContinue).toHaveBeenCalledWith("BK-20261103-0001", ["DATABASE", "OBJECT_STORE"]);
  });

  it("keeps the backup chosen while the person turns the page", async () => {
    open();
    await screen.findByText("BK-20261101-0001");
    fireEvent.click(screen.getByRole("checkbox", { name: "Choose BK-20261101-0001" }));
    api.list.mockResolvedValue(page([row(4)], 7, 2));
    fireEvent.click(screen.getByRole("button", { name: /Next/ }));
    await screen.findByText("BK-20261104-0001");
    expect(screen.getByRole("checkbox", { name: "Database" })).toBeTruthy();
  });

  it("chooses the backup it was opened for, even when it is not on the first page", async () => {
    api.list.mockImplementation(async (params: { search?: string }) => (params.search ? page([row(5)], 1) : page([row(1)], 7)));
    open(vi.fn(), "BK-20261105-0001");
    expect(await screen.findByRole("checkbox", { name: "Database" })).toBeTruthy();
  });

  it("searches the backups on the server after the person pauses, from the first page", async () => {
    open();
    await screen.findByText("BK-20261101-0001");
    fireEvent.click(screen.getByRole("button", { name: /Next/ }));
    await waitFor(() => expect(api.list).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 })));
    api.list.mockResolvedValue(page([row(3)], 1));
    fireEvent.change(screen.getByRole("textbox", { name: "Search backups" }), { target: { value: "20261103" } });
    await waitFor(() => expect(api.list).toHaveBeenLastCalledWith(expect.objectContaining({ search: "20261103", page: 1, limit: 5 })));
    expect(await screen.findByText("BK-20261103-0001")).toBeTruthy();
  });

  it("says so when the backups could not be read", async () => {
    api.list.mockRejectedValue(new Error("network"));
    open();
    expect(await screen.findByText(/network|could not be loaded/)).toBeTruthy();
  });

  it("started from one backup's page: lists only that backup, already chosen, with no search or paging", async () => {
    api.list.mockResolvedValue(page([row(1), row(2)], 2));
    render(<ProductionRestoreDialog isOpen onClose={() => {}} onContinue={() => {}} onlyBackup="BK-20261102-0001" />);
    await screen.findByText("BK-20261102-0001");
    expect(screen.queryByText("BK-20261101-0001")).toBeNull();
    expect((screen.getByRole("checkbox", { name: "Choose BK-20261102-0001" }) as HTMLInputElement).checked).toBe(true);
    expect(screen.queryByRole("textbox", { name: "Search backups" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Next/ })).toBeNull();
  });

  it("tells the parts apart by colour and keeps the badges apart", async () => {
    open();
    const database = (await screen.findAllByText("Database"))[0];
    const files = screen.getAllByText("Files")[0];
    expect(database.className).not.toBe(files.className);
    expect(database.parentElement?.className).toContain("gap-2");
  });
});
