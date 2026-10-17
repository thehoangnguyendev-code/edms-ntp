import { useState } from "react";
import { CONTROL_STATE_CLASSES } from "@/components/ui/controlState";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button/Button";
import { FormField } from "@/components/ui/form/ResponsiveForm";
import { Input, Textarea } from "./TrainingFields";
import { Select } from "@/components/ui/select/Select";
import { useToast } from "@/components/ui/toast/Toast";
import type { TabItem } from "@/components/ui/tabs/TabNav";
import { trainingActivitiesApi, trainingError, type TrainingKind } from "@/services/api/trainingActivities";
import { KIND_LABEL, KIND_REASON_LABEL, trainingBreadcrumbs } from "./trainingLabels";
import { ReadonlyField, TrainingDetailLayout } from "./TrainingDetailLayout";
import { TrainingDateField } from "./TrainingDateField";
import { ParticipantsDraftPanel, SessionPanel, type ParticipantsDraft, type SessionDraft } from "./TrainingActivityPlanning";

const CREATE_KINDS: TrainingKind[] = ["INITIAL", "PERIODIC", "UNPLANNED", "EXTERNAL"];
const STEPS = ["New", "Planned", "Notified", "In progress", "Waiting for QA confirmation", "Completed"];
const LATER = ["materials", "assessment", "approvers"];

/** A new training activity as a page with tabs, like Document Details. Basic Information and the sessions are filled here; the Training Number is issued when the activity is saved, and the other tabs open on the next screen. */
export function TrainingActivityCreatePage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [tab, setTab] = useState("basic");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ kind: "UNPLANNED", kindReason: "OTHER", externalType: "ACTIVE", title: "", dueDate: "", remarks: "" });
  const [session, setSession] = useState<SessionDraft | null>(null);
  const [people, setPeople] = useState<ParticipantsDraft | null>(null);

  const tabs: TabItem[] = [
    { id: "basic", label: "General Information" },
    { id: "sessions", label: "Sessions" },
    { id: "participants", label: "Participants" },
    { id: "materials", label: "Training Materials" },
    { id: "assessment", label: "Assessment" },
    { id: "approvers", label: "Approvers" },
  ];

  const save = async () => {
    setBusy(true);
    let created;
    try {
      created = await trainingActivitiesApi.create({
        kind: form.kind as TrainingKind,
        kindReason: form.kindReason || undefined,
        externalType: form.kind === "EXTERNAL" ? form.externalType : undefined,
        title: form.title.trim(),
        dueDate: form.dueDate || undefined,
        remarks: form.remarks.trim() || undefined,
      });
    } catch (e) {
      showToast({ type: "error", title: "The training activity was not created", message: trainingError(e) });
      setBusy(false);
      return;
    }
    let failed = 0;
    let sessionId: string | undefined;
    for (const s of session ? [session] : []) {
      try {
        const withSession = await trainingActivitiesApi.addSession(created.id, s);
        sessionId = withSession.sessions[0]?.id;
      } catch (e) {
        failed += 1;
        showToast({ type: "error", title: "A session was not added", message: trainingError(e) });
      }
    }
    if (people && sessionId) {
      try {
        await trainingActivitiesApi.addParticipants(created.id, {
          sessionId,
          personUserIds: people.personUserIds.length ? people.personUserIds : undefined,
          externals: people.externals.length ? people.externals : undefined,
          reason: people.reason,
        });
      } catch (e) {
        showToast({ type: "error", title: "The participants were not added", message: trainingError(e) });
      }
    }
    showToast({ type: "success", title: "Training activity created", message: `${created.trainingNumber}${failed ? ` (${failed} session not added: add it on the next screen)` : ""}` });
    setBusy(false);
    navigate(`/training-management/activities/${created.id}/edit`, { state: { tab: "materials" }, replace: true });
  };

  const footer = <Button size="sm" variant="default" className="whitespace-nowrap" loading={busy} disabled={!form.title.trim()} onClick={() => void save()}>Save and continue</Button>;

  return (
    <TrainingDetailLayout
      title="New Training Activity"
      breadcrumbItems={trainingBreadcrumbs(navigate, "activities", "New Training Activity")}
      onBack={() => navigate("/training-management/activities")}
      steps={STEPS}
      currentStepIndex={0}
      tabs={tabs}
      activeTab={tab}
      onTab={setTab}
      tabLayoutId="training-activity-create-tab"
      footer={footer}
    >
      {tab === "basic" && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
          <ReadonlyField label="Training Number" value="" ><input type="text" readOnly value="Issued when you save" className={CONTROL_STATE_CLASSES.readonlyField} /></ReadonlyField>
          <FormField label="Type" required>
            <Select value={form.kind} onChange={(v) => setForm({ ...form, kind: v })} options={CREATE_KINDS.map((k) => ({ label: KIND_LABEL[k], value: k }))} enableSearch={false} />
          </FormField>
          <FormField label="Reason">
            <Select value={form.kindReason} onChange={(v) => setForm({ ...form, kindReason: v })} options={Object.entries(KIND_REASON_LABEL).map(([value, label]) => ({ label, value }))} enableSearch={false} />
          </FormField>
          {form.kind === "EXTERNAL" && (
            <FormField label="External training" required>
              <Select value={form.externalType} onChange={(v) => setForm({ ...form, externalType: v })} enableSearch={false}
                options={[{ label: "Our people go to another organisation", value: "ACTIVE" }, { label: "An outside person comes to us", value: "PASSIVE" }]} />
            </FormField>
          )}
          <div className="md:col-span-2">
            <FormField label="Title" required><Input value={form.title} maxLength={255} placeholder="e.g., GMP refresher for the packaging department" onChange={(e) => setForm({ ...form, title: e.target.value })} /></FormField>
          </div>
          <TrainingDateField label="Due date" value={form.dueDate} onChange={(v) => setForm({ ...form, dueDate: v })} />
          <div className="md:col-span-2">
            <FormField label="Remarks"><Textarea rows={3} value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} /></FormField>
          </div>
          <p className="text-xs text-slate-500 md:col-span-2">A training on a document is opened by the system when the revision is approved. Use this screen for periodic, unplanned and outside training.</p>
        </div>
      )}
      {/* The session and the people stay mounted while another tab is open, so what was typed is not lost when the tab is changed. */}
      <div className={tab === "sessions" ? undefined : "hidden"}><SessionPanel onDraft={setSession} /></div>
      <div className={tab === "participants" ? undefined : "hidden"}>
        {!session && (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-6 text-center text-sm text-slate-600">
            The people are added to the session. Complete the session first (tab Sessions): the Topic, the Instructor and the Physical Location, or the Platform and the Meeting Link.
          </div>
        )}
        <div className={session ? undefined : "hidden"}><ParticipantsDraftPanel onDraft={setPeople} /></div>
      </div>
      {LATER.includes(tab) && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-6 text-center text-sm text-slate-600">
          This tab opens after you save the activity. Press <span className="font-medium">Save and continue</span>: the Training Number is issued and you continue on the next screen, where you add the materials, the exam and the people who review and approve.
        </div>
      )}
    </TrainingDetailLayout>
  );
}
