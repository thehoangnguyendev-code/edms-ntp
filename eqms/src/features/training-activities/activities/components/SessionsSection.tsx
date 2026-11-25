import { useEffect, useRef, useState, type ReactNode } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button/Button";
import { FormModal } from "@/components/ui/modal/FormModal";
import { RadioGroup } from "@/components/ui/radio";
import { SessionCards, SessionCardTools, type SessionCardData } from "./SessionCards";
import { SessionFormModal, type CopySource } from "./SessionFormModal";
import type { SessionDraft, SessionFormValues } from "./TrainingActivityPlanning";
import { tr, trFormat } from "@/i18n";

/** A kind of training the SOP describes, as the topics of its sessions (SOP.0003 5.1.1 and 5.3.2). The form of each session opens in turn, with its topic filled in. */
const PATTERNS: { id: string; title: string; description: string; topics: string[] }[] = [
  {
    id: "INITIAL",
    title: tr("Initial training of new employees"),
    description: tr("Three parts, each given by another unit: Human Resources, QA and the department of the employee (SOP.0003 5.1.1)."),
    topics: ["Occupational safety and company policy", "General principles of GMP", "Job-specific training"],
  },
  {
    id: "ANNUAL",
    title: tr("Annual periodic training"),
    description: tr("The topics the annual training requirement has (SOP.0003 5.3.2)."),
    topics: ["General GMP", "Data integrity and aseptic technique", "Trends of the errors found in audits, complaints, OOS investigations and CAPA"],
  },
];

export interface SessionSaveOptions {
  copyPeopleFrom?: string;
  /** The name of the trainer, for the card of a session that is not saved yet. */
  trainerName?: string;
  /** The key of the session that is changed (the New screen, where the session is still a draft). */
  editKey?: string;
}

/**
 * The sessions of an activity, the same on the New screen and on the screen that edits it: a title with the count and the buttons Add session and Create from a SOP pattern, the session cards, and
 * the one dialog that adds, copies or changes a session. A pattern opens the dialog once for each of its topics, one after the other.
 */
