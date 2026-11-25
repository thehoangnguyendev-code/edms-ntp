import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TrainingActivityDetail } from "@/services/api/trainingActivities";
import { ContentRulesPanel, assessmentFormKind, contentRuleNote } from "../ContentRulesPanel";

afterEach(cleanup);

const rules = { materialsRequired: true, materialsSatisfied: false, materialsSource: "NONE" as "DOCUMENT" | "FILES" | "NONE", testRequired: false, checklistRequired: false, assessmentFormSatisfied: false, onlineTest: false, inherited: false, missing: [] as string[] };
const activity = (over: Partial<TrainingActivityDetail> = {}, ruleOver: Partial<typeof rules> = {}, assessments: string[] = ["TEST"]) =>
  ({ id: "a1", kind: "PERIODIC", kindReason: "OTHER", documentNumber: "SOP.0012", revisionNumber: "3", documentLabel: "SOP.0012_3", contentRules: { ...rules, ...ruleOver },
     sessions: assessments.map((a, i) => ({ id: `s${i}`, status: "PLANNED", assessmentMethod: a })), ...over }) as unknown as TrainingActivityDetail;
const show = (a: TrainingActivityDetail, part: "materials" | "assessment", canExempt = true, onExempt = vi.fn().mockResolvedValue(true)) => {
  render(<ContentRulesPanel activity={a} part={part} canExempt={canExempt} onExempt={onExempt} />);
  return onExempt;
};

describe("assessmentFormKind", () => {
  it("reads what the sessions that are not cancelled ask of a form", () => {
    expect(assessmentFormKind(activity({}, {}, ["TEST"]))).toBe("TEST");
    expect(assessmentFormKind(activity({}, {}, ["CHECKLIST"]))).toBe("CHECKLIST");
    expect(assessmentFormKind(activity({}, {}, ["TEST", "CHECKLIST"]))).toBe("BOTH");
    expect(assessmentFormKind(activity({}, {}, ["OBSERVATION", "SELF_READING_CONFIRMATION"]))).toBe("NONE");
  });
});

