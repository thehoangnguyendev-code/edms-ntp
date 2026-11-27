import { useLeaveGuard } from "@/hooks/useLeaveGuard";
import { useFormDirty } from "@/hooks/useFormDirty";
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Briefcase, Repeat, UserRound } from "lucide-react";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { Button } from "@/components/ui/button/Button";
import { FormField } from "@/components/ui/form/ResponsiveForm";
import { FormSection } from "@/components/ui/form/FormSection";
import { Select } from "@/components/ui/select/Select";
import { RadioGroup } from "@/components/ui/radio";
import { Badge } from "@/components/ui/badge/Badge";
import { WorkflowStepper } from "@/components/ui/workflow-stepper/WorkflowStepper";
import { useToast } from "@/components/ui/toast/Toast";
import { Input } from "../shared/TrainingFields";
import { ReadonlyField, ReadonlyGrid } from "../shared/TrainingDetailLayout";
import { RequiredTrainingsField, pickedIds, trainingKey, trainingLabel, type PickedTraining } from "./RequiredTrainingsField";
import { Chips, JobAssignmentSummary, TrainingCheck, type CheckState } from "./JobAssignmentSummary";
import { WorkPositionChecklist } from "./WorkPositionChecklist";
import {
  type TrainingEligibility,
  type TrainingPerson,
  type TrainingPosition,
  trainingActivitiesApi,
  trainingError,
  trainingJobsApi,
  trainingWorkPositionApi,
} from "@/services/api/trainingActivities";
import { trainingBreadcrumbs } from "../shared/trainingLabels";
import { useTrainingBack } from "../shared/useTrainingBack";
import { tr, trFormat } from "@/i18n";
import { IconChecklist, IconPencilMinus, IconSchool } from "@tabler/icons-react";

const STEPS = [
  "Employee and Work Positions",
  "Other Trainings",
  "Review and Create",
];
const STEP_ICONS = [UserRound, IconSchool, IconChecklist ];
const JOBS_ROUTE = "/training-management/job-assignments";

