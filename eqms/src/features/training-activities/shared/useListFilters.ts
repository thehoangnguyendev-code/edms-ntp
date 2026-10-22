import { useCallback, useEffect, useMemo, useState } from "react";
import { usePersistedState } from "@/hooks/usePersistedState";
import { pickerDateToIso, type ReportDateFilter } from "@/features/report/shared/ReportListToolbar";
import { dictionaryApi } from "@/services/api/dictionary";

/** Departments for a filter: the label is the name, the value is the id. */
export function useDepartmentOptions(): { label: string; value: string }[] {
  const [options, setOptions] = useState<{ label: string; value: string }[]>([]);
  useEffect(() => {
    let live = true;
    dictionaryApi.getDepartments().then((list) => { if (live) setOptions(list.map((d) => ({ label: d.name, value: d.id }))); }).catch(() => { if (live) setOptions([]); });
    return () => { live = false; };
  }, []);
  return options;
}

/** Departments for a filter whose server side compares the department name (people carry their department as text). */
export function useDepartmentNameOptions(): { label: string; value: string }[] {
  const options = useDepartmentOptions();
  return useMemo(() => options.map((o) => ({ label: o.label, value: o.label })), [options]);
}

export interface DateRange {
  from: string;
  to: string;
  filter: ReportDateFilter;
  /** The request parameters of the range as yyyy-MM-dd (the picker holds dd/MM/yyyy), empty when it is not set. */
  params: (fromKey: string, toKey: string) => Record<string, string | undefined>;
  clear: () => void;
  isSet: boolean;
}

/**
 * One date filter, remembered per screen. The label says which date it is (for example "Created Date Range"), so a screen with several dates never leaves
 * the person guessing; {@code onChange} is called after the range changed, to send the list back to its first page.
 */
export function useDateRange(key: string, label: string, onChange?: () => void): DateRange {
  const [from, setFrom] = usePersistedState(`${key}From`, "");
  const [to, setTo] = usePersistedState(`${key}To`, "");
  const set = useCallback((a: string, b: string) => { setFrom(a); setTo(b); onChange?.(); }, [setFrom, setTo, onChange]);
  const clear = useCallback(() => { setFrom(""); setTo(""); }, [setFrom, setTo]);
  return {
    from,
    to,
    isSet: Boolean(from || to),
    clear,
    filter: { id: key, label, from, to, onChange: set },
    params: (fromKey, toKey) => ({ [fromKey]: pickerDateToIso(from) || undefined, [toKey]: pickerDateToIso(to) || undefined }),
  };
}

/** Sends the list back to its first page whenever one of the date filters changes (the table is created after the filters, so it cannot be given to them). */
export function resettingDates(dates: ReportDateFilter[], reset: () => void): ReportDateFilter[] {
  return dates.map((d) => ({ ...d, onChange: (from: string, to: string) => { d.onChange(from, to); reset(); } }));
}
