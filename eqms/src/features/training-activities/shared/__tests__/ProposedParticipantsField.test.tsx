import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ getPage: vi.fn(), replace: vi.fn(), people: vi.fn(), peopleGroups: vi.fn(), peopleInGroups: vi.fn() }));
vi.mock("@/services/api/trainingActivities", () => ({ trainingProposalApi: api, trainingError: (e: unknown) => String(e) }));
vi.mock("@/features/realtime/useEntityChanged", () => ({ useEntityChanged: () => undefined }));

import { ProposedParticipantsField } from "../ProposedParticipantsField";

const person = { personId: "p1", fullName: "Anne Tran", employeeCode: "E-001", department: "QA", position: "Specialist", avatar: null };

beforeEach(() => { Object.values(api).forEach((f) => f.mockReset()); api.peopleGroups.mockResolvedValue([]); api.people.mockResolvedValue([]); });
afterEach(cleanup);

describe("ProposedParticipantsField", () => {
  it("lets the people be chosen before the document is saved and keeps them for the form", () => {
    const onPending = vi.fn();
    render(<ProposedParticipantsField documentId={null} pending={[person]} onPendingChange={onPending} />);

    expect(screen.getByText(/saved with the document/)).toBeTruthy();
    expect(screen.getByText("Anne Tran")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Edit Participants/ })).toBeTruthy();
    expect(api.getPage).not.toHaveBeenCalled();
  });

  it("takes a person off the list the form keeps without asking the server", () => {
    const onPending = vi.fn();
    render(<ProposedParticipantsField documentId={null} pending={[person]} onPendingChange={onPending} />);

    fireEvent.click(screen.getByRole("button", { name: "More actions" }));
    fireEvent.click(screen.getByText("Remove"));

    expect(onPending).toHaveBeenCalledWith([]);
    expect(api.replace).not.toHaveBeenCalled();
  });

  it("says there is no training activity when the document has none yet", async () => {
    api.getPage.mockResolvedValue({ available: false, editable: false, people: [] });
    render(<ProposedParticipantsField documentId="d1" />);

    expect(await screen.findByText(/no training activity for this document yet/)).toBeTruthy();
  });

  it("lists the proposed people and offers Edit Participants only to a person who may edit", async () => {
    api.getPage.mockResolvedValue({ available: true, editable: true, trainingNumber: "TR-1", people: [person] });
    render(<ProposedParticipantsField documentId="d1" />);

    expect(await screen.findByText("Anne Tran")).toBeTruthy();
    expect(screen.getByText("E-001")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Edit Participants/ })).toBeTruthy();
  });

  it("only shows the list, without Edit Participants, when the person cannot edit", async () => {
    api.getPage.mockResolvedValue({ available: true, editable: false, people: [person] });
    render(<ProposedParticipantsField documentId="d1" />);

    await waitFor(() => expect(screen.getByText("Anne Tran")).toBeTruthy());
    expect(screen.queryByRole("button", { name: /Edit Participants/ })).toBeNull();
  });

  it("shows ten people a page", async () => {
    const many = Array.from({ length: 12 }, (_v, i) => ({ ...person, personId: `p${i}`, fullName: `Person ${String(i + 1).padStart(2, "0")}` }));
    api.getPage.mockImplementation((_id, page) => Promise.resolve({ available: true, editable: true, people: page === 1 ? many.slice(0, 10) : many.slice(10), personIds: many.map(p => p.personId), pagination: { total: 12, totalPages: 2 } }));
    render(<ProposedParticipantsField documentId="d1" />);

    expect(await screen.findByText("Person 10")).toBeTruthy();
    expect(screen.queryByText("Person 11")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText("Person 11")).toBeTruthy();
    expect(api.getPage).toHaveBeenLastCalledWith("d1", 2, 10);
  });

  it("offers Add Participants while nobody is on the list, and Edit Participants once somebody is", async () => {
    api.getPage.mockResolvedValue({ available: true, editable: true, people: [] });
    const empty = render(<ProposedParticipantsField documentId="d1" />);

    expect(await screen.findByRole("button", { name: /Add Participants/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Edit Participants/ })).toBeNull();
    empty.unmount();

    api.getPage.mockResolvedValue({ available: true, editable: true, people: [person] });
    render(<ProposedParticipantsField documentId="d1" />);
    expect(await screen.findByRole("button", { name: /Edit Participants/ })).toBeTruthy();
  });
});
