import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button/Button";
import { FormField } from "@/components/ui/form/ResponsiveForm";
import { Input, Textarea } from "../../shared/TrainingFields";
import { Select } from "@/components/ui/select/Select";
import { RadioGroup } from "@/components/ui/radio";
import { trainingActivitiesApi, type TrainingPerson, type TrainingSession, type TrainingSuggestedParticipant } from "@/services/api/trainingActivities";
import { ASSESSMENT_BY_METHOD, ASSESSMENT_LABEL, METHOD_LABEL } from "../../shared/trainingLabels";
import { TrainingDateField, DATE_HINT } from "../../shared/TrainingDateField";
import { TrainingAssigneePicker, type AssigneeSelection, type Outsider } from "./TrainingAssigneePicker";
import { Plus, X } from "lucide-react";
import { tr, trFormat } from "@/i18n";

export type SessionDraft = Parameters<typeof trainingActivitiesApi.addSession>[1];

/** The fields of the form of a session. */
export type SessionFormValues = { method: string; assessmentMethod: string; instructor: string; trainerUserId: string; externalTrainerName: string; scheduledOn: string; locationType: string; venue: string; platform: string; meetingLink: string; topic: string; moreTopics: string[] };

/** The form of a new session that starts as a copy of another: everything but the day, which is the one thing a copy changes. */
export function sessionFormFrom(source: SessionDraft | TrainingSession): Partial<SessionFormValues> {
  const topics = source.topics ?? [];
  const internal = Boolean(source.trainerUserId);
  return {
    method: source.method ?? "CLASSROOM",
    assessmentMethod: source.assessmentMethod ?? "TEST",
    instructor: internal || !source.externalTrainerName ? "INTERNAL" : "EXTERNAL",
    trainerUserId: source.trainerUserId ?? "",
    externalTrainerName: source.externalTrainerName ?? "",
    scheduledOn: "",
    locationType: source.locationType ?? "ONSITE",
    venue: source.venue ?? "",
    platform: source.onlinePlatform ?? "Zoom",
    meetingLink: source.meetingLink ?? "",
    topic: topics[0]?.topicText ?? "",
    moreTopics: topics.slice(1).map((t) => t.topicText),
  };
}

const personOption = (p: TrainingPerson) => ({ label: `${p.fullName}${p.employeeCode ? ` (${p.employeeCode})` : ""}`, value: p.id });

/** Looks up people on the server as the person types (the department is applied by the server). */
export function PersonPicker({ value, onChange, label, initialLabel }: { value: string; onChange: (id: string, name: string) => void; label?: string; /** The name of the person already chosen, shown before the search has found them. */ initialLabel?: string }) {
  const [options, setOptions] = useState<{ label: string; value: string }[]>([]);
  const search = useCallback(async (query: string) => {
    const mapped = (await trainingActivitiesApi.people(query)).map(personOption);
    setOptions(mapped);
    return mapped;
  }, []);
  useEffect(() => { void search(""); }, [search]);
  const shown = value && initialLabel && !options.some((o) => o.value === value) ? [{ label: initialLabel, value }, ...options] : options;
  return <Select label={label} value={value} onChange={(id) => onChange(id, shown.find((o) => o.value === id)?.label ?? "")} options={shown} onSearch={search} placeholder={tr("Search by name")} />;
}

const PLATFORMS = ["Zoom", "Microsoft Teams", "Google Meet", "Other"].map((p) => ({ label: p, value: p }));

