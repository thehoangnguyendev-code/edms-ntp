import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { IconArrowLeft, IconArrowRight, IconCheck } from "@tabler/icons-react";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { Button } from "@/components/ui/button/Button";
import { FormField } from "@/components/ui/form/ResponsiveForm";
import { Select } from "@/components/ui/select/Select";
import { RadioGroup } from "@/components/ui/radio";
import { WorkflowStepper } from "@/components/ui/workflow-stepper/WorkflowStepper";
import { useToast } from "@/components/ui/toast/Toast";
import { Input } from "../shared/TrainingFields";
import { TransferPicker } from "../shared/TransferPicker";
import { ReadonlyField, ReadonlyGrid } from "../shared/TrainingDetailLayout";
import { RequiredTrainingsField, pickedIds, type PickedTraining } from "./RequiredTrainingsField";
import {
  type TrainingEligibility,
  type TrainingPosition,
  trainingActivitiesApi,
  trainingError,
  trainingJobsApi,
  trainingMatrixApi,
  trainingWorkPositionApi,
} from "@/services/api/trainingActivities";
import { trainingBreadcrumbs } from "../shared/trainingLabels";
import { useTrainingBack } from "../shared/useTrainingBack";

const STEPS = ["Employee and Work Positions", "Other Trainings", "Review and Create"];
const JOBS_ROUTE = "/training-management/job-assignments";

type Held = { jobRoleId: string; positionName: string };

/**
 * A new job assignment (APD.0024) as a page of three steps: who is given which Work Positions, the other trainings required first, and a review with the check of the training
 * the person already has. A draft is created at the end and opened in Job Assignment Details, where it is completed and signed.
 */
