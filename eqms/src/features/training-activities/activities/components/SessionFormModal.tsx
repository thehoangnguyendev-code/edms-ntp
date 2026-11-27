import { useState } from "react";
import { FormModal } from "@/components/ui/modal/FormModal";
import { Select } from "@/components/ui/select/Select";
import { Checkbox } from "@/components/ui/checkbox/Checkbox";
import { FormField } from "@/components/ui/form/ResponsiveForm";
import { SessionPanel, sessionFormFrom, type SessionDraft, type SessionFormValues } from "./TrainingActivityPlanning";
import { tr, trFormat } from "@/i18n";

/** A session the new one can be copied from. */
export interface CopySource {
  key: string;
  no: number;
  label: string;
  form: Partial<SessionFormValues>;
  /** How many people are on it (to offer the same people). */
  people?: number;
}

/**
 * One form, in the dialog the app uses everywhere (the same as Select Approver): copy from a session, then what, who and when and where. A copy fills the topics, the mode, the assessment, the
 * trainer and the place; the day is the one thing it leaves empty. `samePeople` offers to put on the new session the people of the one it was copied from.
 */
export function SessionFormModal({ title, external, sources, initialSource, documentRevisionId, initialTopic, defaultForm, defaultTrainerName, busy, canCopyPeople, onClose, onSave }: {
  /** What the first session of a training from Document Control starts with (SOP.0003 5.1.2, 5.3.6); the person can change it. */
  defaultForm?: Partial<SessionFormValues>;
  defaultTrainerName?: string;
  title: string;
  external: boolean;
  sources: CopySource[];
  initialSource?: string;
  documentRevisionId?: string;
  initialTopic?: string;
  busy: boolean;
  /** The people of a session can be copied (the list is not confirmed yet). */
  canCopyPeople: boolean;
  onClose: () => void;
  onSave: (draft: SessionDraft, options: { copyPeopleFrom?: string; trainerName?: string }) => void;
}) {
  const [source, setSource] = useState(initialSource ?? "");
  const [draft, setDraft] = useState<SessionDraft | null>(null);
  const [trainerName, setTrainerName] = useState<string | undefined>();
  const [samePeople, setSamePeople] = useState(true);
  const picked = sources.find((s) => s.key === source);
  return (
    <FormModal
      isOpen
      onClose={onClose}
      onConfirm={() => draft && onSave(draft, { copyPeopleFrom: canCopyPeople && samePeople && picked && (picked.people ?? 0) > 0 ? picked.key : undefined, trainerName })}
      title={title}
      description={tr("The people, the content and the approval all belong to a session. Fill in what is taught, who teaches and when and where.")}
      confirmText="Save"
      confirmDisabled={!draft}
      isLoading={busy}
      size="xl"
    >
      <div className="space-y-5">
        {sources.length > 0 && (
          <div className="space-y-2">
            <FormField label={tr("Copy from")}>
              <Select value={source} onChange={setSource} enableSearch={false} placeholder={tr("No copy: an empty session")}
                options={[{ label: tr("No copy: an empty session"), value: "" }, ...sources.map((s) => ({ label: s.label, value: s.key }))]} />
            </FormField>
            <p className="!mt-1.5 text-xs text-slate-500">{tr("The topics, the mode, the assessment, the trainer and the place are filled in. Change what differs; choose the day.")}</p>
            {canCopyPeople && picked && (picked.people ?? 0) > 0 && (
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <Checkbox checked={samePeople} onChange={setSamePeople} />
                {trFormat("Add the same {count} people as Session {no}", { count: picked.people ?? 0, no: picked.no })}
              </label>
            )}
          </div>
        )}
        <SessionPanel key={source || "empty"} external={external} initialTopic={initialTopic} documentRevisionId={documentRevisionId} initialForm={picked?.form ?? defaultForm} initialTrainerName={picked ? undefined : defaultTrainerName} onDraft={(body, meta) => { setDraft(body); setTrainerName(meta?.trainerName); }} />
      </div>
    </FormModal>
  );
}

export { sessionFormFrom };