/** The fields of one session, shown directly in the tab (no frame, no dialog). `onSave` gets the body of the session. */
export function SessionPanel({ dueDate, busy = false, onSave, onDraft, saveText = "Add session", external = false, initialTopic, documentRevisionId, initialForm, initialTrainerName }: { /** The name of the trainer the form starts with. */ initialTrainerName?: string; /** What the form starts with (a session that is copied): the fields of the session, the date left empty. */ initialForm?: Partial<SessionFormValues>;  /** The topic is filled in when the screen opens (the number and the name of the document for a training that comes from Document Control); the person can edit it. */ initialTopic?: string; /** The revision of the document the training is about: the topic is then linked to it. */ documentRevisionId?: string; busy?: boolean; onSave?: (body: SessionDraft) => void; onDraft?: (body: SessionDraft | null, meta?: { trainerName?: string }) => void; saveText?: string; /** The Due Date of the activity, shown on the same row as the Scheduled date. */ dueDate?: ReactNode; /** An external training: no method or assessment of its own (SOP.0003 5.1.2 is for internal training); the trainer is outside. */ external?: boolean }) {
  const empty = { method: "CLASSROOM", assessmentMethod: "TEST", instructor: "INTERNAL", trainerUserId: "", externalTrainerName: "", scheduledOn: "", locationType: "ONSITE", venue: "", platform: "Zoom", meetingLink: "", topic: "", moreTopics: [] as string[] };
  const [form, setForm] = useState({ ...empty, topic: initialTopic ?? "", ...(initialForm ?? {}) });
  const [trainerName, setTrainerName] = useState(initialTrainerName ?? "");
  const trainerOk = external || (form.instructor === "INTERNAL" ? !!form.trainerUserId : !!form.externalTrainerName.trim());
  const linkOk = !!form.platform && /^https:\/\/\S+$/i.test(form.meetingLink.trim());
  const placeOk = form.locationType === "ONSITE" ? !!form.venue.trim() : form.locationType === "HYBRID" ? !!form.venue.trim() && linkOk : linkOk;
  const ready = form.topic.trim() && trainerOk && placeOk;
  const body = (): SessionDraft => ({
    method: external ? undefined : form.method, assessmentMethod: external ? undefined : form.assessmentMethod,
    trainerUserId: !external && form.instructor === "INTERNAL" ? form.trainerUserId : undefined,
    externalTrainerName: external ? form.externalTrainerName.trim() || undefined : form.instructor === "EXTERNAL" ? form.externalTrainerName.trim() : undefined,
    scheduledOn: form.scheduledOn || undefined,
    locationType: form.locationType as "ONSITE" | "ONLINE" | "HYBRID",
    venue: form.locationType !== "ONLINE" ? form.venue.trim() : undefined,
    onlinePlatform: form.locationType !== "ONSITE" ? form.platform : undefined,
    meetingLink: form.locationType !== "ONSITE" ? form.meetingLink.trim() : undefined,
    topics: [{ topicText: form.topic.trim(), documentRevisionId }, ...form.moreTopics.map((t) => t.trim()).filter(Boolean).map((topicText) => ({ topicText }))],
  });
  // The page that saves the session together with the activity reads the current form instead of a button.
  useEffect(() => { onDraft?.(ready ? body() : null, { trainerName: form.instructor === "INTERNAL" ? trainerName : form.externalTrainerName.trim() }); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, ready, trainerName]);
  const save = () => {
    onSave?.(body());
    setForm({ ...empty, topic: initialTopic ?? "" });
  };
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
        <div className="space-y-2 md:col-span-2">
          <FormField label={tr("Training Topic")} required><Input value={form.topic} maxLength={500} placeholder={tr("What will be taught, e.g., SOP.0009 Qualification of equipment and systems")} onChange={(e) => setForm({ ...form, topic: e.target.value })} /></FormField>
          {form.moreTopics.map((topic, index) => (
            <div key={index} className="flex items-center gap-2">
              <Input value={topic} maxLength={500} placeholder={tr("Another topic of the same session")} onChange={(e) => setForm({ ...form, moreTopics: form.moreTopics.map((t, i) => (i === index ? e.target.value : t)) })} />
              <button type="button" aria-label={tr("Remove topic")} onClick={() => setForm({ ...form, moreTopics: form.moreTopics.filter((_, i) => i !== index) })} className="flex-shrink-0 rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100"><X className="h-4 w-4" /></button>
            </div>
          ))}
          <button type="button" onClick={() => setForm({ ...form, moreTopics: [...form.moreTopics, ""] })} className="inline-flex items-center gap-1 text-sm font-medium text-emerald-600 hover:underline"><Plus className="h-4 w-4" />{tr("Add another topic")}</button>
          <p className="!mt-1.5 text-xs text-slate-500">{tr("Use this when the same trainer teaches the same group more than one subject in this session (SOP.0003 4.2). A different trainer, group, day or place is another session: use Add session.")}</p>
        </div>
        {!external && <Select label={tr("Mode")} value={form.method} enableSearch={false} onChange={(v) => setForm({ ...form, method: v, assessmentMethod: ASSESSMENT_BY_METHOD[v][0] })} options={Object.entries(METHOD_LABEL).map(([value, label]) => ({ label, value }))} />}
        {!external && <Select label={tr("Assessment")} value={form.assessmentMethod} enableSearch={false} onChange={(v) => setForm({ ...form, assessmentMethod: v })} options={Object.entries(ASSESSMENT_LABEL).map(([value, label]) => ({ label: ASSESSMENT_BY_METHOD[form.method].includes(value) ? `${label} (SOP default)` : label, value }))} />}
        {!external && !ASSESSMENT_BY_METHOD[form.method].includes(form.assessmentMethod) && (
          <p className="text-xs text-amber-700 md:col-span-2">{trFormat("SOP.0003 5.1.2 gives {assessment} for {method}. A different way of assessment is allowed; it stays in the record of the session.", { assessment: ASSESSMENT_LABEL[ASSESSMENT_BY_METHOD[form.method][0]], method: METHOD_LABEL[form.method] })}</p>
        )}
        {external ? (
          <div className="md:col-span-2"><FormField label={tr("Trainer (outside the company, optional)")}><Input value={form.externalTrainerName} maxLength={255} placeholder={tr("Name of the external trainer or consultant")} onChange={(e) => setForm({ ...form, externalTrainerName: e.target.value })} /></FormField></div>
        ) : (
        <div className="space-y-3 md:col-span-2">
          <RadioGroup label={tr("Instructor")} required name="session-instructor" layout="horizontal" value={form.instructor} onChange={(v) => setForm({ ...form, instructor: String(v), trainerUserId: "", externalTrainerName: "" })}
            options={[{ label: tr("Internal expert"), value: "INTERNAL" }, { label: tr("External expert/consultant"), value: "EXTERNAL" }]} />
          {form.instructor === "INTERNAL"
            ? <PersonPicker value={form.trainerUserId} initialLabel={trainerName} onChange={(id, name) => { setTrainerName(name); setForm({ ...form, trainerUserId: id }); }} />
            : <Input value={form.externalTrainerName} maxLength={255} placeholder={tr("Name of the external expert or consultant")} onChange={(e) => setForm({ ...form, externalTrainerName: e.target.value })} />}
        </div>
        )}
        {dueDate ? <div>{dueDate}</div> : null}
        <div className={dueDate ? undefined : "md:col-span-2"}><TrainingDateField label={tr("Scheduled date")} hint={DATE_HINT.scheduled} value={form.scheduledOn} onChange={(v) => setForm({ ...form, scheduledOn: v })} /></div>
        <div className="space-y-3 md:col-span-2">
          <RadioGroup label={tr("Location Type")} required name="session-location" layout="horizontal" value={form.locationType} onChange={(v) => setForm({ ...form, locationType: String(v) })}
            options={[{ label: tr("On-site (Physical)"), value: "ONSITE" }, { label: tr("Online (Virtual)"), value: "ONLINE" }, { label: tr("Hybrid (On-site and Online)"), value: "HYBRID" }]} />
          {form.locationType !== "ONLINE" && (
            <FormField label={tr("Physical Location")} required><Input value={form.venue} maxLength={255} placeholder={tr("e.g., Training Room A")} onChange={(e) => setForm({ ...form, venue: e.target.value })} /></FormField>
          )}
          {form.locationType !== "ONSITE" && (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] md:gap-4">
              <Select label={tr("Platform")} value={form.platform} enableSearch={false} onChange={(v) => setForm({ ...form, platform: v })} options={PLATFORMS} />
              <FormField label={tr("Meeting Link")} required><Input value={form.meetingLink} placeholder="https://zoom.us/j/..." onChange={(e) => setForm({ ...form, meetingLink: e.target.value })} /></FormField>
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
      {manual && <FormField label={tr("Reason for adding by hand")} required><Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} /></FormField>}
      <div className="flex items-center gap-3">
        <Button size="sm" variant="outline-emerald" loading={busy} disabled={!ready}
          onClick={() => onSave({ sessionId: session.id, personUserIds: selection.personIds.length ? selection.personIds : undefined, externals: selection.outsiders.length ? selection.outsiders : undefined, reason: manual ? reason.trim() : "Required by the training matrix" })}>
              {trFormat("Add {count} people to session {session}", { count, session: session.sessionNo })}
        </Button>
        <span className="text-xs text-slate-500">{tr("People already in the session are skipped.")}</span>
      </div>
    </div>
  );
}

