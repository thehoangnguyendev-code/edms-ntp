import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button/Button";
import { FormField } from "@/components/ui/form/ResponsiveForm";
import { Input, Textarea } from "../../shared/TrainingFields";
import { Select } from "@/components/ui/select/Select";
import { RadioGroup } from "@/components/ui/radio";
import { trainingActivitiesApi, trainingMatrixApi, type TrainingPerson, type TrainingSession, type TrainingSuggestedParticipant, type TrainingTopic } from "@/services/api/trainingActivities";
import { ASSESSMENT_BY_METHOD, ASSESSMENT_LABEL, METHOD_LABEL } from "../../shared/trainingLabels";
import { TrainingDateField } from "../../shared/TrainingDateField";
import { TrainingAssigneePicker, type AssigneeSelection, type Outsider } from "./TrainingAssigneePicker";

export type SessionDraft = Parameters<typeof trainingActivitiesApi.addSession>[1];

const personOption = (p: TrainingPerson) => ({ label: `${p.fullName}${p.employeeCode ? ` (${p.employeeCode})` : ""}`, value: p.id });

/** Looks up people on the server as the person types (the department is applied by the server). */
export function PersonPicker({ value, onChange, label }: { value: string; onChange: (id: string) => void; label?: string }) {
  const [options, setOptions] = useState<{ label: string; value: string }[]>([]);
  const search = useCallback(async (query: string) => {
    const mapped = (await trainingActivitiesApi.people(query)).map(personOption);
    setOptions(mapped);
    return mapped;
  }, []);
  useEffect(() => { void search(""); }, [search]);
  return <Select label={label} value={value} onChange={onChange} options={options} onSearch={search} placeholder="Search by name" />;
}

const PLATFORMS = ["Zoom", "Microsoft Teams", "Google Meet", "Other"].map((p) => ({ label: p, value: p }));

