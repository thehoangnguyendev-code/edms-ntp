import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ get: vi.fn(), replace: vi.fn(), people: vi.fn(), peopleGroups: vi.fn(), peopleInGroups: vi.fn() }));
vi.mock("@/services/api/trainingActivities", () => ({ trainingProposalApi: api, trainingError: (e: unknown) => String(e) }));
vi.mock("@/features/realtime/useEntityChanged", () => ({ useEntityChanged: () => undefined }));

import { ProposedParticipantsField } from "../ProposedParticipantsField";

const person = { personId: "p1", fullName: "Anne Tran", employeeCode: "E-001", department: "QA", position: "Specialist", avatar: null };

beforeEach(() => { Object.values(api).forEach((f) => f.mockReset()); api.peopleGroups.mockResolvedValue([]); api.people.mockResolvedValue([]); });
afterEach(cleanup);

describe("ProposedParticipantsField", () => {
  it("asks to save the document first when it has no id, and does not call the server", () => {
    render(<ProposedParticipantsField documentId={null} />);

    expect(screen.getByText(/Save the document first/)).toBeTruthy();
    expect(api.get).not.toHaveBeenCalled();
  });

  it("says there is no training activity when the document has none yet", async () => {
    api.get.mockResolvedValue({ available: false, editable: false, people: [] });
    render(<ProposedParticipantsField documentId="d1" />);

    expect(await screen.findByText(/no training activity for this document yet/)).toBeTruthy();
  });

  it("lists the proposed people and offers Edit participants only to a person who may edit", async () => {
    api.get.mockResolvedValue({ available: true, editable: true, trainingNumber: "TR-1", people: [person] });
    render(<ProposedParticipantsField documentId="d1" />);

    expect(await screen.findByText("Anne Tran")).toBeTruthy();
    expect(screen.getByText("E-001")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Edit participants/ })).toBeTruthy();
  });

  it("only shows the list, without Edit participants, when the person cannot edit", async () => {
    api.get.mockResolvedValue({ available: true, editable: false, people: [person] });
    render(<ProposedParticipantsField documentId="d1" />);

    await waitFor(() => expect(screen.getByText("Anne Tran")).toBeTruthy());
    expect(screen.queryByRole("button", { name: /Edit participants/ })).toBeNull();
  });

  it("shows ten people a page", async () => {
    const many = Array.from({ length: 12 }, (_v, i) => ({ ...person, personId: `p${i}`, fullName: `Person ${String(i + 1).padStart(2, "0")}` }));
    api.get.mockResolvedValue({ available: true, editable: true, people: many });
    render(<ProposedParticipantsField documentId="d1" />);

    expect(await screen.findByText("Person 10")).toBeTruthy();
    expect(screen.queryByText("Person 11")).toBeNull();
  });
});
