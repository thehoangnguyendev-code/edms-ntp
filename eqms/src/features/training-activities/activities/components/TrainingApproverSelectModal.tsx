import { useEffect, useMemo, useState } from "react";
import { Check, Search, User } from "lucide-react";
import { Button } from "@/components/ui/button/Button";
import { FormModal } from "@/components/ui/modal/FormModal";
import { cn } from "@/components/ui/utils";
import { SEARCH_DEBOUNCE_MS } from "@/constants/search";
import { trainingActivitiesApi, trainingError, type TrainingPerson } from "@/services/api/trainingActivities";
import { tr } from "@/i18n";

const ROLE_TEXT: Record<string, string> = {
  UNIT_HEAD: "Head of the unit concerned",
  QUALITY_MANAGER: "Quality Manager",
};

/**
 * Selects the two people who approve the content and the test of an activity, one after the other (SOP.0003 5.3.5: the people who hold the permission to approve training content). It looks like the Setup Approver
 * window of Document Control (search, a list with the people ticked, Load more users), but it lists only the people the server finds eligible: they hold the permission to approve
 * training content, in the scope of the department of the activity, and are not kept apart from it. The organizer also says who approves first. Save stores the choice; nobody is told until the
 * activity is submitted for approval. The server checks again when the choice is saved and when the person signs.
 */