/** The fields of one session, shown directly in the tab (no frame, no dialog). `onSave` gets the body of the session. */
export function SessionPanel({ busy = false, onSave, onDraft, saveText = "Add session", external = false }: { busy?: boolean; onSave?: (body: SessionDraft) => void; onDraft?: (body: SessionDraft | null) => void; saveText?: string; /** An external training: no method or assessment of its own (SOP.0003 5.1.2 is for internal training); the trainer is outside. */ external?: boolean }) {
  const empty = { method: "CLASSROOM", assessmentMethod: "TEST", instructor: "INTERNAL", trainerUserId: "", externalTrainerName: "", scheduledOn: "", locationType: "ONSITE", venue: "", platform: "Zoom", meetingLink: "", topic: "" };
  const [form, setForm] = useState(empty);
  const [topics, setTopics] = useState<TrainingTopic[]>([]);
  useEffect(() => { trainingMatrixApi.topics(undefined, true).then(setTopics).catch(() => setTopics([])); }, []);
  const trainerOk = external || (form.instructor === "INTERNAL" ? !!form.trainerUserId : !!form.externalTrainerName.trim());
  const placeOk = form.locationType === "ONSITE" ? !!form.venue.trim() : !!form.platform && /^https:\/\/\S+$/i.test(form.meetingLink.trim());
  const ready = form.topic.trim() && trainerOk && placeOk;
  const body = (): SessionDraft => ({
    method: external ? undefined : form.method, assessmentMethod: external ? undefined : form.assessmentMethod,
    trainerUserId: !external && form.instructor === "INTERNAL" ? form.trainerUserId : undefined,
    externalTrainerName: external ? form.externalTrainerName.trim() || undefined : form.instructor === "EXTERNAL" ? form.externalTrainerName.trim() : undefined,
    scheduledOn: form.scheduledOn || undefined,
    locationType: form.locationType as "ONSITE" | "ONLINE",
    venue: form.locationType === "ONSITE" ? form.venue.trim() : undefined,
    onlinePlatform: form.locationType === "ONLINE" ? form.platform : undefined,
    meetingLink: form.locationType === "ONLINE" ? form.meetingLink.trim() : undefined,
    topics: [{ topicText: form.topic.trim() }],
  });
  // The page that saves the session together with the activity reads the current form instead of a button.
  useEffect(() => { onDraft?.(ready ? body() : null); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, ready]);
  const save = () => {
    onSave?.(body());
    setForm(empty);
  };
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
        <div className="md:col-span-2">
          <Select label="Standard topic (optional)" value="" enableSearch placeholder="Pick a standard topic to fill the topic below"
            onChange={(id) => { const t = topics.find((x) => x.id === id); if (t) setForm({ ...form, topic: `${t.code} - ${t.name}` }); }}
            options={topics.map((t) => ({ label: `${t.code} — ${t.name}`, value: t.id }))} />
        </div>
        <div className="md:col-span-2"><FormField label="Topic" required><Input value={form.topic} maxLength={500} placeholder="What will be taught (a SOP, or a standard topic)" onChange={(e) => setForm({ ...form, topic: e.target.value })} /></FormField></div>
        {!external && <Select label="Mode" value={form.method} enableSearch={false} onChange={(v) => setForm({ ...form, method: v, assessmentMethod: ASSESSMENT_BY_METHOD[v][0] })} options={Object.entries(METHOD_LABEL).map(([value, label]) => ({ label, value }))} />}
        {!external && <Select label="Assessment" value={form.assessmentMethod} enableSearch={false} onChange={(v) => setForm({ ...form, assessmentMethod: v })} options={Object.entries(ASSESSMENT_LABEL).map(([value, label]) => ({ label: ASSESSMENT_BY_METHOD[form.method].includes(value) ? `${label} (SOP default)` : label, value }))} />}
        {!external && !ASSESSMENT_BY_METHOD[form.method].includes(form.assessmentMethod) && (
          <p className="text-xs text-amber-700 md:col-span-2">SOP.0003 5.1.2 gives {ASSESSMENT_LABEL[ASSESSMENT_BY_METHOD[form.method][0]]} for {METHOD_LABEL[form.method]}. A different way of assessment is allowed; it stays in the record of the session.</p>
        )}
        {external ? (
          <div className="md:col-span-2"><FormField label="Trainer (outside the company, optional)"><Input value={form.externalTrainerName} maxLength={255} placeholder="Name of the external trainer or consultant" onChange={(e) => setForm({ ...form, externalTrainerName: e.target.value })} /></FormField></div>
        ) : (
        <div className="space-y-3 md:col-span-2">
          <RadioGroup label="Instructor" required name="session-instructor" layout="horizontal" value={form.instructor} onChange={(v) => setForm({ ...form, instructor: String(v), trainerUserId: "", externalTrainerName: "" })}
            options={[{ label: "Internal expert", value: "INTERNAL" }, { label: "External expert/consultant", value: "EXTERNAL" }]} />
          {form.instructor === "INTERNAL"
            ? <PersonPicker value={form.trainerUserId} onChange={(id) => setForm({ ...form, trainerUserId: id })} />
            : <Input value={form.externalTrainerName} maxLength={255} placeholder="Name of the external expert or consultant" onChange={(e) => setForm({ ...form, externalTrainerName: e.target.value })} />}
        </div>
        )}
        <div className="md:col-span-2"><TrainingDateField label="Scheduled date" value={form.scheduledOn} onChange={(v) => setForm({ ...form, scheduledOn: v })} /></div>
        <div className="space-y-3 md:col-span-2">
          <RadioGroup label="Location Type" required name="session-location" layout="horizontal" value={form.locationType} onChange={(v) => setForm({ ...form, locationType: String(v) })}
            options={[{ label: "On-site (Physical)", value: "ONSITE" }, { label: "Online (Virtual)", value: "ONLINE" }]} />
          {form.locationType === "ONSITE" ? (
            <FormField label="Physical Location" required><Input value={form.venue} maxLength={255} placeholder="e.g., Training Room A" onChange={(e) => setForm({ ...form, venue: e.target.value })} /></FormField>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] md:gap-4">
              <Select label="Platform" value={form.platform} enableSearch={false} onChange={(v) => setForm({ ...form, platform: v })} options={PLATFORMS} />
              <FormField label="Meeting Link" required><Input value={form.meetingLink} placeholder="https://zoom.us/j/..." onChange={(e) => setForm({ ...form, meetingLink: e.target.value })} /></FormField>
            </div>
          )}
        </div>
      </div>
      {onSave && <div><Button size="sm" variant="outline-emerald" loading={busy} disabled={!ready} onClick={save}>{saveText}</Button></div>}
    </div>
  );
}

