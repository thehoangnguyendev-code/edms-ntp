import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TrainingActivityDetail } from "@/services/api/trainingActivities";
import { ContentRulesPanel, assessmentFormKind, contentRuleNote } from "../ContentRulesPanel";

afterEach(cleanup);

const rules = { materialsRequired: true, materialsSatisfied: false, materialsSource: "NONE" as "DOCUMENT" | "FILES" | "NONE", testRequired: false, checklistRequired: false, assessmentFormSatisfied: false, onlineTest: false, inherited: false, missing: [] as string[] };
const activity = (over: Partial<TrainingActivityDetail> = {}, ruleOver: Partial<typeof rules> = {}, assessments: string[] = ["TEST"]) =>
  ({ id: "a1", kind: "PERIODIC", kindReason: "OTHER", documentNumber: "SOP.0012", revisionNumber: "3", contentRules: { ...rules, ...ruleOver },
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
    expect(screen.getByText(/Training Materials are required before the content can be reviewed/)).toBeTruthy();
  });

  it("says that the approved document is the material when the training comes from a document", () => {
    const a = activity({}, { materialsSource: "DOCUMENT", materialsSatisfied: true });
    show(a, "materials");
    // what is not needed is said in the table, not above it
    expect(screen.queryByText(/the approved document is the material/)).toBeNull();
    expect(contentRuleNote(a, "materials")).toMatch(/SOP\.0012 Rev 3: the approved document is the material/);
  });

  it("asks for the test of a session assessed by a test, and for no file when the sessions are observed or read", () => {
    show(activity({}, { testRequired: true, missing: ["TRAINING_TEST_REQUIRED"] }), "assessment");
    expect(screen.getByText(/the test \(APD\.0009\) is required/)).toBeTruthy();
    cleanup();
    const observed = activity({}, {}, ["SELF_READING_CONFIRMATION"]);
    show(observed, "assessment");
    expect(screen.queryByText(/No test or checklist is required/)).toBeNull();
    expect(contentRuleNote(observed, "assessment")).toMatch(/No test or checklist is required/);
  });

  it("tells a supplementary training, a visitor and an external training that nothing is required", () => {
    const supplementary = activity({}, { inherited: true });
    show(supplementary, "materials");
    expect(contentRuleNote(supplementary, "materials")).toMatch(/keeps the material of the training it supplements/);
    cleanup();
    const visitor = activity({ kindReason: "VISITOR" } as never);
    show(visitor, "assessment");
    expect(contentRuleNote(visitor, "assessment")).toBe("A visitor needs no test.");
    expect(screen.queryByRole("button", { name: /not required/ })).toBeNull();
  });

  it("records an exemption only with a reason, and can take it back", async () => {
    const onExempt = show(activity(), "materials");
    fireEvent.click(screen.getByRole("button", { name: /Training Materials are not required/ }));
    const save = await screen.findByRole("button", { name: "Save" });
    expect((save as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Short briefing" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onExempt).toHaveBeenCalledWith({ materialsExempt: true, reason: "Short briefing" }));

    cleanup();
    const exempted = activity({ materialsExempt: true, materialsExemptReason: "Short briefing" } as never);
    const again = show(exempted, "materials");
    // the reason is written in the table, with the sentence that nothing is needed
    expect(contentRuleNote(exempted, "materials")).toBe("Training Materials are not required for this training. Reason: Short briefing");
    fireEvent.click(screen.getByRole("button", { name: "Require materials again" }));
    expect(again).toHaveBeenCalledWith({ materialsExempt: false, reason: undefined });
  });

  it("does not offer an exemption to a person who may not set it", () => {
    show(activity(), "materials", false);
    expect(screen.queryByRole("button", { name: /not required/ })).toBeNull();
  });

  it("says that a test written in the system needs no file, and shows no warning for it", () => {
    const online = activity({}, { testRequired: true, onlineTest: true, missing: [] });
    show(online, "assessment");
    expect(contentRuleNote(online, "assessment")).toMatch(/The test is written in the system/);
    expect(screen.queryByText(/is required before the content can be reviewed/)).toBeNull();
  });

  it("warns for what the server says is missing, and for nothing else", () => {
    show(activity({}, { materialsRequired: true, materialsSatisfied: false, missing: [] }), "materials");
    expect(screen.queryByText(/are required before the content can be reviewed/)).toBeNull();
  });
});
