import { useViewState } from "@/hooks/useViewState";
import { useLeaveGuard } from "@/hooks/useLeaveGuard";
import { useFormDirty } from "@/hooks/useFormDirty";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button/Button";
import { FormField } from "@/components/ui/form/ResponsiveForm";
import { Input, Textarea } from "../shared/TrainingFields";
import { Select } from "@/components/ui/select/Select";
import { useToast } from "@/components/ui/toast/Toast";
import type { TabItem } from "@/components/ui/tabs/TabNav";
import { useServerWorkflow } from "@/components/ui/workflow-stepper/useServerWorkflow";
import {
  trainingActivitiesApi,
  trainingWorkflowApi,
  trainingError,
  trainingFilesApi,
  type TrainingKind,
  type TrainingPerson,
} from "@/services/api/trainingActivities";
import {
  EXTERNAL_TYPE_HINT,
  EXTERNAL_TYPE_LABEL,
  KIND_LABEL,
  KIND_REASON_LABEL,
  trainingBreadcrumbs,
} from "../shared/trainingLabels";
import {
  ReadonlyField,
  TrainingDetailLayout,
} from "../shared/TrainingDetailLayout";
import { TrainingDateField, DATE_HINT } from "../shared/TrainingDateField";
import {
  ParticipantsDraftPanel,
  type ParticipantsDraft,
  type SessionDraft,
} from "./components/TrainingActivityPlanning";
import { SessionsSection } from "./components/SessionsSection";
import { SessionPills } from "./components/SessionPills";
import type { SessionCardData } from "./components/SessionCards";
import { sessionFormFrom, type CopySource } from "./components/SessionFormModal";
import { Checkbox } from "@/components/ui/checkbox/Checkbox";
import { DataTable } from "@/components/ui/table/DataTable";
import { Badge } from "@/components/ui/badge/Badge";
import { ASSESSMENT_LABEL, METHOD_LABEL, day } from "../shared/trainingLabels";
import { useTrainingBack } from "../shared/useTrainingBack";
import { TrainingMaterialsBoard, type MaterialItem } from "./components/TrainingMaterialsBoard";
import { useBranding } from "@/components/branding/BrandLogo";
import { useAuth } from "@/contexts/AuthContext";
import { tr } from "@/i18n";

const CREATE_KINDS: TrainingKind[] = [
  "INITIAL",
  "PERIODIC",
  "UNPLANNED",
  "EXTERNAL",
];
const LATER = ["assessment", "signatures"];

/** A material added on this screen: it waits here and is saved with the activity (the same board as in planning, so the person meets one layout). */
type StagedMaterial = { id: string; title: string; file?: File; url?: string; /** The session it is for (its key here); empty for every session. */ sessionKey?: string };

/** A session of the activity, still a draft on this screen: it is saved with the activity. */
type DraftSession = { key: string; body: SessionDraft; trainerName?: string };