export type ParticipantsBody = { sessionId: string; personUserIds?: string[]; externals?: Outsider[]; reason: string };

/**
 * Add people to one session of an existing activity, inline in the tab: from the matrix, a Business Unit, a Department, one by one, or a person from outside.
 * The people the matrix requires need no reason; anyone else added by hand needs one, and it stays on the row.
 */
export function ParticipantsPanel({ activityId, session, busy, onSave }: { activityId: string; session: TrainingSession; busy: boolean; onSave: (body: ParticipantsBody) => void }) {
  const [matrix, setMatrix] = useState<TrainingSuggestedParticipant[]>();
  const [selection, setSelection] = useState<AssigneeSelection>({ personIds: [], outsiders: [] });
  const [reason, setReason] = useState("");
  useEffect(() => {
    setMatrix(undefined);
    trainingActivitiesApi.suggestedParticipants(activityId, session.id).then(setMatrix).catch(() => setMatrix([]));
  }, [activityId, session.id]);
  const matrixIds = new Set((matrix ?? []).map((m) => m.personId));
  const manual = selection.outsiders.length > 0 || selection.personIds.some((id) => !matrixIds.has(id));
  const count = selection.personIds.length + selection.outsiders.length;
  const ready = count > 0 && (!manual || reason.trim() !== "");
  return (
    <div className="space-y-4">
      <TrainingAssigneePicker matrix={matrix ?? []} onChange={setSelection} />
      {manual && <FormField label="Reason for adding by hand" required><Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} /></FormField>}
      <div className="flex items-center gap-3">
        <Button size="sm" variant="outline-emerald" loading={busy} disabled={!ready}
          onClick={() => onSave({ sessionId: session.id, personUserIds: selection.personIds.length ? selection.personIds : undefined, externals: selection.outsiders.length ? selection.outsiders : undefined, reason: manual ? reason.trim() : "Required by the training matrix" })}>
          Add {count || ""} {count === 1 ? "person" : "people"} to session {session.sessionNo}
        </Button>
        <span className="text-xs text-slate-500">People already in the session are skipped.</span>
      </div>
    </div>
  );
}

export type ParticipantsDraft = { personUserIds: string[]; externals: Outsider[]; reason: string };

/** The people of the session, chosen on the New screen before the activity exists: they are added to the session when the activity is saved. */
export function ParticipantsDraftPanel({ onDraft }: { onDraft: (draft: ParticipantsDraft | null) => void }) {
  const [selection, setSelection] = useState<AssigneeSelection>({ personIds: [], outsiders: [] });
  const [reason, setReason] = useState("");
  const count = selection.personIds.length + selection.outsiders.length;
  // Nobody here comes from the matrix, so every person added needs the reason that stays on the row.
  const ready = count > 0 && reason.trim() !== "";
  useEffect(() => {
    onDraft(ready ? { personUserIds: selection.personIds, externals: selection.outsiders, reason: reason.trim() } : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection, reason, ready]);
  return (
    <div className="space-y-4">
      <TrainingAssigneePicker onChange={setSelection} />
      <FormField label="Reason for adding by hand" required><Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} /></FormField>
      <p className="text-xs text-slate-500">{count} selected. They are added to the session when you save. The people the training matrix requires are offered on the next screen, after the activity is saved.</p>
    </div>
  );
}
