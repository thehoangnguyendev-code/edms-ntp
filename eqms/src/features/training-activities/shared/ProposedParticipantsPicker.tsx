import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox/Checkbox";
import { Avatar } from "@/components/ui/avatar";
import { Select } from "@/components/ui/select/Select";
import { trainingProposalApi, type TrainingGroup, type TrainingPerson } from "@/services/api/trainingActivities";

const ALL = "";
/** One grid for the header and every row, so the columns line up: tick, name, employee ID, position. */
const ROW = "grid grid-cols-[28px_minmax(0,1fr)_110px] items-center gap-3 px-3 py-2 sm:grid-cols-[28px_minmax(0,1fr)_110px_minmax(0,160px)]";

/**
 * One screen to choose the people: type a name or an employee ID, or narrow the list to a Business Unit and/or a Department, tick the people (or "Select all shown"),
 * and confirm. It edits the whole list: the people already proposed are ticked, unticking one takes the person off, ticking adds. `onChange` gets everyone who is ticked.
 */
export function ProposedParticipantsPicker({ initialIds, onChange }: { initialIds: string[]; onChange: (personIds: string[]) => void }) {
  const [units, setUnits] = useState<TrainingGroup[]>([]);
  const [departments, setDepartments] = useState<TrainingGroup[]>([]);
  const [unit, setUnit] = useState(ALL);
  const [department, setDepartment] = useState(ALL);
  const [search, setSearch] = useState("");
  const [people, setPeople] = useState<TrainingPerson[]>([]);
  const [loading, setLoading] = useState(false);
  const [chosen, setChosen] = useState<Set<string>>(() => new Set(initialIds));

  useEffect(() => {
    trainingProposalApi.peopleGroups("BUSINESS_UNIT").then(setUnits).catch(() => setUnits([]));
    trainingProposalApi.peopleGroups("DEPARTMENT").then(setDepartments).catch(() => setDepartments([]));
  }, []);

  // A Business Unit or a Department narrows the list to its people; the search then narrows it further. With neither, the search asks the server.
  useEffect(() => {
    let alive = true;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        let rows: TrainingPerson[];
        if (unit || department) {
          const [byUnit, byDepartment] = await Promise.all([
            unit ? trainingProposalApi.peopleInGroups("BUSINESS_UNIT", [unit]) : Promise.resolve(undefined),
            department ? trainingProposalApi.peopleInGroups("DEPARTMENT", [department]) : Promise.resolve(undefined),
          ]);
          const ids = byDepartment ? new Set(byDepartment.map((p) => p.id)) : undefined;
          rows = (byUnit ?? byDepartment ?? []).filter((p) => !ids || ids.has(p.id));
          const needle = search.trim().toLowerCase();
          if (needle) rows = rows.filter((p) => `${p.fullName} ${p.employeeCode ?? ""}`.toLowerCase().includes(needle));
        } else {
          rows = await trainingProposalApi.people(search, 50);
        }
        if (alive) setPeople(rows);
      } catch {
        if (alive) setPeople([]);
      } finally {
        if (alive) setLoading(false);
      }
    }, 250);
    return () => { alive = false; clearTimeout(timer); };
  }, [unit, department, search]);

  const allShown = people.length > 0 && people.every((p) => chosen.has(p.id));

  const update = (next: Set<string>) => { setChosen(next); onChange(Array.from(next)); };
  const toggle = (person: TrainingPerson) => {
    const next = new Set(chosen);
    if (!next.delete(person.id)) next.add(person.id);
    update(next);
  };
  const toggleAllShown = () => {
    const next = new Set(chosen);
    for (const p of people) { if (allShown) next.delete(p.id); else next.add(p.id); }
    update(next);
  };
  const options = (groups: TrainingGroup[], all: string) => [{ label: all, value: ALL }, ...groups.map((g) => ({ label: `${g.name} (${g.total})`, value: g.name }))];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Select aria-label="Business Unit" value={unit} onChange={setUnit} options={options(units, "All Business Units")} enableSearch />
        <Select aria-label="Department" value={department} onChange={setDepartment} options={options(departments, "All Departments")} enableSearch />
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or employee ID…" aria-label="Search people"
          className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-10 text-sm text-slate-700 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
        {search && <button type="button" onClick={() => setSearch("")} aria-label="Clear search" className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600"><X className="h-4 w-4" /></button>}
      </div>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="max-h-[340px] overflow-y-auto">
          <div className={`${ROW} sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500`}>
            <label aria-label="Select all shown" className="flex"><Checkbox checked={allShown} onChange={toggleAllShown} disabled={people.length === 0} /></label>
            <span>Full Name{people.length > 0 ? ` (${people.length})` : ""}</span>
            <span>Employee ID</span>
            <span className="hidden sm:block">Position</span>
          </div>
          <div className="divide-y divide-slate-100">
          {loading && people.length === 0 && <p className="p-4 text-sm text-slate-500">Loading…</p>}
          {!loading && people.length === 0 && <p className="p-4 text-sm text-slate-500">Nobody matches. Change the Business Unit, the Department or the search.</p>}
          {people.map((p) => {
            return (
              <label key={p.id} className={`${ROW} cursor-pointer text-sm hover:bg-emerald-50/50`}>
                <Checkbox checked={chosen.has(p.id)} onChange={() => toggle(p)} />
                <span className="flex min-w-0 items-center gap-2.5">
                  <Avatar name={p.fullName || "User"} src={p.avatar} tone="brand" className="h-7 w-7 shrink-0" />
                  <span className="truncate font-medium text-slate-900">{p.fullName}</span>
                </span>
                <span className="truncate text-slate-600">{p.employeeCode ?? "\u2014"}</span>
                <span className="hidden truncate text-slate-600 sm:block">{p.position ?? "\u2014"}</span>
              </label>
            );
          })}
          </div>
        </div>
        <div className="border-t border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">{chosen.size} selected</div>
      </div>
    </div>
  );
}