// A card whose description is guidance that must be read whole: the text wraps beside the badge or button instead of being cut or pushing it down.
const LONG_HEADER = "[&>div:first-child_p]:whitespace-normal [&>div:first-child>div:first-child]:flex-1 [&>div:first-child>div:first-child]:basis-0";

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
  // The chosen Work Positions as the list gave them: the list is paged, so a chosen one may not be on the page that is shown.
  const [picked, setPicked] = useState<Record<string, TrainingPosition>>({});
  const [people, setPeople] = useState<{ label: string; value: string }[]>([]);
  const [personId, setPersonId] = useState("");
  // A link from an alert names the person (?person=<id>&name=<full name>): the person is chosen already.
  const [linkParams] = useSearchParams();
  // The chosen person is kept apart from the search results: a later search must not lose what the summary shows.
  const [found, setFound] = useState<Record<string, TrainingPerson>>({});
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
  const [checkFailed, setCheckFailed] = useState(false);
  const [checkAttempt, setCheckAttempt] = useState(0);

  const searchPeople = useCallback(async (query: string) => {
    const list = await trainingActivitiesApi.people(query);
    const mapped = list.map((p) => ({
      label: `${p.fullName}${p.employeeCode ? ` (${p.employeeCode})` : ""}`,
      value: p.id,
    }));
    setPeople(mapped);
    setFound((known) => ({ ...known, ...Object.fromEntries(list.map((p) => [p.id, p])) }));
    return mapped;
  }, []);
  useEffect(() => {
    const wanted = linkParams.get("person");
    const name = linkParams.get("name") ?? "";
    void searchPeople(name).then((list) => {
      if (wanted && list.some((p) => p.value === wanted)) setPersonId(wanted);
    });
  }, [searchPeople, linkParams]);
  useEffect(() => {
    setHeld([]);
    setReplaces("");
    if (!personId) return;
    let live = true;
    trainingWorkPositionApi
      .of(personId)
      .then((w) => {
        if (live)
          setHeld((w.roles ?? []).filter((r) => r.source === "JOB_ASSIGNMENT"));
      })
      .catch(() => {
        if (live) setHeld([]);
      });
    return () => {
      live = false;
    };
  }, [personId]);
  useEffect(() => {
    setCheck(undefined);
    setCheckFailed(false);
    if (!personId || positionIds.length === 0) return;
    let live = true;
    const ids = pickedIds(required);
    trainingJobsApi
      .eligibility(personId, positionIds, ids.topics, ids.documentIds)
      .then((c) => {
        if (live) setCheck(c);
      })
      .catch(() => {
        if (live) setCheckFailed(true);
      });
    return () => {
      live = false;
    };
  }, [personId, positionIds, required, checkAttempt]);

  const positionTitle = (p: TrainingPosition) =>
    `${p.name} (${p.departmentName})`;
  const positionLabel = (id: string) => {
    const role = picked[id];
    return role ? positionTitle(role) : id;
  };
  // Leaving with a change that was not saved asks first (Back, the breadcrumb, the sidebar, a reload); the move after the job assignment is created is not a leave.
  const { isDirty } = useFormDirty({ personId, positionIds, mode, replaces, changeReason, required });
  const { go, confirmLeave, modal: leaveModal } = useLeaveGuard(isDirty, "New Job Assignment", "the previous page");
  const personLabel = people.find((p) => p.value === personId)?.label ?? "";
  const replacing = held.length > 0 && mode === "CHANGE";
  const stepOneReady =
    Boolean(personId) &&
    positionIds.length > 0 &&
    (!replacing || Boolean(changeReason.trim()));
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
          ? {
              mode,
              replacesPositionId:
                mode === "CHANGE" ? replaces || held[0].jobRoleId : undefined,
              changeReason: mode === "CHANGE" ? changeReason.trim() : undefined,
            }
          : {}),
      });
      showToast({
        type: "success",
        title: tr("Draft Created"),
        message: created.personName,
      });
      navigate(`${JOBS_ROUTE}/${created.id}`, { replace: true });
    } catch (e) {
      showToast({
        type: "error",
        title: tr("The Assignment Was Not Created"),
        message: trainingError(e),
      });
    } finally {
      setBusy(false);
    }
  };

  const next = () => setStep((s) => Math.min(STEPS.length - 1, s + 1));
  const previous = () => setStep((s) => Math.max(0, s - 1));
  const person = found[personId];
  const checkState: CheckState = !personId || positionIds.length === 0 ? "idle" : checkFailed ? "error" : check ? "ready" : "loading";
  const retryCheck = () => setCheckAttempt((a) => a + 1);
  const togglePosition = (id: string) =>
    setPositionIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  const pickPosition = (position: TrainingPosition) => {
    setPicked((known) => ({ ...known, [position.id]: position }));
    togglePosition(position.id);
  };
  const positionChips = positionIds.map((id) => ({ id, label: positionLabel(id) }));
  const trainingChips = required.map((p) => ({ id: trainingKey(p), label: trainingLabel(p) }));
  const removeTraining = (key: string) => setRequired((list) => list.filter((p) => trainingKey(p) !== key));
  const typeLabel =
    held.length === 0
      ? tr("Initial")
      : mode === "CHANGE"
        ? tr("Change: replaces a Work Position held")
        : tr("Change: added to the Work Positions held");
  const editButton = (target: number) => (
    <Button size="sm" variant="default" onClick={() => setStep(target)} className="gap-1.5">
      <IconPencilMinus className="h-4 w-4" />
      {tr("Edit")}
    </Button>
  );

  return (
    <div className="w-full space-y-4 md:space-y-6">
      <PageHeader
        title={tr("New Job Assignment")}
        breadcrumbItems={trainingBreadcrumbs(
          go,
          "jobs",
          "New Job Assignment",
        )}
        actions={
          <Button
            onClick={() => confirmLeave(goBack)}
            size="sm"
            variant="outline-emerald"
            className="whitespace-nowrap"
          >
            {tr("Back")}
          </Button>
        }
      />
      <WorkflowStepper
        steps={STEPS}
        currentStepIndex={step}
        icons={STEP_ICONS}
        onStepClick={(index) => {
          if (index <= furthest) setStep(index);
        }}
      />

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.18 }}
          className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start"
        >
          <div className="min-w-0 space-y-4">
            {step === 0 && (
              <>
                {/* FormSection clips its content: the open list of the employee select is drawn in a portal, so nothing is lost. */}
                <FormSection title={tr("Employee")} icon={<UserRound className="h-4 w-4" />}>
                  <FormField label={tr("Employee")} required>
                    <Select
                      value={personId}
                      onChange={setPersonId}
                      options={people}
                      onSearch={searchPeople}
                      placeholder={tr("Search by name")}
                    />
                  </FormField>
                </FormSection>
                <FormSection
                  title={tr("Work Positions")}
                  icon={<Briefcase className="h-4 w-4" />}
                  description={tr("Choose the employee and the Work Positions that are given. Each Work Position is checked against the matrix of its department.")}
                  className={LONG_HEADER}
                  headerRight={<Badge color={positionIds.length ? "emerald" : "slate"}>{trFormat("{count} selected", { count: positionIds.length })}</Badge>}
                >
                  <WorkPositionChecklist
                    selectedIds={positionIds}
                    excludedIds={held.map((h) => h.jobRoleId)}
                    onToggle={pickPosition}
                  />
                </FormSection>
                {held.length > 0 && (
                  <FormSection title={tr("This Work Position")} icon={<Repeat className="h-4 w-4" />}>
                    <div className="space-y-4">
                      <RadioGroup
                        name="job-mode"
                        layout="horizontal"
                        variant="card"
                        value={mode}
                        onChange={(v) => setMode(v as "CHANGE" | "ADDITIONAL")}
                        options={[
                          { label: tr("Is added to the ones held"), value: "ADDITIONAL" },
                          { label: tr("Replaces one held"), value: "CHANGE" },
                        ]}
                      />
                      {mode === "CHANGE" && (
                        <>
                          {held.length > 1 && (
                            <FormField label={tr("Work Position to replace")} required>
                              <Select
                                value={replaces || held[0].jobRoleId}
                                onChange={setReplaces}
                                options={held.map((h) => ({ label: h.positionName, value: h.jobRoleId }))}
                              />
                            </FormField>
                          )}
                          <FormField label={tr("Reason for the change")} required>
                            <Input value={changeReason} maxLength={500} onChange={(e) => setChangeReason(e.target.value)} />
                          </FormField>
                        </>
                      )}
                    </div>
                  </FormSection>
                )}
              </>
            )}

            {step === 1 && (
              <FormSection
                title={tr("Other Trainings")}
                icon={<IconSchool className="h-4 w-4" />}
                description={tr("Besides the matrix of the Work Positions: tick the SOPs, or type a Training Topic, that the person must have completed first. This step is optional.")}
                className={LONG_HEADER}
                headerRight={<Badge color={required.length ? "emerald" : "slate"}>{trFormat("{count} selected", { count: required.length })}</Badge>}
              >
                <RequiredTrainingsField value={required} onChange={setRequired} />
              </FormSection>
            )}

            {step === 2 && (
              <>
                <FormSection
                  title={tr("Employee")}
                  icon={<UserRound className="h-4 w-4" />}
                  description={tr("Check what will be created. A draft is created; the matrix training of the person is checked again before it can be sent.")}
                  className={LONG_HEADER}
                  headerRight={editButton(0)}
                >
                  <ReadonlyGrid>
                    <ReadonlyField label={tr("Employee")} value={personLabel} />
                    <ReadonlyField label={tr("Type")} value={typeLabel} />
                    {replacing && <ReadonlyField label={tr("Reason for the change")} wide value={changeReason} />}
                  </ReadonlyGrid>
                </FormSection>
                <FormSection title={tr("Work Positions")} icon={<Briefcase className="h-4 w-4" />} headerRight={editButton(0)}>
                  <Chips items={positionChips} empty={tr("No Work Position selected")} />
                </FormSection>
                <FormSection title={tr("Other Trainings Required")} icon={<IconSchool className="h-4 w-4" />} headerRight={editButton(1)}>
                  <Chips items={trainingChips} empty={tr("None: only the training that the matrix requires is checked")} />
                </FormSection>
              </>
            )}
          </div>

          <aside className="min-w-0 space-y-4 xl:sticky xl:top-4" aria-label={tr("Summary")}>
            {step === 2 ? (
              <FormSection title={tr("Training check")} icon={<IconChecklist className="h-4 w-4" />}>
                <TrainingCheck state={checkState} check={check} onRetry={retryCheck} />
              </FormSection>
            ) : (
              <JobAssignmentSummary
                person={person}
                held={held.map((h) => h.positionName)}
                positions={positionChips}
                trainings={trainingChips}
                onRemovePosition={togglePosition}
                onRemoveTraining={removeTraining}
                checkState={checkState}
                check={check}
                onRetry={retryCheck}
              />
            )}
          </aside>
        </motion.div>
      </AnimatePresence>

      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => confirmLeave(goBack)} size="sm" variant="outline-emerald">
            {tr("Cancel")}
          </Button>
          {step > 0 && (
            <Button onClick={previous} size="sm" variant="outline-emerald">
              {tr("Back:")} {tr(STEPS[step - 1])}
            </Button>
          )}
        </div>
        <div className="ml-auto">
          {step < STEPS.length - 1 ? (
            <Button onClick={next} size="sm" variant="default" disabled={step === 0 && !stepOneReady}>
              {tr("Next:")} {tr(STEPS[step + 1])}
            </Button>
          ) : (
            <Button
              onClick={() => void create()}
              size="sm"
              variant="default"
              loading={busy}
              loadingText={tr("Creating...")}
              disabled={!stepOneReady}
            >
              {tr("Create Draft")}
            </Button>
          )}
        </div>
      </div>
      {leaveModal}
    </div>
  );
}
