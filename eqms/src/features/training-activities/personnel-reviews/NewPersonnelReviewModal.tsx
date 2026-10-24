import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FormModal } from "@/components/ui/modal/FormModal";
import { FormField } from "@/components/ui/form/ResponsiveForm";
import { Select } from "@/components/ui/select/Select";
import { useToast } from "@/components/ui/toast/Toast";
import { trainingActivitiesApi, trainingCodeText, trainingError, trainingReviewsApi, type TrainingReviewPlan } from "@/services/api/trainingActivities";
import { Input, Textarea } from "../shared/TrainingFields";
import { TrainingDateField } from "../shared/TrainingDateField";
import { useDepartmentNameOptions } from "../shared/useListFilters";
import { REVIEW_KIND_LABEL } from "./personnelReviewLabels";

export interface NewReviewForm {
  personId: string;
  kind: string;
  eventDate: string;
  absenceFrom: string;
  absenceTo: string;
  departmentTo: string;
  note: string;
}

export const emptyReviewForm: NewReviewForm = {
  personId: "",
  kind: "",
  eventDate: "",
  absenceFrom: "",
  absenceTo: "",
  departmentTo: "",
  note: "",
};

interface NewPersonnelReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** What the dialog starts from (a new employee found in the user profiles opens it already filled in). */
  initialForm?: NewReviewForm;
  /** The person the dialog starts from, so that the list of the select has a name for the id. */
  initialPeople?: { label: string; value: string }[];
}

const pad = (n: number) => String(n).padStart(2, "0");
const toIso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
/** The date `months` after an ISO date, the day kept or cut to the end of a shorter month (as the server does). */
const addMonths = (iso: string, months: number) => {
  const [y, m, d] = iso.split("-").map(Number);
  const last = new Date(y, m - 1 + months + 1, 0).getDate();
  return toIso(new Date(y, m - 1 + months, Math.min(d, last)));
};

/**
 * Opens a training review of one person. The fields are filled in order, each one after the one before it: the employee, the event, what the event asks for
 * (the dates of an absence, the new department of a transfer), then the date of the event. The department the employee comes from and the head of the department who
 * closes the review come from the records and cannot be typed. The dates follow SOP.0003: an event has already happened, and a return follows an absence of more than
 * the months set in Training Properties (the server checks the same rules).
 */
