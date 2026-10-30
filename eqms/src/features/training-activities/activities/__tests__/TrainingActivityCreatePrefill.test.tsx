import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BreadcrumbProvider } from "@/contexts/BreadcrumbContext";

const activities = vi.hoisted(() => ({ people: vi.fn(), peopleGroups: vi.fn(), peopleInGroups: vi.fn(), create: vi.fn(), addSession: vi.fn(), addParticipants: vi.fn() }));
const matrix = vi.hoisted(() => ({ topics: vi.fn() }));
vi.mock("@/services/api/trainingActivities", async (importOriginal) => ({ ...(await importOriginal<object>()), trainingActivitiesApi: activities, trainingMatrixApi: matrix }));
vi.mock("@/components/ui/toast/Toast", () => ({ useToast: () => ({ showToast: vi.fn() }) }));

import { TrainingActivityCreatePage } from "../TrainingActivityCreatePage";

const renderAt = (query: string) => render(
  <BreadcrumbProvider>
    <MemoryRouter initialEntries={[`/training-management/activities/new${query}`]}>
      <Routes><Route path="/training-management/activities/new" element={<TrainingActivityCreatePage />} /></Routes>
    </MemoryRouter>
  </BreadcrumbProvider>,
);

beforeEach(() => {
  window.matchMedia = window.matchMedia ?? ((q: string) => ({ matches: false, media: q, onchange: null, addEventListener: () => undefined, removeEventListener: () => undefined, addListener: () => undefined, removeListener: () => undefined, dispatchEvent: () => false }) as MediaQueryList);
  (globalThis as { ResizeObserver?: unknown }).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  Object.values(activities).forEach((f) => f.mockReset());
  activities.people.mockResolvedValue([]);
  activities.peopleGroups.mockResolvedValue([]);
  activities.peopleInGroups.mockResolvedValue([]);
  matrix.topics.mockResolvedValue([]);
});
afterEach(cleanup);

describe("New Training Activity opened from the initial training of a new employee", () => {
  const query = "?kind=INITIAL&topic=GMP%20basics&person=p1&personName=Nguyen%20Van%20An&personCode=NTP.0005&person=p2&personName=Tran%20Thi%20Binh&personCode=NTP.0006&reason=Initial%20training%20of%20new%20employees";

  it("fills in the topic of the session and the employees", async () => {
    renderAt(query);

    // the topic of the session (General Information, kept mounted)
    expect((await screen.findAllByDisplayValue("GMP basics")).length).toBe(1);
    // the reason for adding the employee is in the tab Participants, with the employees chosen
    expect(screen.getByDisplayValue("Initial training of new employees")).toBeTruthy();
    expect(screen.getAllByText(/Nguyen Van An/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Tran Thi Binh/).length).toBeGreaterThan(0);
  });

  it("starts empty when it is opened without the initial training", async () => {
    renderAt("");

    await screen.findByRole("tab", { name: /General Information/ });
    expect(screen.queryByDisplayValue("GMP basics")).toBeNull();
  });
});

describe("New Training Activity, General Information", () => {
  it("lists the fields in the order of Training Activity Details, with the session radio choices kept", async () => {
    renderAt("");

    await screen.findByRole("tab", { name: /General Information/ });
    const order = ["Training Number", "Department", "Opened By", "Created Time", "Type", "Reason", "Training Topic", "Mode", "Assessment", "Due Date", "Scheduled date", "Location Type", "Description"];
    // a label may carry the star of a required field
    const labelled = (label: string) => screen.getAllByText((text, el) => el?.tagName === "LABEL" && text.replace(/\s*\*$/, "").trim() === label)[0];
    for (let i = 1; i < order.length; i += 1) {
      expect(labelled(order[i - 1]).compareDocumentPosition(labelled(order[i])) & Node.DOCUMENT_POSITION_FOLLOWING, `${order[i - 1]} before ${order[i]}`).toBeTruthy();
    }
    expect(screen.getByRole("radio", { name: "Internal expert" })).toBeTruthy();
    expect(screen.getByRole("radio", { name: "On-site (Physical)" })).toBeTruthy();
  });
});
