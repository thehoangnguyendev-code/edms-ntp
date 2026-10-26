import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ approved: vi.fn(), choose: vi.fn(), unchoose: vi.fn() }));
vi.mock("@/services/api/trainingActivities", async (importOriginal) => ({ ...(await importOriginal<object>()), trainingAssessmentsApi: api }));
vi.mock("@/components/ui/toast/Toast", () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock("@/components/ui/select/Select", () => ({
  Select: ({ options, value, onChange, "aria-label": label }: { options: { value: string; label: string }[]; value: string; onChange: (v: string) => void; "aria-label"?: string }) => (
    <select aria-label={label ?? "Assessment"} value={value} onChange={(e) => onChange(e.target.value)}><option value="">-</option>{options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
  ),
}));
vi.mock("@/components/ui/modal/FormModal", () => ({
  FormModal: ({ isOpen, children, onConfirm, confirmText, confirmDisabled, description }: { isOpen: boolean; children: React.ReactNode; onConfirm: () => void; confirmText: string; confirmDisabled?: boolean; description?: string }) =>
    isOpen ? <div role="dialog"><p>{description}</p>{children}<button disabled={confirmDisabled} onClick={onConfirm}>{confirmText}</button></div> : null,
}));

import { TrainingAssessmentChoiceBlock } from "../TrainingAssessmentChoiceBlock";
import type { TrainingActivityDetail } from "@/services/api/trainingActivities";

const activity = (over: Record<string, unknown> = {}, methods: string[] = ["TEST"]) =>
  ({ id: "a1", sessions: methods.map((m, i) => ({ id: `s${i}`, status: "PLANNED", assessmentMethod: m })), ...over }) as unknown as TrainingActivityDetail;
const CHOSEN = { assessmentId: "d1", code: "TAS-0001", revision: "2.0.0", name: "Kiểm tra SOP.0006", kind: "QUESTIONS", maxScore: 10, chosenAt: "2026-10-24T08:00:00Z", chosenByName: "Organizer", itemCount: 4 };

beforeEach(() => Object.values(api).forEach((f) => f.mockReset()));
afterEach(cleanup);

describe("Assessment from the library, in the tab Assessment of an activity", () => {
  it("is optional: it says so and offers the choice to the organizer", () => {
    render(<TrainingAssessmentChoiceBlock activity={activity()} editable onChanged={vi.fn()} />);
    expect(screen.getByText(/Optional\. Choose an effective test or checklist/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Choose Assessment" })).toBeTruthy();
  });

  it("shows nothing to a person who only looks, when nothing was chosen, and nothing for a session that is not assessed by a test or a checklist", () => {
    const { container, rerender } = render(<TrainingAssessmentChoiceBlock activity={activity()} editable={false} onChanged={vi.fn()} />);
    expect(container.textContent).toBe("");
    rerender(<TrainingAssessmentChoiceBlock activity={activity({}, ["OBSERVATION"])} editable onChanged={vi.fn()} />);
    expect(container.textContent).toBe("");
  });

  it("lists only the effective assessments of the right type, and writes the choice into the form", async () => {
    api.approved.mockResolvedValue([
      { id: "d1", code: "TAS-0001", revisionNumber: "2.0.0", name: "Kiểm tra SOP.0006", kind: "QUESTIONS", itemCount: 4, maxScore: 10 },
      { id: "d2", code: "TAS-0002", revisionNumber: "1.0.0", name: "Checklist vệ sinh", kind: "CHECKLIST", itemCount: 6, maxScore: null },
    ]);
    const next = activity({ assessment: CHOSEN });
    api.choose.mockResolvedValue(next);
    const onChanged = vi.fn();
    render(<TrainingAssessmentChoiceBlock activity={activity()} editable onChanged={onChanged} />);
    fireEvent.click(screen.getByRole("button", { name: "Choose Assessment" }));
    // the session is assessed by a test: the checklist is not offered
    const select = (await screen.findByLabelText("Assessment")) as HTMLSelectElement;
    await waitFor(() => expect(select.options.length).toBe(2));
    expect(Array.from(select.options).map((o) => o.text)).toEqual(["-", "Kiểm tra SOP.0006 (TAS-0001 2.0.0)"]);
    expect(screen.getByText(/the title of the assessment is not written in the form/)).toBeTruthy();
    expect((screen.getByRole("button", { name: "Choose" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(select, { target: { value: "d1" } });
    fireEvent.click(screen.getByRole("button", { name: "Choose" }));
    await waitFor(() => expect(api.choose).toHaveBeenCalledWith("a1", "d1"));
    await waitFor(() => expect(onChanged).toHaveBeenCalledWith(next));
  });

  it("a checklist session is offered the checklists, and both kinds when the activity has both", async () => {
    api.approved.mockResolvedValue([
      { id: "d1", code: "TAS-0001", revisionNumber: "2.0.0", name: "Test", kind: "QUESTIONS", itemCount: 4, maxScore: 10 },
      { id: "d2", code: "TAS-0002", revisionNumber: "1.0.0", name: "Checklist", kind: "CHECKLIST", itemCount: 6, maxScore: null },
    ]);
    render(<TrainingAssessmentChoiceBlock activity={activity({}, ["CHECKLIST"])} editable onChanged={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Choose Assessment" }));
    const select = (await screen.findByLabelText("Assessment")) as HTMLSelectElement;
    await waitFor(() => expect(select.options.length).toBe(2));
    expect(Array.from(select.options).map((o) => o.text)).toEqual(["-", "Checklist (TAS-0002 1.0.0)"]);
    cleanup();
    api.approved.mockResolvedValue([
      { id: "d1", code: "TAS-0001", revisionNumber: "2.0.0", name: "Test", kind: "QUESTIONS", itemCount: 4, maxScore: 10 },
      { id: "d2", code: "TAS-0002", revisionNumber: "1.0.0", name: "Checklist", kind: "CHECKLIST", itemCount: 6, maxScore: null },
    ]);
    render(<TrainingAssessmentChoiceBlock activity={activity({}, ["TEST", "CHECKLIST"])} editable onChanged={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Choose Assessment" }));
    const both = (await screen.findByLabelText("Assessment")) as HTMLSelectElement;
    await waitFor(() => expect(both.options.length).toBe(3));
  });

  it("shows what was chosen without the title written anywhere as a form field, with the score of a test and none for a checklist; Remove takes it off", async () => {
    api.unchoose.mockResolvedValue(activity());
    const onChanged = vi.fn();
    render(<TrainingAssessmentChoiceBlock activity={activity({ assessment: CHOSEN })} editable onChanged={onChanged} />);
    expect(screen.getByText("Kiểm tra SOP.0006")).toBeTruthy();
    expect(screen.getByText("TAS-0001 2.0.0")).toBeTruthy();
    expect(screen.getByText(/4 question\(s\), total 10 point\(s\)/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    await waitFor(() => expect(api.unchoose).toHaveBeenCalledWith("a1"));
    cleanup();
    render(<TrainingAssessmentChoiceBlock activity={activity({ assessment: { ...CHOSEN, kind: "CHECKLIST", maxScore: null, itemCount: 6 } }, ["CHECKLIST"])} editable={false} onChanged={vi.fn()} />);
    expect(screen.getByText(/6 line\(s\), no score/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Remove" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Choose Assessment" })).toBeNull();
  });
});