export type ParticipantsDraft = { personUserIds: string[]; externals: Outsider[]; reason: string; /** The people chosen, with their names. */ people: TrainingPerson[] };

/** The people of the session, chosen on the New screen before the activity exists: they are added to the session when the activity is saved. */
export function ParticipantsDraftPanel({ onDraft, initialPeople, initialReason }: { onDraft: (draft: ParticipantsDraft | null) => void; initialPeople?: TrainingPerson[]; initialReason?: string }) {
  const [selection, setSelection] = useState<AssigneeSelection>({ personIds: (initialPeople ?? []).map((p) => p.id), outsiders: [] });
  const [reason, setReason] = useState(initialReason ?? "");
  const count = selection.personIds.length + selection.outsiders.length;
  // Nobody here comes from the matrix, so every person added needs the reason that stays on the row.
  const ready = count > 0 && reason.trim() !== "";
  useEffect(() => {
    onDraft(ready ? { personUserIds: selection.personIds, externals: selection.outsiders, reason: reason.trim(), people: selection.people ?? (initialPeople ?? []) } : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection, reason, ready]);
  return (
    <div className="space-y-4">
      <TrainingAssigneePicker onChange={setSelection} initialPeople={initialPeople} />
      <FormField label={tr("Reason for adding by hand")} required><Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} /></FormField>
      <p className="!mt-1.5 text-xs text-slate-500">{count} {tr("selected. They are added to the session when you save. The people the training matrix requires are offered on the next screen, after the activity is saved.")}</p>
    </div>
  );
}