export function TrainingJobCreatePage() {
  const navigate = useNavigate();
  const goBack = useTrainingBack(JOBS_ROUTE);
  const { showToast } = useToast();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [positions, setPositions] = useState<TrainingPosition[]>([]);
  const [people, setPeople] = useState<{ label: string; value: string }[]>([]);
  const [personId, setPersonId] = useState("");
  // One assignment can give several Work Positions: they are listed, and each is checked against the matrix of its department.
  const [positionIds, setPositionIds] = useState<string[]>([]);
  // The Work Positions that the person holds through a signed job assignment: a later Work Position replaces one of them or is added to them.
  const [held, setHeld] = useState<Held[]>([]);
  const [mode, setMode] = useState<"CHANGE" | "ADDITIONAL">("ADDITIONAL");
  const [replaces, setReplaces] = useState("");
  const [changeReason, setChangeReason] = useState("");
  const [required, setRequired] = useState<PickedTraining[]>([]);
  // The check is made at once: what the matrix requires for the Work Positions and what is chosen, against the training records of the person.
  const [check, setCheck] = useState<TrainingEligibility>();

  useEffect(() => {
    trainingMatrixApi.positions().then(setPositions).catch(() => setPositions([]));
  }, []);
  const searchPeople = useCallback(async (query: string) => {
    const list = await trainingActivitiesApi.people(query);
    const mapped = list.map((p) => ({ label: `${p.fullName}${p.employeeCode ? ` (${p.employeeCode})` : ""}`, value: p.id }));
    setPeople(mapped);
    return mapped;
  }, []);
  useEffect(() => { void searchPeople(""); }, [searchPeople]);
  useEffect(() => {
    setHeld([]);
    setReplaces("");
    if (!personId) return;
    let live = true;
    trainingWorkPositionApi.of(personId)
      .then((w) => { if (live) setHeld((w.roles ?? []).filter((r) => r.source === "JOB_ASSIGNMENT")); })
      .catch(() => { if (live) setHeld([]); });
    return () => { live = false; };
  }, [personId]);
  useEffect(() => {
    setCheck(undefined);
    if (!personId || positionIds.length === 0) return;
    let live = true;
    const ids = pickedIds(required);
    trainingJobsApi.eligibility(personId, positionIds, ids.topics, ids.documentIds)
      .then((c) => { if (live) setCheck(c); })
      .catch(() => { if (live) setCheck(undefined); });
    return () => { live = false; };
  }, [personId, positionIds, required]);

  const positionTitle = (p: TrainingPosition) => `${p.name} (${p.departmentName})`;
  const positionLabel = (id: string) => {
    const role = positions.find((p) => p.id === id);
    return role ? positionTitle(role) : id;
  };
  const [positionQuery, setPositionQuery] = useState("");
  const selectedPositions = useMemo(() => positionIds.map((id) => positions.find((p) => p.id === id)).filter((p): p is TrainingPosition => Boolean(p)), [positionIds, positions]);
  const availablePositions = useMemo(() => {
    const q = positionQuery.trim().toLowerCase();
    return positions.filter((p) => p.departmentId && !held.some((h) => h.jobRoleId === p.id) && !positionIds.includes(p.id) && (!q || positionTitle(p).toLowerCase().includes(q)));
  }, [positions, held, positionIds, positionQuery]);
  const personLabel = people.find((p) => p.value === personId)?.label ?? "";
  const replacing = held.length > 0 && mode === "CHANGE";
  const stepOneReady = Boolean(personId) && positionIds.length > 0 && (!replacing || Boolean(changeReason.trim()));
  // the furthest step that can be opened: the later steps need the first one
  const furthest = stepOneReady ? STEPS.length - 1 : 0;

  const create = async () => {
    setBusy(true);
    try {
      const created = await trainingJobsApi.create({
        personUserId: personId,
        positionIds,
        duties: [],
        requiredTopics: pickedIds(required).topics,
        requiredDocumentIds: pickedIds(required).documentIds,
        ...(held.length > 0
          ? { mode, replacesPositionId: mode === "CHANGE" ? replaces || held[0].jobRoleId : undefined, changeReason: mode === "CHANGE" ? changeReason.trim() : undefined }
          : {}),
      });
      showToast({ type: "success", title: "Draft Created", message: created.personName });
      navigate(`${JOBS_ROUTE}/${created.id}`, { replace: true });
    } catch (e) {
      showToast({ type: "error", title: "The Assignment Was Not Created", message: trainingError(e) });
    } finally {
      setBusy(false);
    }
  };

  const checkBox = useMemo(() => {
    if (!check) return null;
    const missing = check.matrixMissing || (check.missingCount ?? 0) > 0;
    return (
      <div role="status" className={`rounded-lg border px-3 py-2 text-sm ${missing ? "border-amber-200 bg-amber-50 text-amber-900" : "border-emerald-200 bg-emerald-50 text-emerald-900"}`}>
        {check.matrixMissing ? "The department has no effective matrix: an exception is needed to go ahead." : (check.missingCount ?? 0) === 0 ? `Training check: complete (${check.items.length} required).` : (
          <>
            <p className="font-medium">Not trained yet ({check.missingCount} of {check.items.length}). The assignment cannot be signed until they are done, or an exception is approved:</p>
            <ul className="mt-1 list-disc pl-5">{check.items.filter((i) => !i.lastDone).map((i) => <li key={`${i.code}|${i.title}`}>{i.code ? `${i.code} — ` : ""}{i.title}{i.source === "CHOSEN" ? " (chosen)" : i.source === "FACTORY" ? " (all employees)" : ""}</li>)}</ul>
          </>
        )}
      </div>
    );
  }, [check]);

  const next = () => setStep((s) => Math.min(STEPS.length - 1, s + 1));
  const previous = () => setStep((s) => Math.max(0, s - 1));

  return (
    <div className="w-full space-y-4 md:space-y-6">
      <PageHeader
        title="New Job Assignment"
        breadcrumbItems={trainingBreadcrumbs(navigate, "jobs", "New Job Assignment")}
        actions={<Button onClick={goBack} size="sm" variant="outline-emerald" className="whitespace-nowrap">Back</Button>}
      />
      <WorkflowStepper steps={STEPS} currentStepIndex={step} onStepClick={(index) => { if (index <= furthest) setStep(index); }} />

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-3 md:px-5">
          <h2 className="text-sm font-semibold text-slate-800 sm:text-base">Step {step + 1} of {STEPS.length}: {STEPS[step]}</h2>
          <p className="mt-0.5 text-xs text-slate-500 sm:text-sm">
            {step === 0 && "Choose the employee and the Work Positions that are given. Each Work Position is checked against the matrix of its department."}
            {step === 1 && "Besides the matrix of the Work Positions: move the SOPs, or type a Training Topic, that the person must have completed first. This step is optional."}
            {step === 2 && "Check what will be created. A draft is created; the matrix training of the person is checked again before it can be sent."}
          </p>
        </div>
        <div className="p-4 md:p-5">
          {step === 0 && (
            <div className="grid gap-4">
              <div className="max-w-3xl">
                <FormField label="Employee" required>
                  <Select value={personId} onChange={setPersonId} options={people} onSearch={searchPeople} placeholder="Search by name" />
                </FormField>
              </div>
              <FormField label="Work Positions" required hint="One form can give several Work Positions. Move one with a double click or by dragging it to the other list.">
                <TransferPicker<TrainingPosition>
                  noun="work positions"
                  available={availablePositions}
                  selected={selectedPositions}
                  getKey={(p) => p.id}
                  getTitle={positionTitle}
                  onAdd={(items) => setPositionIds([...positionIds, ...items.map((p) => p.id).filter((id) => !positionIds.includes(id))])}
                  onRemove={(keys) => setPositionIds(positionIds.filter((id) => !keys.includes(id)))}
                  query={positionQuery}
                  onQueryChange={setPositionQuery}
                  availableSearchPlaceholder="Search by Work Position or department..."
                />
              </FormField>
              {held.length > 0 && (
                <>
                  <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">This person holds: {held.map((h) => h.positionName).join(", ")}.</p>
                  <FormField label="This Work Position" required>
                    <RadioGroup
                      name="job-mode"
                      layout="horizontal"
                      value={mode}
                      onChange={(v) => setMode(v as "CHANGE" | "ADDITIONAL")}
                      options={[
                        { label: "Is added to the ones held", value: "ADDITIONAL" },
                        { label: "Replaces one held", value: "CHANGE" },
                      ]}
                    />
                  </FormField>
                  {mode === "CHANGE" && (
                    <>
                      {held.length > 1 && (
                        <FormField label="Work Position to replace" required>
                          <Select value={replaces || held[0].jobRoleId} onChange={setReplaces} options={held.map((h) => ({ label: h.positionName, value: h.jobRoleId }))} />
                        </FormField>
                      )}
                      <FormField label="Reason for the change" required>
                        <Input value={changeReason} maxLength={500} onChange={(e) => setChangeReason(e.target.value)} />
                      </FormField>
                    </>
                  )}
                </>
              )}
            </div>
          )}

          {step === 1 && <RequiredTrainingsField value={required} onChange={setRequired} />}

          {step === 2 && (
            <div className="space-y-4">
              <ReadonlyGrid>
                <ReadonlyField label="Employee" value={personLabel} />
                <ReadonlyField label="Type" value={held.length === 0 ? "Initial" : mode === "CHANGE" ? "Change: replaces a Work Position held" : "Change: added to the Work Positions held"} />
                <ReadonlyField label="Work Positions" wide value={positionIds.map(positionLabel).join(", ")} />
                {replacing && <ReadonlyField label="Reason for the change" wide value={changeReason} />}
                <ReadonlyField label="Other Trainings Required" wide value={required.length === 0 ? "None: only the training that the matrix requires is checked" : required.map((p) => `${p.kind === "TOPIC" ? "Training Topic" : "SOP"}: ${p.title}`).join("; ")} />
              </ReadonlyGrid>
              {checkBox}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 md:gap-3">
        <Button onClick={goBack} size="sm" variant="outline-emerald" className="whitespace-nowrap">Cancel</Button>
        {step > 0 && <Button onClick={previous} size="sm" variant="outline-emerald" className="whitespace-nowrap"><IconArrowLeft className="mr-2 h-4 w-4" />Previous</Button>}
        {step < STEPS.length - 1 && (
          <Button onClick={next} size="sm" disabled={step === 0 && !stepOneReady} className="whitespace-nowrap">Next<IconArrowRight className="ml-2 h-4 w-4" /></Button>
        )}
        {step === STEPS.length - 1 && (
          <Button onClick={() => void create()} size="sm" loading={busy} loadingText="Creating..." disabled={!stepOneReady} className="whitespace-nowrap"><IconCheck className="mr-2 h-4 w-4" />Create Draft</Button>
        )}
      </div>
    </div>
  );
}
