import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BreadcrumbProvider } from "@/contexts/BreadcrumbContext";

const activities = vi.hoisted(() => ({ people: vi.fn(), peopleGroups: vi.fn(), peopleInGroups: vi.fn(), create: vi.fn(), addSession: vi.fn(), addParticipants: vi.fn() }));
const files = vi.hoisted(() => ({ uploadMaterial: vi.fn(), addLink: vi.fn() }));
const matrix = vi.hoisted(() => ({ topics: vi.fn() }));
vi.mock("@/services/api/trainingActivities", async (importOriginal) => ({ ...(await importOriginal<object>()), trainingActivitiesApi: activities, trainingFilesApi: files, trainingMatrixApi: matrix }));
vi.mock("@/components/ui/toast/Toast", () => ({ useToast: () => ({ showToast: vi.fn() }) }));

import { TrainingActivityCreatePage } from "../TrainingActivityCreatePage";

const renderAt = (query = "") => render(
  <BreadcrumbProvider>
    <MemoryRouter initialEntries={[`/training-management/activities/new${query}`]}>
      <Routes>
        <Route path="/training-management/activities/new" element={<TrainingActivityCreatePage />} />
        <Route path="/training-management/activities/:id/edit" element={<div>the edit screen</div>} />
      </Routes>
    </MemoryRouter>
  </BreadcrumbProvider>,
);

beforeEach(() => {
  window.matchMedia = window.matchMedia ?? ((q: string) => ({ matches: false, media: q, onchange: null, addEventListener: () => undefined, removeEventListener: () => undefined, addListener: () => undefined, removeListener: () => undefined, dispatchEvent: () => false }) as MediaQueryList);
  (globalThis as { ResizeObserver?: unknown }).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  Object.values(activities).forEach((f) => f.mockReset());
  Object.values(files).forEach((f) => f.mockReset());
  activities.people.mockResolvedValue([]);
  activities.peopleGroups.mockResolvedValue([]);
  activities.peopleInGroups.mockResolvedValue([]);
  matrix.topics.mockResolvedValue([]);
});
afterEach(cleanup);

/** One session through the Add session dialog: an outside trainer and a room are the least a session needs. */
const addSession = async (topic: string, room: string) => {
  fireEvent.click(screen.getByRole("button", { name: "Add session" }));
  fireEvent.change(await screen.findByPlaceholderText(/What will be taught/), { target: { value: topic } });
  fireEvent.click(screen.getByRole("radio", { name: "External expert/consultant" }));
  fireEvent.change(screen.getByPlaceholderText("Name of the external expert or consultant"), { target: { value: "Outside Trainer" } });
  fireEvent.change(screen.getByPlaceholderText(/Training Room A/), { target: { value: room } });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
};

describe("New Training Activity with several sessions", () => {
  it("adds sessions before the activity exists, as cards; Save and Continue needs one session and the description", async () => {
    renderAt();
    const save = () => screen.getByRole("button", { name: "Save and Continue" }) as HTMLButtonElement;
    await screen.findByRole("tab", { name: /General Information/ });
    expect(save().disabled).toBe(true);

    await addSession("Occupational safety", "Room 1");
    await addSession("General principles of GMP", "Room 2");
    expect(screen.getByRole("region", { name: "Session 1" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "Session 2" })).toBeTruthy();
    expect(screen.getByText("Occupational safety")).toBeTruthy();
    expect(screen.getByText("General principles of GMP")).toBeTruthy();
    // a session can be taken out again
    expect(screen.getAllByRole("button", { name: "Remove session" }).length).toBe(2);
    expect(save().disabled).toBe(true);
    fireEvent.change(screen.getByRole("textbox", { name: /Description/ }), { target: { value: "Two parts of an initial training" } });
    expect(save().disabled).toBe(false);
  });

  it("saves the sessions in order, and puts each person on the sessions they attend (a tick taken off keeps one out)", async () => {
    activities.create.mockResolvedValue({ id: "n1", trainingNumber: "TRN/QA/26-001" });
    activities.addSession
      .mockResolvedValueOnce({ sessions: [{ id: "x1" }] })
      .mockResolvedValueOnce({ sessions: [{ id: "x1" }, { id: "x2" }] });
    activities.addParticipants.mockResolvedValue({});
    renderAt("?person=p1&personName=Ann%20Lee&personCode=E-1&person=p2&personName=Bob%20Ray&personCode=E-2&reason=Initial%20training");
    await screen.findByRole("tab", { name: /General Information/ });
    // the prefilled topic opens the dialog by itself (the initial training of an employee comes with its first topic): close it, the sessions are added by hand here
    if (screen.queryByRole("dialog")) fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await addSession("Topic one", "Room 1");
    await addSession("Topic two", "Room 2");
    fireEvent.change(screen.getByRole("textbox", { name: /Description/ }), { target: { value: "Two sessions" } });

    // who attends which session: Bob does not attend the second
    fireEvent.click(screen.getByRole("tab", { name: /Participants/ }));
    expect(await screen.findByText("Who attends which session")).toBeTruthy();
    fireEvent.click(screen.getAllByRole("checkbox", { name: "Bob Ray Session 2" })[0]);

    fireEvent.click(screen.getByRole("button", { name: "Save and Continue" }));
    await waitFor(() => expect(activities.addParticipants).toHaveBeenCalledTimes(2));
    expect(activities.addSession).toHaveBeenCalledTimes(2);
    expect(activities.addSession.mock.calls[0][1].topics[0].topicText).toBe("Topic one");
    expect(activities.addSession.mock.calls[1][1].topics[0].topicText).toBe("Topic two");
    const first = activities.addParticipants.mock.calls.find((c) => c[1].sessionId === "x1")?.[1];
    const second = activities.addParticipants.mock.calls.find((c) => c[1].sessionId === "x2")?.[1];
    expect(first.personUserIds).toEqual(["p1", "p2"]);
    expect(second.personUserIds).toEqual(["p1"]);
    expect(await screen.findByText("the edit screen")).toBeTruthy();
  });
});