export function SessionsSection({ cards, sources, canAdd, external, busy, canCopyPeople, initialTopic, documentRevisionId, defaultForm, defaultTrainerName, emptyNote, autoOpenTopic, onSave, onRemove, canEdit = false, children }: {
  cards: SessionCardData[];
  /** The sessions a new one can be copied from. `editForm` is the form with the day, for a session that is changed. */
  sources: (CopySource & { editForm?: CopySource["form"] })[];
  canAdd: boolean;
  external: boolean;
  busy: boolean;
  canCopyPeople: boolean;
  initialTopic?: string;
  documentRevisionId?: string;
  /** What the first session starts with for a training that comes from a document. */
  defaultForm?: Partial<SessionFormValues>;
  defaultTrainerName?: string;
  emptyNote: ReactNode;
  /** The dialog opens by itself once, with this topic (a training made from the initial training of an employee). */
  autoOpenTopic?: string;
  onSave: (draft: SessionDraft, options: SessionSaveOptions) => Promise<boolean> | boolean;
  /** Only where a session can still be taken out (the New screen). */
  onRemove?: (key: string) => void;
  /** The cards carry the button that changes a session (the New screen). */
  canEdit?: boolean;
  children?: ReactNode;
}) {
  const [dialog, setDialog] = useState<{ copyOf: string; editKey?: string; topic?: string } | null>(null);
  const [queue, setQueue] = useState<string[]>([]);
  const [pattern, setPattern] = useState<{ open: boolean; id: string }>({ open: false, id: "INITIAL" });
  const opened = useRef(false);
  useEffect(() => {
    if (!autoOpenTopic || opened.current) return;
    opened.current = true;
    setDialog({ copyOf: "", topic: autoOpenTopic });
  }, [autoOpenTopic]);

  const count = cards.length;
  const next = count + 1;
  const editing = dialog?.editKey;
  const modalSources = sources.map((s) => (s.key === editing && s.editForm ? { ...s, form: s.editForm } : s));
  const save = async (draft: SessionDraft, options: { copyPeopleFrom?: string; trainerName?: string }) => {
    const ok = await onSave(draft, { ...options, editKey: dialog?.editKey });
    if (!ok) return;
    if (queue.length > 0) {
      const [first, ...rest] = queue;
      setQueue(rest);
      setDialog({ copyOf: "", topic: first });
    } else setDialog(null);
  };
  const startPattern = () => {
    const chosen = PATTERNS.find((p) => p.id === pattern.id);
    if (!chosen) return;
    setPattern({ ...pattern, open: false });
    setQueue(chosen.topics.slice(1));
    setDialog({ copyOf: "", topic: chosen.topics[0] });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-slate-800">{tr("Sessions")}</h3>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">{count}</span>
        </div>
        {canAdd && (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline-emerald" onClick={() => setPattern({ ...pattern, open: true })}>{tr("Create from a SOP pattern")}</Button>
            <Button size="sm" variant="default" onClick={() => setDialog({ copyOf: "" })}><Plus className="mr-1.5 h-4 w-4" />{tr("Add session")}</Button>
          </div>
        )}
      </div>
      {count > 0 && <p className="text-xs text-slate-500">{tr("One Training Number covers all the sessions. Each session has its own topics, trainer, date, place, people, materials and test.")}</p>}
      {count === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50"><p className="p-4 text-sm text-slate-500">{emptyNote}</p></div>
      ) : (
        <SessionCards
          sessions={cards}
          tools={(card) => canAdd ? (
            <SessionCardTools
              onEdit={canEdit ? () => setDialog({ copyOf: card.key, editKey: card.key }) : undefined}
              onCopy={() => setDialog({ copyOf: card.key })}
              onRemove={onRemove ? () => onRemove(card.key) : undefined}
            />
          ) : null}
        />
      )}
      {children}
      {dialog && (
        <SessionFormModal
          key={`${dialog.editKey ?? "new"}-${dialog.topic ?? ""}-${dialog.copyOf}`}
          title={editing ? `${tr("Edit session")} ${cards.find((c) => c.key === editing)?.no ?? ""}` : queue.length > 0 || dialog.topic ? `${tr("Add session")} ${next}` : `${tr("Add session")} ${next}`}
          external={external}
          busy={busy}
          initialSource={dialog.copyOf}
          initialTopic={dialog.topic ?? (count === 0 ? initialTopic : undefined)}
          documentRevisionId={count === 0 && !dialog.topic ? documentRevisionId : undefined}
          defaultForm={count === 0 && !dialog.topic ? defaultForm : undefined}
          defaultTrainerName={count === 0 && !dialog.topic ? defaultTrainerName : undefined}
          canCopyPeople={canCopyPeople && !editing}
          sources={editing ? modalSources.filter((s) => s.key === editing) : modalSources}
          onClose={() => { setDialog(null); setQueue([]); }}
          onSave={(draft, options) => void save(draft, options)}
        />
      )}
      <FormModal
        isOpen={pattern.open}
        onClose={() => setPattern({ ...pattern, open: false })}
        onConfirm={startPattern}
        title={tr("Create from a SOP pattern")}
        description={tr("Choose the kind of training. The form of each session opens in turn with its topic filled in; you add the trainer, the day and the place.")}
        confirmText="Start"
        size="md"
      >
        <RadioGroup
          name="session-pattern"
          value={pattern.id}
          onChange={(v) => setPattern({ ...pattern, id: String(v) })}
          options={PATTERNS.map((p) => ({ value: p.id, label: tr(p.title) }))}
        />
        <p className="mt-3 text-xs text-slate-600">{tr(PATTERNS.find((p) => p.id === pattern.id)?.description ?? "")}</p>
        <p className="mt-2 text-xs text-slate-500">{trFormat("{count} sessions will be added, one for each topic.", { count: PATTERNS.find((p) => p.id === pattern.id)?.topics.length ?? 0 })}</p>
      </FormModal>
    </div>
  );
}
