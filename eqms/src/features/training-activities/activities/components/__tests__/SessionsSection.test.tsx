import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ people: vi.fn() }));
vi.mock("@/services/api/trainingActivities", async (importOriginal) => ({ ...(await importOriginal<object>()), trainingActivitiesApi: api }));
vi.mock("@/components/ui/toast/Toast", () => ({ useToast: () => ({ showToast: vi.fn() }) }));

import { SessionsSection } from "../SessionsSection";
import { SessionPills } from "../SessionPills";
import { sessionFormFrom } from "../SessionFormModal";
import type { SessionCardData } from "../SessionCards";

const cards: SessionCardData[] = [
  { key: "s1", no: 1, topics: ["Topic 1"], mode: "Classroom training", assessment: "Test", trainer: "Tina Trainer", date: "12/12/2026", place: "Room A", people: 2, content: { materials: 1, materialsNeeded: true, materialsOk: true, assessmentNeeded: true, assessmentOk: true, assessmentLabel: "Quiz", assessmentWord: "Test" } },
  { key: "s2", no: 2, topics: ["Topic 2"], trainer: "Tom Trainer", date: "13/12/2026", place: "Room B", people: 2, afterDue: true, content: { materials: 0, materialsNeeded: true, materialsOk: false, assessmentNeeded: true, assessmentOk: false, assessmentWord: "Checklist" } },
];
const sources = [
  { key: "s1", no: 1, label: "Session 1 · Topic 1", people: 2, form: sessionFormFrom({ topics: [{ topicText: "Topic 1" }], method: "CLASSROOM", assessmentMethod: "TEST", externalTrainerName: "Tina Trainer", venue: "Room A", locationType: "ONSITE" } as never) },
];

const section = (over: Partial<Parameters<typeof SessionsSection>[0]> = {}) => {
  const onSave = vi.fn().mockResolvedValue(true);
  render(<SessionsSection cards={cards} sources={sources} canAdd external={false} busy={false} canCopyPeople emptyNote="No session yet" onSave={onSave} {...over} />);
  return onSave;
};

beforeEach(() => {
  window.matchMedia = window.matchMedia ?? ((q: string) => ({ matches: false, media: q, onchange: null, addEventListener: () => undefined, removeEventListener: () => undefined, addListener: () => undefined, removeListener: () => undefined, dispatchEvent: () => false }) as MediaQueryList);
  (globalThis as { ResizeObserver?: unknown }).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  api.people.mockReset();
  api.people.mockResolvedValue([]);
});
afterEach(cleanup);

/** Fills what a session needs besides what a copy brings: an outside trainer and the place. */
const fillNewSession = async (topic: string) => {
  fireEvent.change(await screen.findByPlaceholderText(/What will be taught/), { target: { value: topic } });
  fireEvent.click(screen.getByRole("radio", { name: "External expert/consultant" }));
  fireEvent.change(screen.getByPlaceholderText("Name of the external expert or consultant"), { target: { value: "Outside Trainer" } });
  fireEvent.change(screen.getByPlaceholderText(/Training Room A/), { target: { value: "Room 9" } });
};

