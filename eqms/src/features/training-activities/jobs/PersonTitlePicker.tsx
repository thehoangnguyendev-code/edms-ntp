import { useCallback, useEffect, useState } from "react";
import { Select, type SelectOption } from "@/components/ui/select/Select";
import { MultiSelect } from "@/components/ui/select/MultiSelect";
import { Popover } from "@/components/ui/popover/Popover";
import { CONTROL_STATE_CLASSES } from "@/components/ui/controlState";
import { trainingActivitiesApi } from "@/services/api/trainingActivities";

/** A person as a job assignment writes them: the name and the position (Position of the user), for example "Doan Thu Ha (Head of QC)". */
export const personTitle = (p: { fullName: string; position?: string | null }) => (p.position ? `${p.fullName} (${p.position})` : p.fullName);

const split = (value: string) => value.split(/\s*;\s*|\n/).map((x) => x.trim()).filter(Boolean);

/** The people chosen, shown as tags when the field cannot be changed (the same look as the Co-Author(s) of a locked document); the ones that do not fit go in a popover. */
function ChosenTags({ names, label }: { names: string[]; label: string }) {
  if (names.length === 0) return <input type="text" readOnly value="" placeholder="—" aria-label={label} className={CONTROL_STATE_CLASSES.readonlyField} />;
  return (
    <div className="flex min-h-9 w-full flex-wrap items-center gap-1 rounded-lg border border-slate-200 bg-slate-100 px-2 py-1">
      {names.slice(0, 2).map((name) => (
        <span key={name} className="inline-flex min-w-0 max-w-full shrink items-center rounded-xl bg-slate-200 px-2 py-0.5 text-[10px] text-slate-600">
          <span className="truncate">{name}</span>
        </span>
      ))}
      {names.length > 2 && (
        <Popover
          title={label}
          placement="top"
          triggerAriaLabel={`View ${names.length - 2} more`}
          trigger={<span className="text-[10px] font-medium">+{names.length - 2}</span>}
          triggerClassName="inline-flex items-center rounded-lg bg-slate-200 px-1.5 py-0.5 text-[10px] font-medium whitespace-nowrap text-slate-500 hover:bg-slate-300"
          contentClassName="min-w-[180px] max-w-[280px]"
          content={
            <div className="space-y-0.5">
              {names.slice(2).map((name) => (
                <div key={name} className="flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-slate-50">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />
                  <span className="truncate pr-2 text-xs font-medium text-slate-700">{name}</span>
                </div>
              ))}
            </div>
          }
        />
      )}
    </div>
  );
}

/**
 * Chooses people by their name and position. One person ("Job title of direct superior", "Substitute in absence") or several ("Job title of subordinates", optional: it can stay empty); the value
 * is the text that APD.0024 prints, the people separated by "; ". Several people use the same MultiSelect as the Co-Author(s) of a document. A value that was typed before (a title that is not a
 * person) is kept and shown as it is.
 */
export function PersonTitlePicker({ value, onChange, multiple = false, disabled = false, label }: { value: string; onChange: (value: string) => void; multiple?: boolean; disabled?: boolean; label: string }) {
  const [options, setOptions] = useState<SelectOption[]>([]);
  const search = useCallback(async (query: string) => {
    const list = await trainingActivitiesApi.people(query).catch(() => []);
    const mapped = list.map((p) => ({ label: personTitle(p), value: personTitle(p) }));
    setOptions(mapped);
    return mapped;
  }, []);
  useEffect(() => { if (!disabled) void search(""); }, [disabled, search]);
  const chosen = split(value);
  const withCurrent = (extra: string[]) => [...options, ...extra.filter((c) => !options.some((o) => o.value === c)).map((c) => ({ label: c, value: c }))];

  if (multiple) {
    if (disabled) return <ChosenTags names={chosen} label={label} />;
    return (
      <MultiSelect
        value={chosen}
        options={withCurrent(chosen)}
        enableSearch
        onSearch={search}
        placeholder="Search by name"
        maxVisibleTags={2}
        onChange={(values) => onChange(values.map(String).join("; "))}
      />
    );
  }
  return (
    <Select
      value={value}
      disabled={disabled}
      aria-label={label}
      placeholder="Search by name"
      options={withCurrent(chosen)}
      onSearch={search}
      onChange={(v) => onChange(String(v))}
    />
  );
}