export const NewPersonnelReviewModal: React.FC<NewPersonnelReviewModalProps> = ({ isOpen, onClose, initialForm = emptyReviewForm, initialPeople = [] }) => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [form, setForm] = useState<NewReviewForm>(initialForm);
  const [people, setPeople] = useState(initialPeople);
  const [plan, setPlan] = useState<TrainingReviewPlan>();
  const [isSaving, setIsSaving] = useState(false);
  const departments = useDepartmentNameOptions();

  const searchPeople = useCallback(async (query: string) => {
    const list = await trainingActivitiesApi.people(query).catch(() => []);
    const mapped = list.map((p) => ({ label: `${p.fullName}${p.employeeCode ? ` (${p.employeeCode})` : ""}`, value: p.id }));
    setPeople(mapped);
    return mapped;
  }, []);

  // The records answer for the department of the employee and for the head who closes the review; asked again when the employee, the event or the new department changes.
  useEffect(() => {
    if (!form.personId) { setPlan(undefined); return; }
    let current = true;
    trainingReviewsApi.plan({ personId: form.personId, kind: form.kind || undefined, departmentTo: form.departmentTo || undefined })
      .then((p) => { if (current) setPlan(p); })
      .catch(() => { if (current) setPlan(undefined); });
    return () => { current = false; };
  }, [form.personId, form.kind, form.departmentTo]);

  const isTransfer = form.kind === "DEPT_TRANSFER" || form.kind === "LOCATION_TRANSFER";
  const isAbsence = form.kind === "ABSENCE_RETURN";
  const today = toIso(new Date());
  const months = plan?.absenceRetrainMonths ?? 6;

  const absenceFromError = form.absenceFrom && form.absenceFrom > today ? "The absence cannot start in the future." : "";
  const absenceToError = !form.absenceTo ? ""
    : form.absenceTo < form.absenceFrom ? "Absent until cannot be before Absent from."
    : form.absenceTo > today ? "The last day of the absence cannot be in the future."
    : form.absenceTo <= addMonths(form.absenceFrom, months) ? `SOP.0003 asks for a review after an absence of more than ${months} months.` : "";
  const eventDateError = !form.eventDate ? ""
    : form.eventDate > today ? "The date cannot be later than today: the event has already happened."
    : isAbsence && form.absenceTo && form.eventDate < form.absenceTo ? "The return date cannot be before the last day of the absence." : "";

  // A problem the records report is shown at the field that explains it; "choose the new department" is only the order of the fields.
  const planProblem = plan?.problem && plan.problem !== "TRAINING_REVIEW_DEPARTMENT_REQUIRED" ? trainingCodeText(plan.problem) : "";
  const departmentOptions = useMemo(
    () => departments.filter((d) => form.kind !== "DEPT_TRANSFER" || d.value.trim().toLowerCase() !== (plan?.departmentFrom ?? "").trim().toLowerCase()),
    [departments, form.kind, plan?.departmentFrom],
  );

  const kindReady = Boolean(form.personId && form.kind);
  const transferReady = !isTransfer || Boolean(form.departmentTo);
  const absenceReady = !isAbsence || Boolean(form.absenceFrom && form.absenceTo && !absenceFromError && !absenceToError);
  const dateEnabled = kindReady && transferReady && absenceReady;
  const dateReady = dateEnabled && Boolean(form.eventDate) && !eventDateError;
  const isValid = dateReady && Boolean(plan?.closerUserId) && !plan?.problem;

  const handleCreate = async () => {
    setIsSaving(true);
    try {
      const created = await trainingReviewsApi.create({
        personUserId: form.personId,
        kind: form.kind,
        eventDate: form.eventDate,
        absenceFrom: isAbsence ? form.absenceFrom : undefined,
        absenceTo: isAbsence ? form.absenceTo : undefined,
        departmentTo: isTransfer ? form.departmentTo : undefined,
        note: form.note.trim() || undefined,
      });
      showToast({ type: "success", title: "Review opened", message: created.fullName });
      onClose();
      navigate(`/training-management/personnel-reviews/${created.id}`);
    } catch (error) {
      showToast({ type: "error", title: "The review was not opened", message: trainingError(error) });
    } finally {
      setIsSaving(false);
    }
  };

  const eventDateLabel = isAbsence ? "Return date" : isTransfer ? "Transfer date" : "Start date";
  const eventDateField = (
    <TrainingDateField label={eventDateLabel} hint={isAbsence ? "The day the employee came back: on or after the last day of the absence, and not later than today." : "The event has already happened: the date cannot be later than today."} value={form.eventDate} disabled={!dateEnabled} error={eventDateError || undefined} onChange={(value) => setForm({ ...form, eventDate: value })} />
  );

  return (
    <FormModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={() => void handleCreate()}
      title="Open a Training Review"
      confirmText="Open review"
      isLoading={isSaving}
      confirmDisabled={!isValid}
      size="2xl"
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <FormField label="Employee" required hint="Choose the employee first: the other fields follow it.">
          <Select
            value={form.personId}
            onChange={(value) => setForm({ ...emptyReviewForm, personId: value })}
            options={people}
            onSearch={searchPeople}
            placeholder="Search by name"
          />
        </FormField>
        <FormField label="Event">
          <Select
            value={form.kind}
            enableSearch={false}
            disabled={!form.personId}
            placeholder={form.personId ? "Choose the event" : "Choose the employee first"}
            onChange={(value) => setForm({ ...emptyReviewForm, personId: form.personId, kind: value })}
            options={Object.entries(REVIEW_KIND_LABEL).map(([value, label]) => ({ label, value }))}
          />
        </FormField>

        {isTransfer && (
          <>
            <FormField label={form.kind === "LOCATION_TRANSFER" ? "Previous site / department" : "Previous department"} hint="The department the employee works in now. It cannot be changed here.">
              <Input readOnly value={plan?.departmentFrom ?? ""} placeholder="The department of the employee" />
            </FormField>
            <FormField label={form.kind === "LOCATION_TRANSFER" ? "New site / department" : "New department"} required hint="The head of this department closes the review.">
              <Select
                value={form.departmentTo}
                disabled={!kindReady}
                options={departmentOptions}
                placeholder="Choose the new department"
                onChange={(value) => setForm({ ...form, departmentTo: value, eventDate: "" })}
              />
            </FormField>
          </>
        )}

        {isAbsence && (
          <>
            <TrainingDateField label="Absent From" hint="First day of the absence. It cannot be in the future." value={form.absenceFrom} disabled={!kindReady} error={absenceFromError || undefined}
              onChange={(value) => setForm({ ...form, absenceFrom: value, absenceTo: "", eventDate: "" })} />
            <TrainingDateField label="Absent Until (last day of the absence)" hint={`Must be more than ${months} months after the first day (SOP.0003), and not in the future.`} value={form.absenceTo} disabled={!form.absenceFrom || Boolean(absenceFromError)} error={absenceToError || undefined}
              onChange={(value) => setForm({ ...form, absenceTo: value, eventDate: "" })} />
          </>
        )}

        {eventDateField}
        <FormField label="Person Who Closes The Review" required hint="Set automatically.">
          <Input readOnly error={Boolean(planProblem)} value={plan?.closerName ?? ""} placeholder="The head of the department" />
          {planProblem && <p role="alert" className="mt-1 text-xs text-red-600">{planProblem}</p>}
        </FormField>

        <div className="md:col-span-2">
          <FormField label="Description" hint="Optional. Say why the review is opened, if the date and the event do not tell it.">
            <Textarea rows={3} maxLength={1000} disabled={!dateReady} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </FormField>
        </div>
      </div>
    </FormModal>
  );
};
