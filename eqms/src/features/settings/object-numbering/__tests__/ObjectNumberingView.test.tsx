import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/toast/Toast";
import { objectNumberingApi } from "@/services/api/objectNumbering";
import { ObjectNumberingView } from "../ObjectNumberingView";

let canManage = true;
let granted: string[] = [];
vi.mock("@/hooks/usePermissions", () => ({
  usePermissions: () => ({
    hasAnyPermission: (codes: string[]) => (codes.includes("settings.object_numbering.manage") ? canManage : codes.some((code) => granted.includes(code))),
    hasPermission: () => canManage,
  }),
}));
vi.mock("@/components/ui/page/PageHeader", () => ({
  PageHeader: ({ title }: { title: string }) => (
    <header>
      <h1>{title}</h1>
    </header>
  ),
}));
vi.mock("@/services/api/objectNumbering", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  objectNumberingApi: { list: vi.fn(), preview: vi.fn(), update: vi.fn() },
}));

const row = {
  kind: "SCHEDULED_REPORT",
  module: "Reports",
  label: "Scheduled Report Number",
  prefix: "SRP",
  separator: "-",
  includeYear: true,
  digits: 5,
  version: 3,
  example: "SRP-2026-00005",
  lastValue: 4,
};

beforeEach(() => {
  vi.clearAllMocks();
  canManage = true;
  granted = ["documents.admin.name_formats.view", "training.settings.view", "reports.definition.view"];
  vi.mocked(objectNumberingApi.list).mockResolvedValue([row]);
  vi.mocked(objectNumberingApi.preview).mockResolvedValue({ example: "ABC.2026.001", next: "ABC.2026.005" });
  vi.mocked(objectNumberingApi.update).mockResolvedValue({ ...row, prefix: "ABC", version: 4 });
});
afterEach(cleanup);

/** The action menu of the row (three dots), as on the other screens, then its Edit item. */
const openEditor = async () => {
  fireEvent.click(await screen.findByRole("button", { name: "More actions" }));
  fireEvent.click(await screen.findByText("Edit Numbering Format"));
};

const renderView = () =>
  render(
    <ToastProvider>
      <MemoryRouter>
        <ObjectNumberingView />
      </MemoryRouter>
    </ToastProvider>,
  );

it("lists every kind with its next number and where the numbers of other modules are set", async () => {
  renderView();
  expect(await screen.findByText("Scheduled Report Number")).toBeTruthy();
  expect(screen.getByText("SRP-2026-00005")).toBeTruthy();
  // each of them is a link to the screen where that number is set
  expect(screen.getByRole("link", { name: /Document Name Formats/ }).getAttribute("href")).toBe("/documents/administration/name-formats");
  expect(screen.getByRole("link", { name: /Training Code Rules/ }).getAttribute("href")).toBe("/settings/administration/training/code-rules");
  expect(screen.getByRole("link", { name: /Report Name Formats/ }).getAttribute("href")).toBe("/settings/report-name-formats");
});

it("shows a link only to the screens the person may open, and no card when there is none", async () => {
  granted = ["training.settings.view"];
  const { unmount } = renderView();
  await screen.findByText("Scheduled Report Number");
  expect(screen.getByRole("link", { name: /Training Code Rules/ })).toBeTruthy();
  expect(screen.queryByRole("link", { name: /Document Name Formats/ })).toBeNull();
  expect(screen.queryByRole("link", { name: /Report Name Formats/ })).toBeNull();
  unmount();
  cleanup();
  granted = [];
  renderView();
  await screen.findByText("Scheduled Report Number");
  expect(screen.queryByText("Set on the screen of their own module")).toBeNull();
});

it("offers no action menu to a person who may only view", async () => {
  canManage = false;
  renderView();
  await screen.findByText("Scheduled Report Number");
  expect(screen.queryByRole("button", { name: "More actions" })).toBeNull();
});

it("refuses a change without a reason and sends the version that was read with it", async () => {
  renderView();
  await openEditor();
  fireEvent.change(await screen.findByLabelText("Prefix"), { target: { value: "abc" } });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  expect(await screen.findByText("Enter the reason for the change.")).toBeTruthy();
  expect(objectNumberingApi.update).not.toHaveBeenCalled();

  fireEvent.change(screen.getByLabelText("Reason for the change"), { target: { value: "New naming rule" } });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(objectNumberingApi.update).toHaveBeenCalledTimes(1));
  expect(objectNumberingApi.update).toHaveBeenCalledWith("SCHEDULED_REPORT", {
    prefix: "ABC",
    separator: "-",
    includeYear: true,
    digits: 5,
    version: 3,
    reason: "New naming rule",
  });
});

it("refuses a prefix that is not 2 to 10 capital letters or digits", async () => {
  renderView();
  await openEditor();
  fireEvent.change(await screen.findByLabelText("Prefix"), { target: { value: "1" } });
  expect((await screen.findAllByText(/2 to 10 capital letters or digits/)).length).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  expect(objectNumberingApi.update).not.toHaveBeenCalled();
});

it("lets the separator be typed by hand, up to 3 characters and without spaces, and shows one field per row", async () => {
  renderView();
  await openEditor();
  const separator = (await screen.findByLabelText("Separator")) as HTMLInputElement;
  expect(separator.tagName).toBe("INPUT");
  expect(separator.maxLength).toBe(3);
  // one field per row: the form is a single column
  expect(separator.closest(".grid")?.className).toContain("grid-cols-1");
  expect(separator.closest(".grid")?.className).not.toContain("md:grid-cols-2");

  fireEvent.change(separator, { target: { value: "a b" } });
  expect((await screen.findAllByText("The separator is up to 3 characters, without spaces.")).length).toBeGreaterThan(0);

  fireEvent.change(separator, { target: { value: "" } });
  fireEvent.change(screen.getByLabelText("Reason for the change"), { target: { value: "No separator" } });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(objectNumberingApi.update).toHaveBeenCalledTimes(1));
  expect(vi.mocked(objectNumberingApi.update).mock.calls[0][1]).toMatchObject({ separator: "" });
});
