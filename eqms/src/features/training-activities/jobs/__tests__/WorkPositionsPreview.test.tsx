import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { WorkPositionsPreview } from "../WorkPositionsPreview";

const fetchPositions = vi.hoisted(() => vi.fn());
const fetchPersonPositions = vi.hoisted(() => vi.fn());
vi.mock("@/services/api/trainingActivities", () => ({ trainingJobsApi: { positions: fetchPositions }, trainingMatrixApi: { personPositionDetails: fetchPersonPositions } }));
vi.mock("@/components/ui/drawer", () => ({ Drawer: ({ open, children }: { open: boolean; children: React.ReactNode }) => open ? <div role="dialog">{children}</div> : null }));

afterEach(() => vi.clearAllMocks());

it("preserves names containing commas, shows the remaining count and searches on the server", async () => {
  const positions = [{ id: "1", name: "Quality, Senior", carried: true }, { id: "2", name: "Analyst", carried: false }, { id: "3", name: "Reviewer", carried: false }];
  fetchPositions.mockResolvedValue({ data: positions, pagination: { page: 1, limit: 20, total: 3, totalPages: 1 } });
  render(<WorkPositionsPreview assignmentId="job-1" personName="Trainee" positions={positions} />);
  expect(screen.getByText("Quality, Senior (held before)")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "View all work positions for Trainee" }));
  await waitFor(() => expect(fetchPositions).toHaveBeenCalledWith("job-1", "", 1));
  expect(await within(screen.getByRole("dialog")).findByText("Quality, Senior")).toBeTruthy();
  expect(screen.getByText("Held before")).toBeTruthy();
  fireEvent.change(screen.getByRole("textbox", { name: "Search work positions" }), { target: { value: "Reviewer" } });
  await waitFor(() => expect(fetchPositions).toHaveBeenCalledWith("job-1", "Reviewer", 1));
});

it("uses the person's held positions and searches them on the server", async () => {
  fetchPersonPositions.mockResolvedValue({ data: [{ id: "p1", name: "Quality, Senior", carried: false }], pagination: { page: 1, limit: 20, total: 1, totalPages: 1 } });
  render(<WorkPositionsPreview personId="user-1" personName="Trainee" positions={[{ id: "1", name: "Quality, Senior", carried: false }]} totalCount={5} />);
  fireEvent.click(screen.getByRole("button", { name: "View all work positions for Trainee" }));
  await waitFor(() => expect(fetchPersonPositions).toHaveBeenCalledWith("user-1", "", 1));
  expect(await within(screen.getByRole("dialog")).findByText("Quality, Senior")).toBeTruthy();
  fireEvent.change(screen.getByRole("textbox", { name: "Search work positions" }), { target: { value: "Senior" } });
  await waitFor(() => expect(fetchPersonPositions).toHaveBeenCalledWith("user-1", "Senior", 1));
  expect(fetchPositions).not.toHaveBeenCalled();
});

it("loads more pages on demand and restarts server search at page one", async () => {
  fetchPositions.mockImplementation(async (_id: string, search: string, page: number) => ({
    data: [{ id: `${search}-${page}`, name: search || `Position ${page}`, carried: false }],
    pagination: { page, limit: 1, total: search ? 1 : 2, totalPages: search ? 1 : 2 },
  }));
  render(<WorkPositionsPreview assignmentId="job-2" personName="Trainee" positions={[{ id: "1", name: "A", carried: false }, { id: "2", name: "B", carried: false }, { id: "3", name: "C", carried: false }]} />);
  fireEvent.click(screen.getByRole("button", { name: "View all work positions for Trainee" }));
  expect(await screen.findByText("Position 1")).toBeTruthy();
  fireEvent.click(await screen.findByRole("button", { name: "Load more" }));
  expect(await screen.findByText("Position 2")).toBeTruthy();
  expect(screen.getByText("2.")).toBeTruthy();
  fireEvent.change(screen.getByRole("textbox", { name: "Search work positions" }), { target: { value: "Reviewer" } });
  await waitFor(() => expect(fetchPositions).toHaveBeenCalledWith("job-2", "Reviewer", 1));
  expect(await screen.findByText("Reviewer")).toBeTruthy();
  expect(screen.queryByText("Position 2")).toBeNull();
});
