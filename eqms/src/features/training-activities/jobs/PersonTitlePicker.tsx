import { useCallback, useEffect, useState } from "react";
import { X } from "lucide-react";
import { Select, type SelectOption } from "@/components/ui/select/Select";
import { trainingActivitiesApi } from "@/services/api/trainingActivities";

/** A person as a job assignment writes them: the name and the position (Position of the user), for example "Doan Thu Ha - Head of QC". */
export const personTitle = (p: { fullName: string; position?: string | null }) => (p.position ? `${p.fullName} - ${p.position}` : p.fullName);

const split = (value: string) => value.split(/\s*;\s*|\n/).map((x) => x.trim()).filter(Boolean);

/**
 * Chooses people by their name and position. One person ("Job title of direct superior", "Substitute in absence") or several ("Job title of subordinates"); the value is the text that
 * APD.0024 prints, the people separated by "; ". A value that was typed before (a title that is not a person) is kept and shown as it is.
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

  if (!multiple) {
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
  return (
    <div className="space-y-2">
      {chosen.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {chosen.map((c) => (
            <li key={c} className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 py-0.5 pl-2.5 pr-1 text-xs text-slate-800">
              {c}
              {!disabled && (
                <button type="button" aria-label={`Remove ${c}`} className="rounded-full p-0.5 text-slate-500 hover:bg-slate-200" onClick={() => onChange(chosen.filter((x) => x !== c).join("; "))}>
                  <X className="h-3 w-3" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {!disabled && (
        <Select
          value=""
          aria-label={label}
          placeholder={chosen.length ? "Add another person" : "Search by name"}
          options={options.filter((o) => !chosen.includes(String(o.value)))}
          onSearch={async (q) => (await search(q)).filter((o) => !chosen.includes(String(o.value)))}
          onChange={(v) => { const next = String(v); if (next && !chosen.includes(next)) onChange([...chosen, next].join("; ")); }}
        />
      )}
    </div>
  );
}