describe("ContentRulesPanel", () => {
  it("asks for a file or a link when a training that is not on a document has no material", () => {
    show(activity({}, { missing: ["TRAINING_MATERIALS_REQUIRED"] }), "materials");
    expect(screen.getByText(/Required before the content is approved: a file or a link/)).toBeTruthy();
  });

  it("says that the approved document is the material when the training comes from a document", () => {
    const a = activity({}, { materialsSource: "DOCUMENT", materialsSatisfied: true });
    show(a, "materials");
    // what is not needed is said in the table, not above it
    expect(screen.queryByText(/the approved document is the material/)).toBeNull();
    expect(contentRuleNote(a, "materials")).toMatch(/SOP\.0012_3: the approved document is the material/);
  });

  it("does not advise adding material once material can no longer be added (the training is running)", () => {
    const a = activity({}, { materialsSource: "DOCUMENT", materialsSatisfied: true });
    expect(contentRuleNote(a, "materials")).toMatch(/Add slides or other material below if you want/);
    expect(contentRuleNote(a, "materials", false)).toMatch(/SOP\.0012_3: the approved document is the material\.$/);
    expect(contentRuleNote(a, "materials", false)).not.toMatch(/Add slides/);
  });

  it("asks for the test of a session assessed by a test, and for no file when the sessions are observed or read", () => {
    show(activity({}, { testRequired: true, missing: ["TRAINING_TEST_REQUIRED"] }), "assessment");
    expect(screen.getByText(/choose an approved assessment of the library for the test \(APD\.0009\)/)).toBeTruthy();
    cleanup();
    const observed = activity({}, {}, ["SELF_READING_CONFIRMATION"]);
    show(observed, "assessment");
    expect(screen.queryByText(/No test or checklist is required/)).toBeNull();
    // nothing to decide: no checkbox either
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(contentRuleNote(observed, "assessment")).toMatch(/No test or checklist is required/);
  });

  it("offers no decision to a visitor or an external training", () => {
    const visitor = activity({ kindReason: "VISITOR" } as never);
    show(visitor, "assessment");
    expect(contentRuleNote(visitor, "assessment")).toBe("A visitor needs no test.");
    expect(screen.queryByRole("checkbox")).toBeNull();
    cleanup();
    show(activity({ kind: "EXTERNAL" } as never), "materials");
    expect(screen.queryByRole("checkbox")).toBeNull();
  });

  it("treats a supplementary training like any other: its content is required, and copied into it when it is arranged", () => {
    const supplementary = activity({ parentActivityId: "a0" } as never, { missing: ["TRAINING_MATERIALS_REQUIRED"] });
    show(supplementary, "materials");
    expect((screen.getByRole("checkbox", { name: "Required Training Materials?" }) as HTMLInputElement).checked).toBe(true);
    expect(screen.getByText(/Required before the content is approved: a file or a link/)).toBeTruthy();
  });

  it("is ticked by default, and unticking it asks for a reason that is saved only when it is given", async () => {
    const onExempt = show(activity(), "materials");
    const box = screen.getByRole("checkbox", { name: "Required Training Materials?" });
    expect((box as HTMLInputElement).checked).toBe(true);
    expect(screen.queryByRole("textbox")).toBeNull();

    fireEvent.click(box);
    expect((screen.getByRole("checkbox", { name: "Required Training Materials?" }) as HTMLInputElement).checked).toBe(false);
    const save = screen.getByRole("button", { name: "Save" });
    expect((save as HTMLButtonElement).disabled).toBe(true);
    // nothing is sent to the server until the reason is saved
    expect(onExempt).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Short briefing" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onExempt).toHaveBeenCalledWith({ materialsExempt: true, reason: "Short briefing" }));
  });

  it("shows the reason of an exemption that is saved, and ticking the box again requires it again", () => {
    const exempted = activity({ materialsExempt: true, materialsExemptReason: "Short briefing" } as never);
    const again = show(exempted, "materials");
    // the reason is written in the table too, with the sentence that nothing is needed
    expect(contentRuleNote(exempted, "materials")).toBe("Training Materials are not required for this training. Reason: Short briefing");
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("Short briefing");
    fireEvent.click(screen.getByRole("checkbox", { name: "Required Training Materials?" }));
    expect(again).toHaveBeenCalledWith({ materialsExempt: false });
  });

  it("covers the assessment the same way", async () => {
    const onExempt = show(activity({}, { testRequired: true }), "assessment");
    fireEvent.click(screen.getByRole("checkbox", { name: "Required Assessment?" }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Observed on the floor" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onExempt).toHaveBeenCalledWith({ assessmentExempt: true, reason: "Observed on the floor" }));
  });

  it("does not carry an unticked box from one tab to the other", () => {
    const a = activity({}, { testRequired: true });
    const view = render(<ContentRulesPanel activity={a} part="materials" canExempt onExempt={vi.fn()} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Required Training Materials?" }));
    expect(screen.getByRole("textbox")).toBeTruthy();

    view.rerender(<ContentRulesPanel activity={a} part="assessment" canExempt onExempt={vi.fn()} />);
    expect((screen.getByRole("checkbox", { name: "Required Assessment?" }) as HTMLInputElement).checked).toBe(true);
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("only shows the state to a person who may not set it", () => {
    show(activity(), "materials", false);
    expect((screen.getByRole("checkbox", { name: "Required Training Materials?" }) as HTMLInputElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
  });

  it("does not take a test written in the system for the test of the library", () => {
    const online = activity({}, { testRequired: true, onlineTest: true, missing: ["TRAINING_TEST_REQUIRED"] });
    show(online, "assessment");
    expect(screen.getByText(/choose an approved assessment of the library/)).toBeTruthy();
  });

  it("warns for what the server says is missing, and for nothing else", () => {
    show(activity({}, { materialsRequired: true, materialsSatisfied: false, missing: [] }), "materials");
    expect(screen.queryByText(/Required before the content is approved/)).toBeNull();
  });
});
