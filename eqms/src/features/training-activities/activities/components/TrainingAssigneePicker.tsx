import { useEffect, useMemo, useState } from "react";
import { Building2, Plus, Search, Trash2, Users, X } from "lucide-react";
import { IconBuilding, IconCheck, IconListCheck, IconUser, IconUserQuestion } from "@tabler/icons-react";
import { TabNav } from "@/components/ui/tabs/TabNav";
import { Checkbox } from "@/components/ui/checkbox/Checkbox";
import { Badge } from "@/components/ui/badge/Badge";
import { Button } from "@/components/ui/button/Button";
import { Input } from "../../shared/TrainingFields";
import { DataTable, type DataTableColumn } from "@/components/ui/table/DataTable";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { cn } from "@/components/ui/utils";
import { trainingActivitiesApi, type TrainingGroup, type TrainingPerson, type TrainingSuggestedParticipant } from "@/services/api/trainingActivities";

type Scope = "matrix" | "business_unit" | "department" | "individual" | "outside";
export interface Outsider { name: string; org: string }
export interface AssigneeSelection { personIds: string[]; outsiders: Outsider[] }

/** A business unit or a department as a card with its number of people; a click selects or clears it. */
function GroupCard({ group, selected, onToggle, icon }: { group: TrainingGroup; selected: boolean; onToggle: () => void; icon: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn("relative min-w-0 rounded-lg border p-2.5 text-left transition-all", selected ? "border-emerald-500 bg-emerald-50 shadow-sm" : "border-slate-200 bg-white hover:border-emerald-200 hover:bg-slate-50")}
    >
      <div className="flex items-start gap-2.5">
        <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border", selected ? "border-emerald-200 bg-white text-emerald-600" : "border-slate-200 bg-slate-50 text-slate-400")}>{icon}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-1">
            <span className="min-w-0 truncate text-xs font-semibold text-slate-900 sm:text-sm">{group.name}</span>
            {selected && <IconCheck className="h-4 w-4 shrink-0 text-emerald-500" />}
          </div>
          <span className={cn("mt-1 inline-flex rounded-full px-1.5 py-0.5 text-2xs font-medium", selected ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500")}>{group.total} employees</span>
        </div>
      </div>
    </button>
  );
}

const asPerson = (s: TrainingSuggestedParticipant): TrainingPerson => ({ id: s.personId, fullName: s.fullName, employeeCode: s.employeeCode, department: s.department, position: s.positionName });

/**
 * Choose people for a session from five sources (SOP.0003 5.3.4): the people the training matrix requires, a Business Unit, a Department, one by one, or a person from
 * outside (a visitor or a temporary contractor). The people come from the server, in the scope the person may act on. `onChange` gets what is chosen in the tab that is open.
 * `matrix` is given only when the activity and the session exist; without it the Matrix tab is not shown.
 */
export function TrainingAssigneePicker({ onChange, matrix, initialPeople }: { onChange: (selection: AssigneeSelection) => void; matrix?: TrainingSuggestedParticipant[]; /** People that are already chosen when the screen opens (for example from the initial training of a new employee). */ initialPeople?: TrainingPerson[] }) {
  const matrixPeople = useMemo(() => Array.from(new Map((matrix ?? []).map((m) => [m.personId, m])).values()), [matrix]);
  const hasMatrix = matrix !== undefined;
  const [scope, setScope] = useState<Scope>("individual");
  const [units, setUnits] = useState<TrainingGroup[]>([]);
  const [departments, setDepartments] = useState<TrainingGroup[]>([]);
  const [chosenUnits, setChosenUnits] = useState<string[]>([]);
  const [chosenDepartments, setChosenDepartments] = useState<string[]>([]);
  const [chosenMatrix, setChosenMatrix] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [found, setFound] = useState<TrainingPerson[]>([]);
  const [picked, setPicked] = useState<Record<string, TrainingPerson>>(() => Object.fromEntries((initialPeople ?? []).map((p) => [p.id, p])));
  const [inUnits, setInUnits] = useState<TrainingPerson[]>([]);
  const [inDepartments, setInDepartments] = useState<TrainingPerson[]>([]);
  const [outsiders, setOutsiders] = useState<Outsider[]>([{ name: "", org: "" }]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  useEffect(() => {
    trainingActivitiesApi.peopleGroups("BUSINESS_UNIT").then(setUnits).catch(() => setUnits([]));
    trainingActivitiesApi.peopleGroups("DEPARTMENT").then(setDepartments).catch(() => setDepartments([]));
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => { trainingActivitiesApi.people(search, 50).then(setFound).catch(() => setFound([])); }, 250);
    return () => clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    if (chosenUnits.length === 0) { setInUnits([]); return; }
    trainingActivitiesApi.peopleInGroups("BUSINESS_UNIT", chosenUnits).then(setInUnits).catch(() => setInUnits([]));
  }, [chosenUnits]);
  useEffect(() => {
    if (chosenDepartments.length === 0) { setInDepartments([]); return; }
    trainingActivitiesApi.peopleInGroups("DEPARTMENT", chosenDepartments).then(setInDepartments).catch(() => setInDepartments([]));
  }, [chosenDepartments]);
  useEffect(() => { setChosenMatrix([]); }, [matrix]);

  const filledOutsiders = outsiders.filter((o) => o.name.trim());
  const resolved: TrainingPerson[] = useMemo(() => {
    if (scope === "matrix") return matrixPeople.filter((m) => chosenMatrix.includes(m.personId)).map(asPerson);
    if (scope === "business_unit") return inUnits;
    if (scope === "department") return inDepartments;
    if (scope === "outside") return filledOutsiders.map((o, i) => ({ id: `outside-${i}`, fullName: o.name.trim(), employeeCode: null, department: o.org.trim() || null, position: "Outside person", businessUnit: "Outside" }));
    return Object.values(picked);
  }, [scope, matrixPeople, chosenMatrix, inUnits, inDepartments, filledOutsiders, picked]);
  const key = scope === "outside" ? filledOutsiders.map((o) => `${o.name}|${o.org}`).join(",") : resolved.map((p) => p.id).join(",");
  useEffect(() => {
    onChange(scope === "outside" ? { personIds: [], outsiders: filledOutsiders.map((o) => ({ name: o.name.trim(), org: o.org.trim() })) } : { personIds: resolved.map((p) => p.id), outsiders: [] });
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, key]);

  const tabs = [
    ...(hasMatrix ? [{ id: "matrix", label: `Required by matrix${matrixPeople.length ? ` (${matrixPeople.length})` : ""}`, icon: IconListCheck }] : []),
    { id: "business_unit", label: "Business Unit", icon: IconBuilding },
    { id: "department", label: "Department", icon: Building2 },
    { id: "individual", label: "Individual", icon: IconUser },
    { id: "outside", label: "Outside person", icon: IconUserQuestion },
  ];
  const toggle = (list: string[], set: (next: string[]) => void, name: string) => set(list.includes(name) ? list.filter((x) => x !== name) : [...list, name]);
  const togglePerson = (person: TrainingPerson) => setPicked((old) => { const next = { ...old }; if (next[person.id]) delete next[person.id]; else next[person.id] = person; return next; });
  const rows = resolved.slice((page - 1) * limit, page * limit);
  const columns: DataTableColumn<TrainingPerson>[] = [
    { id: "rowNo", header: "No.", locked: true, cell: (_r, i) => (page - 1) * limit + i + 1 },
    { id: "code", header: "Employee ID", cell: (p) => <span className="font-semibold text-emerald-600">{p.employeeCode ?? "—"}</span> },
    { id: "name", header: "Full Name", cell: (p) => <span className="font-medium text-slate-900">{p.fullName}</span> },
    { id: "email", header: "Email", cell: (p) => p.email ?? "—" },
    { id: "position", header: "Position", cell: (p) => p.position ?? "—" },
    { id: "department", header: scope === "outside" ? "Organisation" : "Department", cell: (p) => p.department ?? "—" },
    { id: "unit", header: "Business Unit", cell: (p) => p.businessUnit || "—" },
  ];

  return (
    <div className="space-y-5">
      <div className="space-y-4">
        <TabNav tabs={tabs} activeTab={scope} onChange={(id) => setScope(id as Scope)} variant="pill" layoutId="training-assignee-scope" />

        {scope === "matrix" && (
          <div className="rounded-xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between px-3 pb-2 pt-3">
              <p className="text-xs font-semibold text-slate-700 sm:text-sm">People the training matrix requires for this topic</p>
              {matrixPeople.length > 0 && <button type="button" className="text-xs text-emerald-700 underline" onClick={() => setChosenMatrix(chosenMatrix.length === matrixPeople.length ? [] : matrixPeople.map((m) => m.personId))}>{chosenMatrix.length === matrixPeople.length ? "Clear all" : "Select all"}</button>}
            </div>
            <div className="max-h-[360px] space-y-1 overflow-y-auto px-2 pb-2">
              {matrixPeople.length === 0 && <p className="p-3 text-sm text-slate-500">The matrix requires nobody else for this topic.</p>}
              {matrixPeople.map((m) => (
                <label key={m.personId} className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-transparent p-1.5 transition-all hover:border-emerald-200 hover:bg-emerald-50/50">
                  <Checkbox checked={chosenMatrix.includes(m.personId)} onChange={(c) => setChosenMatrix(c ? [...chosenMatrix, m.personId] : chosenMatrix.filter((x) => x !== m.personId))} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="truncate text-xs font-medium leading-tight text-slate-900 sm:text-sm">{m.fullName}</p>
                      {m.employeeCode && <Badge color="emerald" size="sm" pill>{m.employeeCode}</Badge>}
                      <Badge color={m.reason === "DUE" ? "amber" : "red"} size="sm">{m.reason === "DUE" ? "Annual training due" : "Not trained"}</Badge>
                    </div>
                    <p className="mt-0.5 truncate text-2xs leading-tight text-slate-500 sm:text-xs">{[m.positionName, m.department].filter(Boolean).join(" - ")}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}

        {scope === "individual" && (
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search…"
                className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-10 text-sm text-slate-700 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              {search && (
                <button type="button" onClick={() => setSearch("")} className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 transition-colors hover:text-slate-600" aria-label="Clear employee search"><X className="h-4 w-4" /></button>
              )}
            </div>
            <div className="rounded-xl border border-slate-200 bg-white">
              <div className="px-3 pb-2 pt-3"><p className="text-xs font-semibold text-slate-700 sm:text-sm">Employee List</p></div>
              <div className="max-h-[360px] space-y-1 overflow-y-auto px-2 pb-2">
                {found.length === 0 && <p className="p-3 text-sm text-slate-500">No employee found.</p>}
                {found.map((p) => (
                  <label key={p.id} className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-transparent p-1.5 transition-all hover:border-emerald-200 hover:bg-emerald-50/50">
                    <Checkbox checked={!!picked[p.id]} onChange={() => togglePerson(p)} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="truncate text-xs font-medium leading-tight text-slate-900 sm:text-sm">{p.fullName}</p>
                        {p.employeeCode && <Badge color="emerald" size="sm" pill>{p.employeeCode}</Badge>}
                      </div>
                      <p className="mt-0.5 truncate text-2xs leading-tight text-slate-500 sm:text-xs">{[p.position, p.department, p.businessUnit].filter(Boolean).join(" - ")}{p.email ? ` | ${p.email}` : ""}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {scope === "business_unit" && (
          <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3">
            {units.length === 0 && <p className="col-span-full text-sm text-slate-500">No business unit.</p>}
            {units.map((g) => <GroupCard key={g.name} group={g} selected={chosenUnits.includes(g.name)} onToggle={() => toggle(chosenUnits, setChosenUnits, g.name)} icon={<IconBuilding className="h-4 w-4" />} />)}
          </div>
        )}

        {scope === "department" && (
          <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-4">
            {departments.length === 0 && <p className="col-span-full text-sm text-slate-500">No department.</p>}
            {departments.map((g) => <GroupCard key={g.name} group={g} selected={chosenDepartments.includes(g.name)} onToggle={() => toggle(chosenDepartments, setChosenDepartments, g.name)} icon={<Users className="h-4 w-4" />} />)}
          </div>
        )}

        {scope === "outside" && (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">A visitor or a temporary contractor has no account: only the name and the organisation are written on the attendee list.</p>
            {outsiders.map((o, i) => (
              <div key={i} className="grid grid-cols-1 items-center gap-3 md:grid-cols-[1fr_1fr_auto]">
                <Input value={o.name} placeholder="Full name" onChange={(e) => setOutsiders(outsiders.map((x, k) => (k === i ? { ...x, name: e.target.value } : x)))} />
                <Input value={o.org} placeholder="Organisation" onChange={(e) => setOutsiders(outsiders.map((x, k) => (k === i ? { ...x, org: e.target.value } : x)))} />
                <Button size="icon-sm" variant="ghost" aria-label="Remove this person" disabled={outsiders.length === 1} onClick={() => setOutsiders(outsiders.filter((_x, k) => k !== i))}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
            <Button size="sm" variant="default" onClick={() => setOutsiders([...outsiders, { name: "", org: "" }])}><Plus className="mr-1.5 h-4 w-4" />Add another person</Button>
          </div>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-slate-700 sm:text-sm">Selected Assignees</p>
          {resolved.length > 0 && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700">{resolved.length} {scope === "outside" ? `person${resolved.length !== 1 ? "s" : ""}` : `employee${resolved.length !== 1 ? "s" : ""}`}</span>}
        </div>
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <DataTable
            rows={rows}
            getRowKey={(p) => p.id}
            columns={columns}
            emptyState={<TableEmptyState title="No assignees selected" description="Select assignees from the scope selector above." />}
            pagination={resolved.length > 0 ? <TablePagination currentPage={page} totalPages={Math.max(1, Math.ceil(resolved.length / limit))} totalItems={resolved.length} itemsPerPage={limit} onPageChange={setPage} onItemsPerPageChange={setLimit} /> : undefined}
          />
        </div>
      </div>
    </div>
  );
}