describe("The sessions of an activity as cards, with the one dialog that adds a session", () => {
  it("shows each session as a card with its count in the title, what it lacks in amber, and no table", () => {
    section();

    expect(screen.getByText("Sessions")).toBeTruthy();
    expect(screen.getByRole("region", { name: "Session 1" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "Session 2" })).toBeTruthy();
    expect(within(screen.getByRole("region", { name: "Session 1" })).getByText("Tina Trainer")).toBeTruthy();
    // the session that lacks material and a checklist says so, and is flagged after the due date
    const second = within(screen.getByRole("region", { name: "Session 2" }));
    expect(second.getByText("No material yet")).toBeTruthy();
    expect(second.getByText("No checklist chosen yet")).toBeTruthy();
    expect(second.getByText("After the due date")).toBeTruthy();
    expect(screen.queryAllByRole("columnheader").length).toBe(0);
  });

  it("adds a session in a dialog, with several topics; Save is off until the session is complete", async () => {
    const onSave = section();
    fireEvent.click(screen.getByRole("button", { name: "Add session" }));
    await screen.findByRole("dialog");
    const save = () => screen.getByRole("button", { name: "Save" }) as HTMLButtonElement;
    expect(save().disabled).toBe(true);

    await fillNewSession("Gowning");
    fireEvent.click(screen.getByRole("button", { name: "Add another topic" }));
    fireEvent.change(screen.getByPlaceholderText("Another topic of the same session"), { target: { value: "Cleanroom behaviour" } });
    expect(save().disabled).toBe(false);
    fireEvent.click(save());

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    const [draft, options] = onSave.mock.calls[0];
    expect(draft.topics.map((t: { topicText: string }) => t.topicText)).toEqual(["Gowning", "Cleanroom behaviour"]);
    expect(draft.externalTrainerName).toBe("Outside Trainer");
    expect(options.editKey).toBeUndefined();
  });

  it("copies a session with its icon: the topic, the mode, the trainer and the place come over, the day does not", async () => {
    const onSave = section();
    fireEvent.click(within(screen.getByRole("region", { name: "Session 1" })).getByRole("button", { name: "Copy session" }));
    await screen.findByRole("dialog");

    expect(await screen.findByDisplayValue("Topic 1")).toBeTruthy();
    expect(screen.getByDisplayValue("Room A")).toBeTruthy();
    expect(screen.getByDisplayValue("Tina Trainer")).toBeTruthy();
    // the people can be copied too, and are by default
    expect(screen.getByText("Add the same 2 people as Session 1")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    const [draft, options] = onSave.mock.calls[0];
    expect(draft.topics[0].topicText).toBe("Topic 1");
    expect(draft.scheduledOn).toBeUndefined();
    expect(options.copyPeopleFrom).toBe("s1");
  });

  it("does not offer the people of the source once the list is confirmed", async () => {
    section({ canCopyPeople: false });
    fireEvent.click(within(screen.getByRole("region", { name: "Session 1" })).getByRole("button", { name: "Copy session" }));
    await screen.findByRole("dialog");
    expect(screen.queryByText(/Add the same 2 people/)).toBeNull();
  });

  it("creates from a SOP pattern: the dialog of each session opens in turn with its topic filled in", async () => {
    const onSave = section({ cards: [], sources: [] });
    fireEvent.click(screen.getByRole("button", { name: "Create from a SOP pattern" }));
    await screen.findByText(/Choose the kind of training/);
    fireEvent.click(screen.getByRole("button", { name: "Start" }));

    expect(await screen.findByDisplayValue("Occupational safety and company policy")).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: "External expert/consultant" }));
    fireEvent.change(screen.getByPlaceholderText("Name of the external expert or consultant"), { target: { value: "HR trainer" } });
    fireEvent.change(screen.getByPlaceholderText(/Training Room A/), { target: { value: "Room 1" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    // the next of the three parts opens by itself
    expect(await screen.findByDisplayValue("General principles of GMP")).toBeTruthy();
  });

  it("offers no button to add when the activity cannot be changed (the sessions are locked)", () => {
    section({ canAdd: false });
    expect(screen.queryByRole("button", { name: "Add session" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Copy session" })).toBeNull();
    expect(screen.getByRole("region", { name: "Session 1" })).toBeTruthy();
  });

  it("says what to do when there is no session yet", () => {
    section({ cards: [] });
    expect(screen.getByText("No session yet")).toBeTruthy();
  });
});

describe("The bar of the sessions", () => {
  it("is the bar of the Participants tab: All and one pill for each session, with a mark on a session that lacks something", () => {
    const onChange = vi.fn();
    render(<SessionPills value="" onChange={onChange} pills={[{ id: "", label: "All (2)" }, { id: "s1", label: "S1 Topic 1", mark: "ok" }, { id: "s2", label: "S2 Topic 2", mark: "warn" }]} />);

    expect(screen.getByRole("button", { name: /All \(2\)/ }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: /S2 Topic 2/ }).textContent).toContain("!");
    fireEvent.click(screen.getByRole("button", { name: /S1 Topic 1/ }));
    expect(onChange).toHaveBeenCalledWith("s1");
  });
});