/** A new training activity as a page with tabs, like Document Details. Basic Information and the sessions are filled here; the Training Number is issued when the activity is saved, and the other tabs open on the next screen. */
export function TrainingActivityCreatePage() {
  const navigate = useNavigate();
  // The activity has no record yet, so the server gives the stepper of a new one.
  const workflow = useServerWorkflow("training:ACTIVITY", () => trainingWorkflowApi.newRecord("ACTIVITY"));
  const goBack = useTrainingBack("/training-management/activities");
  const { showToast } = useToast();
  const [tab, setTab] = useViewState("TrainingActivityCreatePage.tab", "basic");
  const [busy, setBusy] = useState(false);
  // "Create a Training" from the initial training of a new employee: the kind Initial, the topic of the session and the employee are filled in
  const [prefill] = useSearchParams();
  const prefillIds = prefill.getAll("person");
  const prefillPeople: TrainingPerson[] = prefillIds.map((id, i) => ({ id, fullName: prefill.getAll("personName")[i] ?? "", employeeCode: prefill.getAll("personCode")[i] || null, department: null, position: null, businessUnit: null }) as TrainingPerson);
  const [form, setForm] = useState({
    kind: prefill.get("kind") === "INITIAL" ? "INITIAL" : "UNPLANNED",
    kindReason: "OTHER",
    externalType: "ACTIVE",
    dueDate: "",
    remarks: prefill.get("remarks") ?? "",
    trainingUnitName: "",
    vendorRef: "",
  });
  const [sessions, setSessions] = useState<DraftSession[]>([]);
  // The people who do NOT attend a session ("person|session"): everybody attends every session until a tick is taken off.
  const [notAttending, setNotAttending] = useState<Set<string>>(new Set());
  // The session the tabs Participants and Training Materials look at ("" is all of them).
  const [look, setLook] = useState("");
  const [people, setPeople] = useState<ParticipantsDraft | null>(null);
  const [staged, setStaged] = useState<StagedMaterial[]>([]);
  // Leaving with a change that was not saved asks first (Back, the breadcrumb, the sidebar, a reload); the move after the activity is created is not a leave.
  // The session and the people are filled by their own editors, so each is compared from the first time it has a value.
  const basicsDirty = useFormDirty({ form, materials: staged.length }).isDirty;
  const sessionDirty = useFormDirty(sessions, sessions.length > 0).isDirty;
  const peopleDirty = useFormDirty(people, people !== null).isDirty;
  const { go, confirmLeave, modal: leaveModal } = useLeaveGuard(basicsDirty || sessionDirty || peopleDirty, "New Training Activity", "the previous page");
  const { trainingMaterialsLayout } = useBranding();
  const { user } = useAuth();

  const tabs: TabItem[] = [
    { id: "basic", label: tr("General Information") },
    { id: "participants", label: tr("Participants") },
    { id: "materials", label: tr("Training Materials") },
    { id: "assessment", label: "Assessment" },
    { id: "signatures", label: tr("Signatures") },
  ];

  const attends = (rowKey: string, sessionKey: string) => !notAttending.has(`${rowKey}|${sessionKey}`);
  const toggleAttend = (rowKey: string, sessionKey: string) =>
    setNotAttending((old) => {
      const next = new Set(old);
      const k = `${rowKey}|${sessionKey}`;
      if (next.has(k)) next.delete(k); else next.add(k);
      return next;
    });
  // the people chosen, as the rows of the table of who attends which session
  const rows = people ? [...people.people.map((p) => ({ key: p.id, name: p.fullName, meta: [p.employeeCode, p.department].filter(Boolean).join(" · ") })), ...people.externals.map((o, i) => ({ key: `ext:${i}`, name: o.name, meta: o.org }))] : [];
  const external = form.kind === "EXTERNAL";
  const sessionCards: SessionCardData[] = sessions.map((d, index) => {
    const mine = staged.filter((m) => !m.sessionKey || m.sessionKey === d.key).length;
    return {
      key: d.key,
      no: index + 1,
      topics: d.body.topics.map((t) => t.topicText),
      mode: !external && d.body.method ? (METHOD_LABEL[d.body.method] ?? d.body.method) : null,
      modeCode: d.body.method,
      assessmentCode: d.body.assessmentMethod,
      assessment: !external && d.body.assessmentMethod ? (ASSESSMENT_LABEL[d.body.assessmentMethod] ?? d.body.assessmentMethod) : null,
      trainer: d.trainerName || d.body.externalTrainerName || null,
      date: d.body.scheduledOn ? day(d.body.scheduledOn) : null,
      place: d.body.locationType !== "ONLINE" ? (d.body.venue ?? null) : null,
      online: d.body.locationType !== "ONSITE" ? [d.body.onlinePlatform, d.body.meetingLink].filter(Boolean).join(" · ") || null : null,
      people: people ? rows.filter((r) => attends(r.key, d.key)).length : 0,
      content: external ? null : { materials: mine, materialsNeeded: true, materialsOk: mine > 0, assessmentNeeded: false, assessmentOk: false, assessmentWord: tr("Test") },
    };
  });
  const sessionSources: (CopySource & { editForm: CopySource["form"] })[] = sessions.map((d, index) => ({
    key: d.key,
    no: index + 1,
    label: `${tr("Session")} ${index + 1} · ${d.body.topics[0]?.topicText ?? ""}`,
    form: sessionFormFrom(d.body),
    editForm: { ...sessionFormFrom(d.body), scheduledOn: d.body.scheduledOn ?? "" },
    people: 0,
  }));
  const saveSession = (draft: SessionDraft, options: { editKey?: string; trainerName?: string }) => {
    if (options.editKey) setSessions((old) => old.map((d) => (d.key === options.editKey ? { ...d, body: draft, trainerName: options.trainerName } : d)));
    else setSessions((old) => [...old, { key: crypto.randomUUID(), body: draft, trainerName: options.trainerName }]);
    return true;
  };
  const removeSession = (key: string) => {
    setSessions((old) => old.filter((d) => d.key !== key));
    // what was for that session only is now for every session
    setStaged((old) => old.map((m) => (m.sessionKey === key ? { ...m, sessionKey: "" } : m)));
  };
  const pills = [{ id: "", label: `All (${sessions.length})` }, ...sessions.map((d, i) => ({ id: d.key, label: `S${i + 1} ${d.body.topics[0]?.topicText ?? ""}`.trim() }))];

  const save = async () => {
    setBusy(true);
    let created;
    try {
      created = await trainingActivitiesApi.create({
        kind: form.kind as TrainingKind,
        kindReason: form.kindReason || undefined,
        externalType: form.kind === "EXTERNAL" ? form.externalType : undefined,
        trainingUnitName:
          form.kind === "EXTERNAL" ? form.trainingUnitName.trim() : undefined,
        vendorRef:
          form.kind === "EXTERNAL"
            ? form.vendorRef.trim() || undefined
            : undefined,
        dueDate: form.dueDate || undefined,
        remarks: form.remarks.trim() || undefined,
      });
    } catch (e) {
      showToast({
        type: "error",
        title: tr("The training activity was not created"),
        message: trainingError(e),
      });
      setBusy(false);
      return;
    }
    let failed = 0;
    // the id the server gave each session, by the key it had here
    const ids: Record<string, string> = {};
    let known = new Set<string>();
    for (const draft of sessions) {
      try {
        const withSession = await trainingActivitiesApi.addSession(created.id, draft.body);
        const added = withSession.sessions.find((x) => !known.has(x.id));
        if (added) { ids[draft.key] = added.id; known = new Set(withSession.sessions.map((x) => x.id)); }
      } catch (e) {
        failed += 1;
        showToast({
          type: "error",
          title: tr("A session was not added"),
          message: trainingError(e),
        });
      }
    }
    if (people) {
      for (const draft of sessions) {
        const sessionId = ids[draft.key];
        if (!sessionId) continue;
        const personUserIds = people.personUserIds.filter((id) => attends(id, draft.key));
        const externals = people.externals.filter((_, i) => attends(`ext:${i}`, draft.key));
        if (personUserIds.length === 0 && externals.length === 0) continue;
        try {
          await trainingActivitiesApi.addParticipants(created.id, {
            sessionId,
            personUserIds: personUserIds.length ? personUserIds : undefined,
            externals: externals.length ? externals : undefined,
            reason: people.reason,
          });
        } catch (e) {
          showToast({
            type: "error",
            title: tr("The participants were not added"),
            message: trainingError(e),
          });
        }
      }
    }
    let materialsFailed = 0;
    for (const m of staged) {
      try {
        const forSession = m.sessionKey ? ids[m.sessionKey] : undefined;
        if (m.file) await trainingFilesApi.uploadMaterial(created.id, m.file, m.title || undefined, "CONTENT", undefined, forSession);
        else await trainingFilesApi.addLink(created.id, m.title, m.url ?? "", forSession);
      } catch (e) {
        materialsFailed += 1;
        showToast({
          type: "error",
          title: `The material "${m.title || m.file?.name || m.url}" was not added`,
          message: trainingError(e),
        });
      }
    }
    showToast({
      type: "success",
      title: tr("Training activity created"),
      message: `${created.trainingNumber}${failed ? ` (${failed} session not added: add it on the next screen)` : ""}${materialsFailed ? ` (${materialsFailed} material not added: add it on the next screen)` : ""}`,
    });
    setBusy(false);
    navigate(`/training-management/activities/${created.id}/edit`, {
      state: { tab: "materials" },
      replace: true,
    });
  };

  const footer = (
    <Button
      size="sm"
      variant="outline-emerald"
      className="whitespace-nowrap"
      loading={busy}
      disabled={
        sessions.length === 0 || !form.remarks.trim() || (form.kind === "EXTERNAL" && !form.trainingUnitName.trim())
      }
      onClick={() => void save()}
    >
      {tr("Save and Continue")}
    </Button>
    
  );

  return (
    <TrainingDetailLayout
      title={tr("New Training Activity")}
      breadcrumbItems={trainingBreadcrumbs(
        go,
        "activities",
        "New Training Activity",
      )}
      onBack={() => confirmLeave(goBack)}
      workflow={workflow}
      tabs={tabs}
      activeTab={tab}
      onTab={setTab}
      tabLayoutId="training-activity-create-tab"
      footer={footer}
    >
      {tab === "basic" && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
          <ReadonlyField label={tr("Training Number")} value="" placeholder={tr("Auto-generated after Save")} />
          <ReadonlyField label={tr("Department")} value={user?.department ?? ""} />
          <ReadonlyField label={tr("Opened By")} value={user?.fullName ?? ""} />
          <ReadonlyField label={tr("Created Time")} value="" placeholder={tr("Auto-generated after Save")} />
          <FormField label={tr("Type")} required>
            <Select
              value={form.kind}
              onChange={(v) => setForm({ ...form, kind: v })}
              options={CREATE_KINDS.map((k) => ({
                label: KIND_LABEL[k],
                value: k,
              }))}
              enableSearch={false}
            />
          </FormField>
          <FormField label={tr("Reason")}>
            <Select
              value={form.kindReason}
              onChange={(v) => setForm({ ...form, kindReason: v })}
              options={Object.entries(KIND_REASON_LABEL).map(
                ([value, label]) => ({ label, value }),
              )}
              enableSearch={false}
            />
          </FormField>
          {form.kind === "EXTERNAL" && (
            <FormField label={tr("External training")} required>
              <Select
                value={form.externalType}
                onChange={(v) => setForm({ ...form, externalType: v })}
                enableSearch={false}
                options={Object.entries(EXTERNAL_TYPE_LABEL).map(
                  ([value, label]) => ({ label, value }),
                )}
              />
            </FormField>
          )}
          {form.kind === "EXTERNAL" && (
            <>
              <p className="-mt-1.5 text-xs text-slate-500 md:col-span-2">
                {EXTERNAL_TYPE_HINT[form.externalType]}
              </p>
              <FormField
                label={tr("Training unit / individual")}
                required
                hint={tr("Written on the training record (APD.0117).")}
              >
                <Input
                  value={form.trainingUnitName}
                  maxLength={255}
                  placeholder={tr("Name of the unit or the person who trains")}
                  onChange={(e) =>
                    setForm({ ...form, trainingUnitName: e.target.value })
                  }
                />
              </FormField>
              <FormField label={tr("Vendor reference (SOP.0025)")}>
                <Input
                  value={form.vendorRef}
                  maxLength={120}
                  placeholder={tr("Code or name in the vendor list")}
                  onChange={(e) =>
                    setForm({ ...form, vendorRef: e.target.value })
                  }
                />
              </FormField>
            </>
          )}
        </div>
      )}
      {/* The sessions and the people stay mounted while another tab is open, so what was typed is not lost when the tab is changed. */}
      <div className={tab === "basic" ? "mt-3 space-y-3 md:mt-4 md:space-y-4" : "hidden"}>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
          <TrainingDateField label={tr("Due Date")} hint={DATE_HINT.due} value={form.dueDate} onChange={(v) => setForm({ ...form, dueDate: v })} />
        </div>
        <SessionsSection
          cards={sessionCards}
          sources={sessionSources}
          canAdd
          canEdit
          external={external}
          busy={busy}
          canCopyPeople={false}
          autoOpenTopic={prefill.get("topic") ?? undefined}
          emptyNote={tr("No session yet. Press Add session to add the first one: the people, the materials and the test all belong to a session.")}
          onSave={saveSession}
          onRemove={removeSession}
        />
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
          <div className="md:col-span-2">
            <FormField label={tr("Description")} required>
              <Textarea
                rows={3}
                value={form.remarks}
                onChange={(e) => setForm({ ...form, remarks: e.target.value })}
              />
            </FormField>
          </div>
        </div>
      </div>
      <div className={tab === "participants" ? undefined : "hidden"}>
        {sessions.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-6 text-center text-sm text-slate-600">
            {tr("The people are added to the sessions. Add a session first (General Information): the Topic, the Instructor and the Physical Location, or the Platform and the Meeting Link.")}
          </div>
        )}
        <div className={sessions.length > 0 ? "space-y-4" : "hidden"}>
          {sessions.length > 1 && <SessionPills pills={pills.map((p) => (p.id ? p : { ...p, label: `All (${rows.length})` }))} value={look} onChange={setLook} />}
          <ParticipantsDraftPanel onDraft={setPeople} initialPeople={prefillPeople} initialReason={prefillPeople.length ? prefill.get("reason") ?? "Training required by the matrix" : undefined} />
          {sessions.length > 1 && rows.length > 0 && (
            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-800">{tr("Who attends which session")}</h3>
                <p className="mt-0.5 text-xs text-slate-500">{tr("The same people can attend several sessions. Untick a session a person does not attend.")}</p>
              </div>
              <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white md:block">
                <DataTable
                  rows={rows}
                  getRowKey={(r) => r.key}
                  columns={[
                    { id: "name", header: tr("Name"), cell: (r) => <span><span className="font-medium text-slate-900">{r.name}</span>{r.meta && <span className="ml-2 text-slate-500">{r.meta}</span>}</span> },
                    ...sessions.filter((d) => !look || d.key === look).map((d) => ({
                      id: `session-${d.key}`,
                      header: <span title={d.body.topics[0]?.topicText}>S{sessions.indexOf(d) + 1}</span>,
                      headerClassName: "text-center",
                      cellClassName: "text-center",
                      cell: (r: (typeof rows)[number]) => <span className="inline-flex"><Checkbox aria-label={`${r.name} ${tr("Session")} ${sessions.indexOf(d) + 1}`} checked={attends(r.key, d.key)} onChange={() => toggleAttend(r.key, d.key)} /></span>,
                    })),
                  ]}
                />
              </div>
              <div className="space-y-2 md:hidden">
                {rows.map((r) => (
                  <div key={r.key} className="rounded-xl border border-slate-200 bg-white p-3">
                    <div className="text-sm font-medium text-slate-900">{r.name}</div>
                    {r.meta && <div className="mt-0.5 text-xs text-slate-500">{r.meta}</div>}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {sessions.filter((d) => !look || d.key === look).map((d) => (
                        <label key={d.key} className={`inline-flex min-h-9 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium ${attends(r.key, d.key) ? "border-emerald-600 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white text-slate-500"}`}>
                          <Checkbox checked={attends(r.key, d.key)} onChange={() => toggleAttend(r.key, d.key)} />S{sessions.indexOf(d) + 1}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      {tab === "materials" && sessions.length > 1 && <div className="mb-4"><SessionPills pills={pills} value={look} onChange={setLook} /></div>}
      {tab === "materials" && (
        <TrainingMaterialsBoard
          scope={sessions.length > 1 ? { label: tr("Use for"), value: look, options: [{ label: tr("All sessions"), value: "" }, ...sessions.map((d, i) => ({ label: `${tr("Session")} ${i + 1} · ${d.body.topics[0]?.topicText ?? ""}`, value: d.key }))], onChange: setLook } : undefined}
          layout={trainingMaterialsLayout === "TILES" ? "TILES" : "TABLE"}
          items={staged.filter((m) => !look || !m.sessionKey || m.sessionKey === look).map((m): MaterialItem => ({ sessionLabel: sessions.length > 1 ? (m.sessionKey ? `S${sessions.findIndex((d) => d.key === m.sessionKey) + 1}` : tr("All sessions")) : null, id: m.id, title: m.title || m.file?.name || m.url || "", linkUrl: m.url ?? null, fileName: m.file?.name ?? null, sizeBytes: m.file?.size ?? null, staged: true }))}
          canAdd
          canRemove
          emptyText={tr("No material yet. A file (PDF, slides, video) or a link can be added here and is saved with the activity; more can be added until the content is approved.")}
          onAddFile={(file, title) => { setStaged((old) => [...old, { id: crypto.randomUUID(), title, file, sessionKey: look }]); return true; }}
          onAddLink={(title, url) => { setStaged((old) => [...old, { id: crypto.randomUUID(), title, url, sessionKey: look }]); return true; }}
          onRemove={(m) => setStaged((old) => old.filter((x) => x.id !== m.id))}
        />
      )}
      {LATER.includes(tab) && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-6 text-center text-sm text-slate-600">
          {tr("This tab opens after you save the activity. Press")}{" "}
          <span className="font-medium">{tr("Save and Continue")}</span>{tr(": the Training Number is issued and you continue on the next screen, where you add the exam and the people who review and approve.")}
        </div>
      )}
      {leaveModal}
    </TrainingDetailLayout>
  );
}
