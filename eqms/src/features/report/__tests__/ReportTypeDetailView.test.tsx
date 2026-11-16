import "../testing/browserStubs";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ReportTypeDetailView } from "../types/ReportTypeDetailView";
import { reportTypesApi } from "@/services/api/reportTypes";

vi.mock("@/components/ui/page/PageHeader", () => ({
  PageHeader: ({ title, actions }: any) => (
    <header>
      <h1>{title}</h1>
      {actions}
    </header>
  ),
}));
vi.mock("@/services/api/reportTypes", () => ({ reportTypesApi: { detail: vi.fn() } }));

const detail = {
  code: "CONTROLLED_COPIES",
  name: "Controlled Copies",
  category: "Documents",
  description: "Controlled copies with their document, purpose and status.",
  enabled: true,
  version: 1,
  templateCount: 1,
  usePermissions: [] as string[],
  requiredPermissions: [] as string[],
  columns: [
    { code: "copyNumber", label: "Controlled Copy Number", type: "TEXT", required: true },
    { code: "createdAt", label: "Created", type: "DATE", required: false },
  ],
  filters: [
    { code: "status", label: "Status", type: "LOOKUP" },
    { code: "requestedFrom", label: "Requested from", type: "DATE" },
  ],
};

beforeEach(() => vi.mocked(reportTypesApi.detail).mockResolvedValue(detail as never));
afterEach(cleanup);

function renderView() {
  render(
    <MemoryRouter initialEntries={["/settings/report-types/CONTROLLED_COPIES"]}>
      <Routes>
        <Route path="/settings/report-types/:code" element={<ReportTypeDetailView />} />
      </Routes>
    </MemoryRouter>,
  );
}

it("is named by its function, and shows the general information, the access, the columns and the filters in sections of their own", async () => {
  renderView();
  expect(await screen.findByRole("heading", { name: "Report Type Details" })).toBeInTheDocument();
  expect(await screen.findByText("General Information")).toBeInTheDocument();
  expect(screen.getByText("Enabled")).toBeInTheDocument();
  expect(screen.getByText("Controlled Copies")).toBeInTheDocument();
  expect(screen.getByText(/needs no permission of its own/)).toBeInTheDocument();
  expect(screen.getByText("Controlled Copy Number")).toBeInTheDocument();
  expect(screen.getByText("copyNumber")).toBeInTheDocument();
  expect(screen.getByText("Requested from")).toBeInTheDocument();
  expect(screen.getByText("2 columns a report can show")).toBeInTheDocument();
  expect(screen.getByText("2 filters a report can use")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Back" })).toBeInTheDocument();
});

it("names the permissions a person needs, all of them or one of them", async () => {
  vi.mocked(reportTypesApi.detail).mockResolvedValue({ ...detail, enabled: false, requiredPermissions: ["documents.view"], usePermissions: ["reports.run.create", "report.module.export"] } as never);
  renderView();
  expect(await screen.findByText("Needs all of")).toBeInTheDocument();
  expect(screen.getByText("documents.view")).toBeInTheDocument();
  expect(screen.getByText("Needs one of")).toBeInTheDocument();
  expect(screen.getByText("report.module.export")).toBeInTheDocument();
  expect(screen.getByText("Disabled")).toBeInTheDocument();
});
