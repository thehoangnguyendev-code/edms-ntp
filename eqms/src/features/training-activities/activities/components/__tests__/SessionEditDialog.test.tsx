import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TrainingSession } from "@/services/api/trainingActivities";

vi.mock("../TrainingActivityPlanning", () => ({ PersonPicker: () => <div>person picker</div> }));
vi.mock("../../../shared/TrainingDateField", () => ({ TrainingDateField: () => <div>date field</div> }));

import { SessionEditDialog } from "../SessionEditDialog";

afterEach(cleanup);

const session = { id: "s1", sessionNo: 2, externalTrainerName: "Old Trainer", locationType: "ONSITE", venue: "Room 1", status: "PLANNED", topics: [] } as unknown as TrainingSession;

describe("SessionEditDialog", () => {
  it("starts from what the session has and cannot be saved without a reason", () => {
    const onSave = vi.fn();
    render(<SessionEditDialog session={session} external={false} busy={false} onClose={vi.fn()} onSave={onSave} />);

    expect(screen.getByText("Change Session 2")).toBeTruthy();
    expect((screen.getByDisplayValue("Room 1") as HTMLInputElement).value).toBe("Room 1");
    expect((screen.getByRole("button", { name: "Save" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("sends the new place and the reason", () => {
    const onSave = vi.fn();
    render(<SessionEditDialog session={session} external={false} busy={false} onClose={vi.fn()} onSave={onSave} />);

    fireEvent.change(screen.getByDisplayValue("Room 1"), { target: { value: "Room 2" } });
    fireEvent.change(screen.getByRole("textbox", { name: /Reason for the change/ }), { target: { value: "Room is booked" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ externalTrainerName: "Old Trainer", locationType: "ONSITE", venue: "Room 2", reason: "Room is booked" }));
  });
});
