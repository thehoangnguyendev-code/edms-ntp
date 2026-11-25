import type { ReactNode } from "react";
import { CalendarDays, FileText, MapPin, User, Users, Check, TriangleAlert, Pencil, Copy, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge/Badge";
import { tr, trFormat } from "@/i18n";
import { ASSESSMENT_COLOR, DELIVERY_COLOR, METHOD_COLOR } from "../../shared/trainingLabels";

/** What a session card shows. The New screen fills it from the drafts, the other screens from the sessions of the activity. */
export interface SessionCardData {
  key: string;
  no: number;
  topics: string[];
  mode?: string | null;
  /** The codes the API sends, which choose the colour of each badge. */
  modeCode?: string | null;
  assessmentCode?: string | null;
  deliveryCode?: string | null;
  assessment?: string | null;
  trainer?: string | null;
  date?: string | null;
  place?: string | null;
  /** Online platform and link, shown as one line. */
  online?: string | null;
  delivery?: string | null;
  heldOn?: string | null;
  /** Postponed, cancelled. */
  status?: { label: string; color: "slate" | "amber" | "red" } | null;
  afterDue?: boolean;
  people?: number | null;
  /** What the session has of its content; left out where the content is not known yet. */
  content?: { materials: number; materialsNeeded: boolean; materialsOk: boolean; assessmentNeeded: boolean; assessmentOk: boolean; assessmentLabel?: string | null; assessmentWord: string } | null;
  /** What the check of the trainer says (the screen of an existing activity). */
  note?: ReactNode;
  /** The buttons that apply to the session. */
  actions?: ReactNode;
}

const IconAction = ({ icon, label, onClick }: { icon: ReactNode; label: string; onClick: () => void }) => (
  <button type="button" aria-label={label} title={label} onClick={onClick} className="flex-shrink-0 rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100">{icon}</button>
);

/** The three small buttons of a card: change, copy, remove. */
export function SessionCardTools({ onEdit, onCopy, onRemove }: { onEdit?: () => void; onCopy?: () => void; onRemove?: () => void }) {
  return (
    <div className="flex items-center">
      {onEdit && <IconAction icon={<Pencil className="h-4 w-4" />} label={tr("Edit session")} onClick={onEdit} />}
      {onCopy && <IconAction icon={<Copy className="h-4 w-4" />} label={tr("Copy session")} onClick={onCopy} />}
      {onRemove && <IconAction icon={<Trash2 className="h-4 w-4" />} label={tr("Remove session")} onClick={onRemove} />}
    </div>
  );
}

const Fact = ({ icon, children }: { icon: ReactNode; children: ReactNode }) => (
  <span className="inline-flex items-center gap-1.5 text-xs text-slate-600"><span className="text-slate-400">{icon}</span>{children}</span>
);

/**
 * The sessions of an activity as cards, one under the other: the topic, the day, the place, the trainer, and what the session still lacks (people, materials, test). The same cards are on the New
 * screen and on the screen that edits the activity, so a person sees one thing in both.
 */
export function SessionCards({ sessions, tools }: { sessions: SessionCardData[]; tools?: (session: SessionCardData) => ReactNode }) {
  return (
    <div className="space-y-3">
      {sessions.map((s) => {
        const c = s.content;
        return (
          <section key={s.key} aria-label={`${tr("Session")} ${s.no}`} className="rounded-xl border border-slate-200 bg-white p-3 transition-colors hover:border-emerald-300 hover:bg-emerald-50/40 md:p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-semibold text-slate-900">{tr("Session")} {s.no}</h3>
                  {s.status && <Badge color={s.status.color}>{s.status.label}</Badge>}
                  {s.afterDue && <Badge color="amber">{tr("After the due date")}</Badge>}
                </div>
                <p className="mt-1 text-sm text-slate-700">{s.topics.length ? s.topics.join("; ") : "—"}</p>
              </div>
              {tools?.(s)}
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
              {s.date && <Fact icon={<CalendarDays className="h-3.5 w-3.5" />}>{s.date}</Fact>}
              {s.place && <Fact icon={<MapPin className="h-3.5 w-3.5" />}>{s.place}</Fact>}
              {s.online && <Fact icon={<MapPin className="h-3.5 w-3.5" />}>{s.online}</Fact>}
              {s.trainer && <Fact icon={<User className="h-3.5 w-3.5" />}>{s.trainer}</Fact>}
              {s.heldOn && <Fact icon={<Check className="h-3.5 w-3.5" />}>{trFormat("Conducted on {date}", { date: s.heldOn })}</Fact>}
            </div>
            {(s.mode || s.assessment || s.delivery) && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {s.mode && <Badge color={METHOD_COLOR[s.modeCode ?? ""] ?? "slate"}>{s.mode}</Badge>}
                {s.assessment && <Badge color={ASSESSMENT_COLOR[s.assessmentCode ?? ""] ?? "slate"}>{s.assessment}</Badge>}
                {s.delivery && <Badge color={DELIVERY_COLOR[s.deliveryCode ?? ""] ?? "slate"}>{s.delivery}</Badge>}
              </div>
            )}
            {s.note && <div className="mt-2">{s.note}</div>}
            {(c || s.people != null) && (
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-slate-100 pt-3 text-xs">
                {s.people != null && <Fact icon={<Users className="h-3.5 w-3.5" />}>{trFormat("{count} people", { count: s.people })}</Fact>}
                {c?.materialsNeeded && (
                  <span className={`inline-flex items-center gap-1.5 ${c.materialsOk ? "text-slate-600" : "text-amber-700"}`}>
                    <FileText className={`h-3.5 w-3.5 ${c.materialsOk ? "text-slate-400" : "text-amber-600"}`} />
                    {c.materialsOk ? trFormat("{count} material(s)", { count: c.materials }) : tr("No material yet")}
                  </span>
                )}
                {c?.assessmentNeeded && (
                  <span className={`inline-flex items-center gap-1.5 ${c.assessmentOk ? "text-slate-600" : "text-amber-700"}`}>
                    {c.assessmentOk ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <TriangleAlert className="h-3.5 w-3.5 text-amber-600" />}
                    {c.assessmentOk ? (c.assessmentLabel ? trFormat("{word}: {name}", { word: c.assessmentWord, name: c.assessmentLabel }) : c.assessmentWord) : trFormat("No {word} chosen yet", { word: c.assessmentWord.toLowerCase() })}
                  </span>
                )}
              </div>
            )}
            {s.actions && <div className="mt-3 flex flex-wrap gap-2">{s.actions}</div>}
          </section>
        );
      })}
    </div>
  );
}
