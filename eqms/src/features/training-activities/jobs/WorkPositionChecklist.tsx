import { useId, useMemo, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox/Checkbox";
import { SearchInput } from "@/components/ui/form/SearchInput";
import { Select } from "@/components/ui/select/Select";
import type { TrainingPosition } from "@/services/api/trainingActivities";
import { tr } from "@/i18n";

const ALL = "ALL";

/** The Work Positions that can be given, grouped by department: tick one to choose it. A Work Position with no department has no matrix and is not offered. */
export function WorkPositionChecklist({ positions, selectedIds, excludedIds, onToggle }: {
  positions: TrainingPosition[];
  selectedIds: string[];
  /** Held already: not offered again. */
  excludedIds: string[];
  onToggle: (id: string) => void;
}) {
  const baseId = useId();
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState(ALL);
  const offered = useMemo(() => positions.filter((p) => p.departmentId && !excludedIds.includes(p.id)), [positions, excludedIds]);
  const departments = useMemo(() => Array.from(new Set(offered.map((p) => p.departmentName ?? ""))).sort(), [offered]);
  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const byDepartment = new Map<string, TrainingPosition[]>();
    offered
      .filter((p) => (department === ALL || p.departmentName === department) && (!q || `${p.name} ${p.code} ${p.departmentName}`.toLowerCase().includes(q)))
      .forEach((p) => byDepartment.set(p.departmentName ?? "", [...(byDepartment.get(p.departmentName ?? "") ?? []), p]));
    return Array.from(byDepartment.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [offered, query, department]);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_15rem]">
        <SearchInput value={query} onChange={setQuery} placeholder="Search by Work Position, code or department..." ariaLabel="Search by Work Position, code or department..." />
        <Select
          aria-label={tr("Department")}
          value={department}
          onChange={setDepartment}
          options={[{ label: tr("All departments"), value: ALL }, ...departments.map((d) => ({ label: d, value: d }))]}
        />
      </div>
      <div className="max-h-96 overflow-y-auto rounded-lg border border-slate-200">
        {groups.length === 0 && <p className="px-3 py-8 text-center text-sm text-slate-500">{tr("No matching Work Position")}</p>}
        {groups.map(([name, list]) => (
          <section key={name} aria-label={name}>
            <h4 className="sticky top-0 z-10 flex justify-between gap-2 border-b border-slate-100 bg-slate-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <span className="truncate">{name}</span>
              <span>{list.length}</span>
            </h4>
            <ul>
              {list.map((p) => {
                const checked = selectedIds.includes(p.id);
                const id = `${baseId}-${p.id}`;
                return (
                  <li key={p.id} className={`flex min-h-11 items-center gap-3 border-b border-slate-100 px-3 ${checked ? "bg-emerald-50/60" : "hover:bg-slate-50"}`}>
                    <Checkbox id={id} checked={checked} onChange={() => onToggle(p.id)} />
                    <label htmlFor={id} className="flex min-w-0 flex-1 cursor-pointer items-center justify-between gap-3 py-2.5 text-sm text-slate-800">
                      <span className="min-w-0 break-words">{p.name}</span>
                      <span className="shrink-0 text-xs text-slate-400">{p.code}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
