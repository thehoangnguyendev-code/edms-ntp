import "../../testing/browserStubs";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ recipientPeople: vi.fn(), recipientGroups: vi.fn() }));
vi.mock("@/services/api/reports", () => ({ reportsApi: api }));
// The picker of the people of a Training is the same one; its own source is not used here.
vi.mock("@/services/api/trainingActivities", () => ({ trainingProposalApi: { queryPeople: vi.fn(), peopleGroups: vi.fn() } }));

import { ScheduleRecipientsField } from "../ScheduleRecipientsField";

const anne = { id: "a", fullName: "Anne Tran", employeeCode: "E-001", username: "anne", email: "anne@example.test", department: "QA", position: "Specialist", businessUnit: "Plant" };
const bob = { id: "b", fullName: "Bob Le", employeeCode: "E-002", username: "bob", email: "bob@example.test", department: "QC", position: "Analyst", businessUnit: "Plant" };

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset());
  api.recipientGroups.mockResolvedValue([{ name: "QA", total: 1 }]);
  api.recipientPeople.mockResolvedValue({ data: [anne, bob], pagination: { page: 1, limit: 20, total: 2, totalPages: 1 } });
});
afterEach(cleanup);

describe("ScheduleRecipientsField", () => {
  it("shows the recipients as the people of a Training are shown: the count, the table, and Edit Recipients", () => {
    render(<ScheduleRecipientsField people={[anne]} onChange={vi.fn()} />);

    expect(screen.getByText("List of recipients (1)")).toBeInTheDocument();
    for (const header of ["Employee ID", "Full Name", "Username", "Email", "Department", "Position"]) expect(screen.getByText(header)).toBeInTheDocument();
    expect(screen.getByText("E-001")).toBeInTheDocument();
    expect(screen.getByText("Anne Tran")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit Recipients" })).toBeInTheDocument();
  });

  it("an empty list says what to do, and offers Add Recipients", () => {
    render(<ScheduleRecipientsField people={[]} onChange={vi.fn()} />);

    expect(screen.getByText("No recipient selected")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add Recipients" })).toBeInTheDocument();
  });

  it("Remove in the menu of a row takes the person off the list", async () => {
    const onChange = vi.fn();
    render(<ScheduleRecipientsField people={[anne, bob]} onChange={onChange} />);

    fireEvent.click(screen.getAllByLabelText("More actions")[0]);
    fireEvent.click(await screen.findByText("Remove"));

    expect(onChange).toHaveBeenCalledWith([bob]);
  });

  it("the window looks for the people through the server, and Save sends the people who are ticked", async () => {
    const onChange = vi.fn();
    render(<ScheduleRecipientsField people={[]} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Add Recipients" }));
    const dialog = await screen.findByRole("dialog");
    await within(dialog).findByText("Anne Tran");
    expect(api.recipientPeople).toHaveBeenCalledWith({ search: undefined, businessUnit: undefined, department: undefined, page: 1, limit: 20 });
    expect(api.recipientGroups).toHaveBeenCalledWith("BUSINESS_UNIT");
    expect(api.recipientGroups).toHaveBeenCalledWith("DEPARTMENT");

    fireEvent.click(within(dialog).getByText("Anne Tran"));
    fireEvent.click(within(dialog).getByRole("button", { name: "Save (1)" }));

    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
    expect(onChange.mock.calls[0][0].map((person: { id: string }) => person.id)).toEqual(["a"]);
  });

  it("a person who may not manage the schedule sees the list and no button, no menu", () => {
    render(<ScheduleRecipientsField people={[anne]} onChange={vi.fn()} disabled />);

    expect(screen.getByText("Anne Tran")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Recipients$/ })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("More actions")).not.toBeInTheDocument();
  });
});
