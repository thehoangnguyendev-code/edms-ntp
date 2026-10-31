import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ participantPage: vi.fn() }));
vi.mock("@/services/api/trainingActivities", () => ({ trainingActivitiesApi: api, trainingError: (e: unknown) => String(e) }));
import { TrainingParticipantTable } from "../components/TrainingParticipantTable";
beforeEach(() => api.participantPage.mockReset());
afterEach(cleanup);
it("renders the server page without sorting it and sends session, group, search and page", async () => {
  api.participantPage.mockResolvedValue({ data: [{ id: "z", fullName: "Zoe" }, { id: "a", fullName: "Anne" }], pagination: { total: 21, totalPages: 3 } });
  render(<TrainingParticipantTable activityId="activity" sessionId="session" group="EMPLOYEES" title="Employees" columns={[{ id: "name", header: "Name", cell: p => p.fullName }]} refreshToken={1} />);
  await screen.findByText("Zoe");
  expect(screen.getAllByRole("row").slice(1).map(row => row.textContent)).toEqual(["Zoe", "Anne"]);
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  await waitFor(() => expect(api.participantPage).toHaveBeenLastCalledWith("activity", expect.objectContaining({ sessionId: "session", group: "EMPLOYEES", page: 2, limit: 10 })));
  fireEvent.change(screen.getByRole("textbox", { name: "Search Employees" }), { target: { value: "server-query" } });
  await waitFor(() => expect(api.participantPage).toHaveBeenLastCalledWith("activity", expect.objectContaining({ search: "server-query", page: 1 })));
});
it("ignores a response from a previous session", async () => {
  let finish: (value: unknown) => void = () => {};
  api.participantPage.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
  api.participantPage.mockResolvedValue({ data: [{ id: "new", fullName: "New session" }], pagination: { total: 1, totalPages: 1 } });
  const props = { activityId: "activity", group: "EMPLOYEES", title: "Employees", columns: [{ id: "name", header: "Name", cell: (p: { fullName: string }) => p.fullName }], refreshToken: 1 };
  const view = render(<TrainingParticipantTable {...props} sessionId="old" />);
  view.rerender(<TrainingParticipantTable {...props} sessionId="new" />);
  await screen.findByText("New session");
  finish({ data: [{ id: "old", fullName: "Stale session" }], pagination: { total: 1, totalPages: 1 } });
  await waitFor(() => expect(screen.queryByText("Stale session")).toBeNull());
});
it("sorts on the server by the header of a column, back to page 1, and flips the direction on a second click", async () => {
  api.participantPage.mockResolvedValue({ data: [{ id: "a", fullName: "Anne", department: "QA" }], pagination: { total: 1, totalPages: 1 } });
  render(<TrainingParticipantTable activityId="activity" group="EMPLOYEES" title="Employees" refreshToken={1}
    columns={[{ id: "name", header: "Name", cell: p => p.fullName }, { id: "department", header: "Department", cell: p => p.department }, { id: "trn", header: "Training number", cell: () => "TRN" }]} />);
  await screen.findByText("Anne");
  fireEvent.click(screen.getByText("Department"));
  await waitFor(() => expect(api.participantPage).toHaveBeenLastCalledWith("activity", expect.objectContaining({ sortBy: "department", sortDirection: "asc", page: 1 })));
  fireEvent.click(screen.getByText("Department"));
  await waitFor(() => expect(api.participantPage).toHaveBeenLastCalledWith("activity", expect.objectContaining({ sortBy: "department", sortDirection: "desc" })));
  expect(screen.getByText("Training number").closest("th")?.querySelector("button")).toBeNull();
});
const cols = [{ id: "name", header: "Name", cell: (p: { fullName: string }) => p.fullName }];
it("draws nothing for a group other than the employees until its first answer arrives, and nothing at all when the group is empty", async () => {
  let finish: (value: unknown) => void = () => {};
  api.participantPage.mockReturnValue(new Promise(resolve => { finish = resolve; }));
  const { container } = render(<TrainingParticipantTable activityId="activity" group="EXTERNAL" title="Outside persons" columns={cols} refreshToken={1} />);
  expect(container.textContent).toBe("");
  expect(screen.queryByText(/Loading participants/)).toBeNull();
  finish({ data: [], pagination: { total: 0, totalPages: 0 } });
  await waitFor(() => expect(api.participantPage).toHaveBeenCalledTimes(1));
  expect(container.textContent).toBe("");
});
it("shows the employees group at once, without a count until the answer arrives (no (0) that turns into the real number)", async () => {
  let finish: (value: unknown) => void = () => {};
  api.participantPage.mockReturnValue(new Promise(resolve => { finish = resolve; }));
  render(<TrainingParticipantTable activityId="activity" group="EMPLOYEES" title="Employees" columns={cols} refreshToken={1} />);
  expect(screen.getByText("Employees")).toBeTruthy();
  expect(screen.queryByText("Employees (0)")).toBeNull();
  finish({ data: [{ id: "a", fullName: "Anne" }], pagination: { total: 1, totalPages: 1 } });
  expect(await screen.findByText("Employees (1)")).toBeTruthy();
});
it("a refresh that only follows a change of the activity keeps the rows on the screen (no loading state again)", async () => {
  api.participantPage.mockResolvedValueOnce({ data: [{ id: "a", fullName: "Anne" }], pagination: { total: 1, totalPages: 1 } });
  let finish: (value: unknown) => void = () => {};
  api.participantPage.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
  const view = render(<TrainingParticipantTable activityId="activity" group="EMPLOYEES" title="Employees" columns={cols} refreshToken={1} />);
  await screen.findByText("Anne");
  view.rerender(<TrainingParticipantTable activityId="activity" group="EMPLOYEES" title="Employees" columns={cols} refreshToken={2} />);
  await waitFor(() => expect(api.participantPage).toHaveBeenCalledTimes(2));
  expect(screen.getByText("Anne")).toBeTruthy();
  expect(screen.queryByText(/Loading participants/)).toBeNull();
  finish({ data: [{ id: "a", fullName: "Anne" }, { id: "b", fullName: "Bao" }], pagination: { total: 2, totalPages: 1 } });
  expect(await screen.findByText("Bao")).toBeTruthy();
});
