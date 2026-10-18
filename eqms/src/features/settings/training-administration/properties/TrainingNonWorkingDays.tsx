import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button/Button";
import { FormSection } from "@/components/ui/form/FormSection";
import { FormField } from "@/components/ui/form/ResponsiveForm";
import { Select } from "@/components/ui/select/Select";
import { useToast } from "@/components/ui/toast/Toast";
import { DataTable, type DataTableColumn } from "@/components/ui/table/DataTable";
import { Input } from "@/features/training-activities/shared/TrainingFields";
import { TrainingDateField } from "@/features/training-activities/shared/TrainingDateField";
import { day } from "@/features/training-activities/shared/trainingLabels";
import { trainingCalendarApi, trainingError, type TrainingNonWorkingDay } from "@/services/api/trainingActivities";

/**
 * The days the site does not work besides Saturday and Sunday. They decide what "one working day" means for the time limits of Training Management.
 * Adding or removing a day needs a reason and is recorded in the Audit Trail.
 */
export function TrainingNonWorkingDays({ canEdit }: { canEdit: boolean }) {
  const { showToast } = useToast();
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(String(thisYear));
  const [rows, setRows] = useState<TrainingNonWorkingDay[]>([]);
  const [date, setDate] = useState("");
  const [name, setName] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => { trainingCalendarApi.list(Number(year)).then(setRows).catch(() => setRows([])); }, [year]);
  useEffect(load, [load]);

  const act = async (run: () => Promise<TrainingNonWorkingDay[]>, done: string) => {
    setBusy(true);
    try {
      setRows(await run());
      showToast({ type: "success", title: done, message: "" });
      return true;
    } catch (e) {
      showToast({ type: "error", title: "The change was not saved", message: trainingError(e) });
      return false;
    } finally {
      setBusy(false);
    }
  };
  const add = async () => {
    if (await act(() => trainingCalendarApi.add(date, name.trim(), reason.trim()), "Day added")) { setDate(""); setName(""); setReason(""); }
  };

  const columns: DataTableColumn<TrainingNonWorkingDay>[] = [
    { id: "rowNo", header: "No.", locked: true, cell: (_r, i) => i + 1 },
    { id: "day", header: "Date", cell: (r) => day(r.day) },
    { id: "name", header: "Name", cell: (r) => r.name },
    { id: "by", header: "Set by", cell: (r) => r.createdByName ?? "—" },
    ...(canEdit ? [{
      id: "remove",
      header: "",
      cell: (r: TrainingNonWorkingDay) => (
        <Button size="sm" variant="outline" disabled={busy || !reason.trim()} title={reason.trim() ? undefined : "Type the reason below first"} onClick={() => void act(() => trainingCalendarApi.remove(r.day, reason.trim()), "Day removed")}>Remove</Button>
      ),
    }] : []),
  ];
  const years = Array.from({ length: 7 }, (_, i) => String(thisYear - 2 + i)).map((y) => ({ value: y, label: y }));

  return (
    <FormSection title="Non-working days">
      <p className="mb-3 text-xs text-slate-500">Saturday and Sunday are never working days. Add the public holidays and company days off here, so that "one working day" is counted correctly.</p>
      <div className="mb-3 w-32"><Select value={year} options={years} aria-label="Year" onChange={setYear} /></div>
      <DataTable rows={rows} getRowKey={(r) => r.day} columns={columns} emptyState={<p className="p-4 text-sm text-slate-500">No day off set for {year}.</p>} />
      {canEdit && (
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
          <FormField label="Date"><TrainingDateField value={date} onChange={setDate} /></FormField>
          <FormField label="Name"><Input value={name} maxLength={120} onChange={(e) => setName(e.target.value)} /></FormField>
          <FormField label="Reason for the change" required><Input value={reason} onChange={(e) => setReason(e.target.value)} /></FormField>
          <div className="flex items-end"><Button variant="default" loading={busy} disabled={!date || !name.trim() || !reason.trim()} onClick={() => void add()}>Add day</Button></div>
        </div>
      )}
    </FormSection>
  );
}
