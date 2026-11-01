import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

const api = vi.hoisted(() => ({ numberInfo: vi.fn() }));
vi.mock("@/services/api/trainingActivities", () => ({ trainingLegacyApi: api }));
vi.mock("@/components/ui/select/Select", () => ({
  Select: ({ value, onChange, options, placeholder }: any) => (
    <select aria-label={placeholder} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{placeholder}</option>
      {options.map((o: any) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  ),
}));
vi.mock("@/features/training-activities/shared/ProposedParticipantsField", () => ({
  ProposedParticipantsField: ({ labels, onPendingChange }: any) => <div data-testid="people"><h5>{labels?.title}</h5><button onClick={() => onPendingChange([{ personId: "u1", fullName: "An" }])}>Add</button></div>,
}));
vi.mock("@/features/training-activities/shared/TrainingFileDropzone", () => ({
  TrainingFileDropzone: ({ label, onChange }: any) => <button onClick={() => onChange(new File(["%PDF"], "scan.pdf"))}>{label}</button>,
}));

import { LegacyTrainingEvidence, emptyLegacyTrainingEvidence, type LegacyTrainingEvidenceValue } from "../legacy-import-tabs/LegacyTrainingEvidence";


function Harness({ number, onState }: { number: string; onState?: (s: any) => void }) {
  const [value, setValue] = React.useState<LegacyTrainingEvidenceValue>(emptyLegacyTrainingEvidence());
  return (
    <>
      <LegacyTrainingEvidence revisionLabel="1.0.0" trainingNumber={number} value={value} onChange={setValue} onNumberState={onState ?? (() => {})} showValidation />
      <output data-testid="value">{JSON.stringify({ lost: value.notEvidenced, scan: value.scan?.name ?? null, people: value.trainees.length, topic: value.topic, trainer: value.trainer, method: value.method })}</output>
    </>
  );
}

const waitInfo = () => act(async () => { await new Promise((r) => setTimeout(r, 500)); });

beforeEach(() => {
  vi.clearAllMocks();
  api.numberInfo.mockResolvedValue({ number: "N", exists: false });
});

describe("Legacy Import: the paper training record of a revision", () => {
  it("asks for the topic, the trainer, the mode, the scan and the persons trained when the number is new, and not for a verifier", async () => {
    render(<Harness number="TRN/QA/26-500" />);
    await waitInfo();
    expect(screen.getByText(/Scan of the paper training record/)).toBeTruthy();
    expect(screen.getByTestId("people")).toBeTruthy();
    expect(screen.getByText(/cannot be deleted or replaced/)).toBeTruthy();
    expect(screen.queryByText(/Who verifies/)).toBeNull();
    fireEvent.click(screen.getByText(/Scan of the paper training record/));
    fireEvent.click(screen.getByText("Add"));
    fireEvent.change(screen.getByLabelText(/Training Topic/), { target: { value: "Gowning" } });
    fireEvent.change(screen.getByLabelText(/Trainer/), { target: { value: "Nguyen Van A" } });
    fireEvent.change(screen.getByLabelText("Select mode..."), { target: { value: "CLASSROOM" } });
    expect(JSON.parse(screen.getByTestId("value").textContent as string)).toEqual({
      lost: false, scan: "scan.pdf", people: 1, topic: "Gowning", trainer: "Nguyen Van A", method: "CLASSROOM",
    });
  });

  it("does not offer the persons trained, the topic, the trainer and the mode until the Training Number is typed", async () => {
    render(<Harness number="" />);
    await waitInfo();
    expect(screen.queryByTestId("people")).toBeNull();
    expect(screen.queryByLabelText(/Training Topic/)).toBeNull();
    expect(screen.getByText(/only when the Training Number of the paper record is entered/)).toBeTruthy();
  });

  it("declares the paper lost: asks for the reason, takes the scan and the persons away", async () => {
    render(<Harness number="TRN/QA/26-500" />);
    await waitInfo();
    fireEvent.click(screen.getByText(/Scan of the paper training record/));
    fireEvent.click(screen.getByText("Add"));
    fireEvent.click(screen.getByLabelText(/paper record is lost/i));
    expect(screen.getByText("Say why there is no evidence.")).toBeTruthy();
    expect(screen.queryByTestId("people")).toBeNull();
    expect(screen.queryByLabelText(/Training Topic/)).toBeNull();
    expect(JSON.parse(screen.getByTestId("value").textContent as string)).toMatchObject({ lost: true, scan: null, people: 0 });
  });

  it("joins the evidence that is already on file for a number shared with other documents", async () => {
    const onState = vi.fn();
    api.numberInfo.mockResolvedValue({ number: "N", exists: true, legacy: true, evidenceStatus: "VERIFIED", traineeCount: 2, documents: [{ documentNumber: "SOP.0010", documentName: "x", revisionNumber: "1.0.0" }] });
    render(<Harness number="TRN/QA/26-982" onState={onState} />);
    await waitInfo();
    expect(screen.getByText(/already filed with SOP\.0010 Rev 1\.0\.0 \(filed, 2 trained\)/)).toBeTruthy();
    expect(screen.queryByText(/Scan of the paper training record/)).toBeNull();
    await waitFor(() => expect(onState).toHaveBeenLastCalledWith({ joins: true, problem: "" }));
  });

  it("refuses a number that Training Management issued", async () => {
    const onState = vi.fn();
    api.numberInfo.mockResolvedValue({ number: "N", exists: true, legacy: false });
    render(<Harness number="TRN/QA/26-001" onState={onState} />);
    await waitInfo();
    expect(screen.getByText(/was issued by Training Management/)).toBeTruthy();
    expect(screen.queryByText(/Scan of the paper training record/)).toBeNull();
    await waitFor(() => expect(onState.mock.calls.at(-1)?.[0].problem).toMatch(/issued by Training Management/));
  });
});