export function TrainingApproverSelectModal({ activityId, initialFirstId, initialSecondId, busy, onClose, onSave }: {
  activityId: string;
  initialFirstId?: string;
  initialSecondId?: string;
  busy: boolean;
  onClose: () => void;
  onSave: (firstId: string, secondId: string) => void;
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [query, setQuery] = useState("");
  const [people, setPeople] = useState<TrainingPerson[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // the people ticked, in the order they approve: the first of the list approves first
  const [chosen, setChosen] = useState<TrainingPerson[]>([]);
  const [known, setKnown] = useState<Record<string, TrainingPerson>>({});

  useEffect(() => {
    const timer = setTimeout(() => setQuery(searchTerm.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchTerm]);
  useEffect(() => { setPage(1); }, [query]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    trainingActivitiesApi
      .eligibleApprovers(activityId, "CONTENT_APPROVE", query || undefined, page)
      .then((result) => {
        if (!alive) return;
        setPeople((existing) => (page === 1 ? result.data : [...existing, ...result.data.filter((p) => !existing.some((e) => e.id === p.id))]));
        setKnown((existing) => ({ ...existing, ...Object.fromEntries(result.data.map((p) => [p.id, p])) }));
        setHasMore(result.pagination.page < result.pagination.totalPages);
      })
      .catch((e) => { if (alive) { setPeople([]); setHasMore(false); setError(trainingError(e)); } })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [activityId, query, page]);

  // what was saved before is ticked again once the people are known
  useEffect(() => {
    if (chosen.length > 0 || !initialFirstId || !initialSecondId) return;
    const first = known[initialFirstId];
    const second = known[initialSecondId];
    if (first && second) setChosen([first, second]);
  }, [known, chosen.length, initialFirstId, initialSecondId]);

  const chosenIds = useMemo(() => new Set(chosen.map((p) => p.id)), [chosen]);
  const toggle = (person: TrainingPerson) =>
    setChosen((current) => {
      if (current.some((p) => p.id === person.id)) return current.filter((p) => p.id !== person.id);
      return current.length >= 2 ? current : [...current, person];
    });
  const swap = () => setChosen((current) => (current.length === 2 ? [current[1], current[0]] : current));
  const complete = chosen.length === 2;
  // SOP.0003 5.3.5: the head of the unit concerned and the Quality Manager; any other choice is allowed, with a notice
  const asSop = complete && ((chosen[0].role === "UNIT_HEAD" && chosen[1].role === "QUALITY_MANAGER") || (chosen[0].role === "QUALITY_MANAGER" && chosen[1].role === "UNIT_HEAD"));

  return (
    <FormModal
      isOpen
      onClose={onClose}
      onConfirm={() => complete && onSave(chosen[0].id, chosen[1].id)}
      title={tr("Select Approver")}
      description={tr("Select two people who hold the permission to approve training content. They approve the content and the test of this training one after the other. SOP.0003 expects the head of the unit concerned and the Quality Manager.")}
      confirmText={tr("Save")}
      confirmDisabled={!complete}
      isLoading={busy}
      size="lg"
    >
      <div className="space-y-4">
        {complete && !asSop && (
          <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {tr("Notice: SOP.0003 5.3.5 expects the head of the unit concerned and the Quality Manager to approve. You may save this choice; it is recorded in the Audit Trail.")}
          </p>
        )}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder={tr("Search by name, position, or department...")}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-4 text-sm transition-colors placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            autoFocus
          />
        </div>

        <div className="custom-scrollbar -mx-1 max-h-[300px] min-h-[150px] overflow-y-auto px-1">
          {error ? (
            <p role="alert" className="text-sm text-red-700">{error}</p>
          ) : loading && page === 1 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 py-12 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 animate-pulse items-center justify-center rounded-full bg-white shadow-sm">
                <User className="h-6 w-6 text-slate-300" />
              </div>
              <p className="text-sm font-semibold text-slate-900">{tr("Loading approvers...")}</p>
            </div>
          ) : people.length > 0 ? (
            <div className="space-y-2">
              {people.map((person, index) => {
                const isSelected = chosenIds.has(person.id);
                const disabled = !isSelected && chosen.length >= 2;
                return (
                  <button
                    key={person.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => toggle(person)}
                    aria-pressed={isSelected}
                    className={cn(
                      "group flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-all disabled:cursor-not-allowed disabled:opacity-50",
                      isSelected ? "border-emerald-200 bg-emerald-50 shadow-sm" : "border-slate-200 bg-white hover:border-emerald-500/30 hover:shadow-sm",
                    )}
                  >
                    <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition-colors", isSelected ? "border-emerald-200 bg-emerald-100 text-emerald-700" : "border-slate-200 bg-slate-100 text-slate-500")}>
                      {isSelected ? <Check className="h-4 w-4" /> : index + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-medium text-slate-900 md:text-sm">{person.fullName}</div>
                      <div className="mt-0.5 truncate text-xs text-slate-500">
                        <span className="mr-1.5 font-medium text-emerald-600">{person.employeeCode || "-"}</span>
                        • {person.position || "-"} • {person.department || "-"}
                      </div>
                    </div>
                    {person.role && ROLE_TEXT[person.role] && (
                      <span className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-2xs font-medium text-slate-600">{tr(ROLE_TEXT[person.role])}</span>
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 py-12 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm">
                <User className="h-6 w-6 text-slate-300" />
              </div>
              <p className="text-sm font-semibold text-slate-900">{query ? tr("No users found") : tr("No eligible approver was found")}</p>
              <p className="mt-1 text-xs text-slate-500">
                {query ? tr("Try a different search term") : tr("A person needs the permission to approve training content in the department of this training, and cannot be the person who prepared it.")}
              </p>
            </div>
          )}
        </div>
        {hasMore && (
          <div className="flex justify-center">
            <Button size="sm" variant="outline" loading={loading} onClick={() => setPage((value) => value + 1)}>
              {tr("Load more users")}
            </Button>
          </div>
        )}

        <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
          <p className="text-xs font-semibold text-slate-700">{tr("Order of the approval")}</p>
          {complete ? (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-800">
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">{tr("Approves first")}</span>
              <span className="font-medium">{chosen[0].fullName}</span>
              <span className="text-slate-400">→</span>
              <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-700">{tr("Approves second")}</span>
              <span className="font-medium">{chosen[1].fullName}</span>
              <Button size="sm" variant="outline" className="ml-auto" onClick={swap}>{tr("Swap order")}</Button>
            </div>
          ) : (
            <p className="mt-1 text-xs text-slate-500">{tr("Tick two people. Then choose who approves first.")}</p>
          )}
        </div>
      </div>
    </FormModal>
  );
}
