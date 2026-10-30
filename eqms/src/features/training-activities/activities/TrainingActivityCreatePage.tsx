import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button/Button";
import { FormField } from "@/components/ui/form/ResponsiveForm";
import { Input, Textarea } from "../shared/TrainingFields";
import { Select } from "@/components/ui/select/Select";
import { useToast } from "@/components/ui/toast/Toast";
import type { TabItem } from "@/components/ui/tabs/TabNav";
import {
  trainingActivitiesApi,
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
  SessionPanel,
  type ParticipantsDraft,
  type SessionDraft,
} from "./components/TrainingActivityPlanning";
import { useTrainingBack } from "../shared/useTrainingBack";
import { TrainingMaterialsBoard, type MaterialItem } from "./components/TrainingMaterialsBoard";
import { useBranding } from "@/components/branding/BrandLogo";
import { useAuth } from "@/contexts/AuthContext";

const CREATE_KINDS: TrainingKind[] = [
  "INITIAL",
  "PERIODIC",
  "UNPLANNED",
  "EXTERNAL",
];
const STEPS = [
  "New",
  "Planned",
  "Notified",
  "In Progress",
  "Pending QA Confirmation",
  "Completed",
];
const LATER = ["assessment", "signatures"];

/** A material added on this screen: it waits here and is saved with the activity (the same board as in planning, so the person meets one layout). */
type StagedMaterial = { id: string; title: string; file?: File; url?: string };

