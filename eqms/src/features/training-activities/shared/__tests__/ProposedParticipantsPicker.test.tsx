import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ queryPeople: vi.fn(), peopleGroups: vi.fn(), peopleInGroups: vi.fn() }));
vi.mock("@/services/api/trainingActivities", () => ({ trainingProposalApi: api }));

import { ProposedParticipantsPicker } from "../ProposedParticipantsPicker";

const anne = { id: "a", fullName: "Anne Tran", employeeCode: "E-001", department: "QA", position: "Specialist", businessUnit: "Plant" };
const bob = { id: "b", fullName: "Bob Le", employeeCode: "E-002", department: "QC", position: "Analyst", businessUnit: "Plant" };

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset());
  api.peopleGroups.mockResolvedValue([]);
  api.queryPeople.mockResolvedValue({ data: [anne, bob], pagination: { total: 2, totalPages: 1 } });
});
afterEach(cleanup);

describe("ProposedParticipantsPicker", () => {
  it("lists people on one screen, selects all shown at once and reports the ids", async () => {
    const onChange = vi.fn();
    render(<ProposedParticipantsPicker initialIds={[]} onChange={onChange} />);

    expect(await screen.findByText("Anne Tran")).toBeTruthy();
    fireEvent.click(screen.getByLabelText(/Select all shown/));
    expect(onChange).toHaveBeenLastCalledWith(["a", "b"], expect.any(Array));
    expect(screen.getByText("2 selected")).toBeTruthy();
  });

  it("opens with the people already proposed ticked, and unticking one takes the person off", async () => {
    const onChange = vi.fn();
    render(<ProposedParticipantsPicker initialIds={["a", "b"]} onChange={onChange} />);

    await screen.findByText("Anne Tran");
    expect(screen.getByText("2 selected")).toBeTruthy();
    fireEvent.click(screen.getByText("Anne Tran"));
    expect(onChange).toHaveBeenLastCalledWith(["b"], expect.any(Array));
    expect(screen.getByText("1 selected")).toBeTruthy();
  });

  it("clears every person shown with Select all shown when all are ticked", async () => {
    const onChange = vi.fn();
    render(<ProposedParticipantsPicker initialIds={["a", "b"]} onChange={onChange} />);

    await screen.findByText("Anne Tran");
    fireEvent.click(screen.getByLabelText(/Select all shown/));
    expect(onChange).toHaveBeenLastCalledWith([], expect.any(Array));
  });

  it("searches on the server by name or employee ID when no group is chosen", async () => {
    render(<ProposedParticipantsPicker initialIds={[]} onChange={vi.fn()} />);
    await screen.findByText("Anne Tran");

    fireEvent.change(screen.getByLabelText("Search people"), { target: { value: "E-002" } });

    await waitFor(() => expect(api.queryPeople).toHaveBeenLastCalledWith({ search: "E-002", businessUnit: undefined, department: undefined, page: 1, limit: 20 }));
  });
});