/** A new training activity as a page with tabs, like Document Details. Basic Information and the sessions are filled here; the Training Number is issued when the activity is saved, and the other tabs open on the next screen. */
export function TrainingActivityCreatePage() {
  const navigate = useNavigate();
  const goBack = useTrainingBack("/training-management/activities");
  const { showToast } = useToast();
  const [tab, setTab] = useState("basic");
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
  const [session, setSession] = useState<SessionDraft | null>(null);
  const [people, setPeople] = useState<ParticipantsDraft | null>(null);
  const [staged, setStaged] = useState<StagedMaterial[]>([]);
  const { trainingMaterialsLayout } = useBranding();
  const { user } = useAuth();

  const tabs: TabItem[] = [
    { id: "basic", label: "General Information" },
    { id: "participants", label: "Participants" },
    { id: "materials", label: "Training Materials" },
    { id: "assessment", label: "Assessment" },
    { id: "signatures", label: "Signatures" },
  ];

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
        title: "The training activity was not created",
        message: trainingError(e),
      });
      setBusy(false);
      return;
    }
    let failed = 0;
    let sessionId: string | undefined;
    for (const s of session ? [session] : []) {
      try {
        const withSession = await trainingActivitiesApi.addSession(
          created.id,
          s,
        );
        sessionId = withSession.sessions[0]?.id;
      } catch (e) {
        failed += 1;
        showToast({
          type: "error",
          title: "A session was not added",
          message: trainingError(e),
        });
      }
    }
    if (people && sessionId) {
      try {
        await trainingActivitiesApi.addParticipants(created.id, {
          sessionId,
          personUserIds: people.personUserIds.length
            ? people.personUserIds
            : undefined,
          externals: people.externals.length ? people.externals : undefined,
          reason: people.reason,
        });
      } catch (e) {
        showToast({
          type: "error",
          title: "The participants were not added",
          message: trainingError(e),
        });
      }
    }
    let materialsFailed = 0;
    for (const m of staged) {
      try {
        if (m.file) await trainingFilesApi.uploadMaterial(created.id, m.file, m.title || undefined, "CONTENT");
        else await trainingFilesApi.addLink(created.id, m.title, m.url ?? "");
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
      title: "Training activity created",
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
      variant="default"
      className="whitespace-nowrap"
      loading={busy}
      disabled={
        !session || !form.remarks.trim() || (form.kind === "EXTERNAL" && !form.trainingUnitName.trim())
      }
      onClick={() => void save()}
    >
      Save and Continue
    </Button>
    
  );

  return (
    <TrainingDetailLayout
      title="New Training Activity"
      breadcrumbItems={trainingBreadcrumbs(
        navigate,
        "activities",
        "New Training Activity",
      )}
      onBack={goBack}
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
          <ReadonlyField label="Training Number" value="" placeholder="Auto-generated after Save" />
          <ReadonlyField label="Department" value={user?.department ?? ""} />
          <ReadonlyField label="Opened By" value={user?.fullName ?? ""} />
          <ReadonlyField label="Created Time" value="" placeholder="Auto-generated after Save" />
          <FormField label="Type" required>
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
          <FormField label="Reason">
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
            <FormField label="External training" required>
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
              <p className="text-xs text-slate-500 md:col-span-2">
                {EXTERNAL_TYPE_HINT[form.externalType]}
              </p>
              <FormField
                label="Training unit / individual"
                required
                hint="Written on the training record (APD.0117)."
              >
                <Input
                  value={form.trainingUnitName}
                  maxLength={255}
                  placeholder="Name of the unit or the person who trains"
                  onChange={(e) =>
                    setForm({ ...form, trainingUnitName: e.target.value })
                  }
                />
              </FormField>
              <FormField label="Vendor reference (SOP.0025)">
                <Input
                  value={form.vendorRef}
                  maxLength={120}
                  placeholder="Code or name in the vendor list"
                  onChange={(e) =>
                    setForm({ ...form, vendorRef: e.target.value })
                  }
                />
              </FormField>
            </>
          )}
        </div>
      )}
      {/* The session and the people stay mounted while another tab is open, so what was typed is not lost when the tab is changed. */}
      <div className={tab === "basic" ? "mt-3 space-y-3 md:mt-4 md:space-y-4" : "hidden"}>
        <SessionPanel
          onDraft={setSession}
          dueDate={<TrainingDateField label="Due Date" hint={DATE_HINT.due} value={form.dueDate} onChange={(v) => setForm({ ...form, dueDate: v })} />}
          external={form.kind === "EXTERNAL"}
          initialTopic={prefill.get("topic") ?? undefined}
        />
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
          <div className="md:col-span-2">
            <FormField label="Description" required>
              <Textarea
                rows={3}
                value={form.remarks}
                onChange={(e) => setForm({ ...form, remarks: e.target.value })}
              />
            </FormField>
          </div>
          <p className="text-xs text-slate-500 md:col-span-2">
            A training on a document is opened by the system when the revision
            is approved. Use this screen for periodic, unplanned and outside
            training.
          </p>
        </div>
      </div>
      <div className={tab === "participants" ? undefined : "hidden"}>
        {!session && (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-6 text-center text-sm text-slate-600">
            The people are added to the session. Complete the session first (General
            Information): the Topic, the Instructor and the Physical Location, or
            the Platform and the Meeting Link.
          </div>
        )}
        <div className={session ? undefined : "hidden"}>
          <ParticipantsDraftPanel onDraft={setPeople} initialPeople={prefillPeople} initialReason={prefillPeople.length ? prefill.get("reason") ?? "Training required by the matrix" : undefined} />
        </div>
      </div>
      {tab === "materials" && (
        <TrainingMaterialsBoard
          layout={trainingMaterialsLayout === "TILES" ? "TILES" : "TABLE"}
          items={staged.map((m): MaterialItem => ({ id: m.id, title: m.title || m.file?.name || m.url || "", linkUrl: m.url ?? null, fileName: m.file?.name ?? null, sizeBytes: m.file?.size ?? null, staged: true }))}
          canAdd
          canRemove
          emptyText="No material yet. A file (PDF, slides, video) or a link can be added here and is saved with the activity; more can be added until the content is reviewed."
          onAddFile={(file, title) => { setStaged((old) => [...old, { id: crypto.randomUUID(), title, file }]); return true; }}
          onAddLink={(title, url) => { setStaged((old) => [...old, { id: crypto.randomUUID(), title, url }]); return true; }}
          onRemove={(m) => setStaged((old) => old.filter((x) => x.id !== m.id))}
        />
      )}
      {LATER.includes(tab) && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-6 text-center text-sm text-slate-600">
          This tab opens after you save the activity. Press{" "}
          <span className="font-medium">Save and Continue</span>: the Training
          Number is issued and you continue on the next screen, where you add
          the exam and the people who review and approve.
        </div>
      )}
    </TrainingDetailLayout>
  );
}
