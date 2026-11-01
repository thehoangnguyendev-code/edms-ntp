import { useCallback, useEffect, useState } from "react";
import { IconArrowUp } from "@tabler/icons-react";
import { Button } from "@/components/ui/button/Button";
import { FormModal } from "@/components/ui/modal/FormModal";
import { FormField } from "@/components/ui/form/ResponsiveForm";
import { Select } from "@/components/ui/select/Select";
import { DataTable, type DataTableColumn } from "@/components/ui/table/DataTable";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { useToast } from "@/components/ui/toast/Toast";
import { dictionaryApi } from "@/services/api/dictionary";
import { trainingError, trainingSettingsApi, type TrainingNumberCounter } from "@/services/api/trainingActivities";

const INPUT = "w-full h-9 px-3.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500";

/**
 * The counters of the Training Numbers (TRN/DC/YY-XXX): for each department and year, the last serial that was issued. At go-live the Administrator raises a counter to the last serial of the
 * paper log, so that the numbers the system issues go on after it. A counter only goes up: one that went down could issue a number twice.
 */
export function TrainingNumberCountersPanel({ canManage }: { canManage: boolean }) {
  const { showToast } = useToast();
  const [rows, setRows] = useState<TrainingNumberCounter[]>([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [departments, setDepartments] = useState<{ label: string; value: string }[]>([]);
  const [raising, setRaising] = useState<{ departmentId: string; year: string; lastSerial: string; reason: string }>();
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    trainingSettingsApi
      .numberCounters({ page, limit })
      .then((result) => {
        setRows(result.data);
        setTotal(result.pagination.total);
        setTotalPages(result.pagination.totalPages);
        setError("");
      })
      .catch((e) => setError(trainingError(e)))
      .finally(() => setLoading(false));
  }, [page, limit]);
  useEffect(load, [load]);
  useEffect(() => {
    dictionaryApi.getDepartments().then((list) => setDepartments(list.filter((d) => d.isActive).map((d) => ({ label: d.name, value: d.id })))).catch(() => setDepartments([]));
  }, []);

  const raise = async () => {
    if (!raising) return;
    setBusy(true);
    try {
      await trainingSettingsApi.raiseNumberCounter({ departmentId: raising.departmentId, year: Number(raising.year), lastSerial: Number(raising.lastSerial), reason: raising.reason.trim() });
      showToast({ type: "success", title: "Counter raised", message: "The next number goes on after the serial you entered." });
      setRaising(undefined);
      setPage(1);
      load();
    } catch (e) {
      showToast({ type: "error", title: "The counter was not raised", message: trainingError(e) });
    } finally {
      setBusy(false);
    }
  };

  const columns: DataTableColumn<TrainingNumberCounter>[] = [
    { id: "no", header: "No.", locked: true, cell: (_r, i) => (page - 1) * limit + i + 1 },
    { id: "department", header: "Department", cell: (r) => r.departmentName },
    { id: "code", header: "Code", cell: (r) => r.departmentCode },
    { id: "year", header: "Year", cell: (r) => r.year },
    { id: "last", header: "Last Serial Issued", cell: (r) => r.lastSerial },
    { id: "next", header: "Next Number", cell: (r) => <span className="font-mono">{r.nextNumber}</span> },
  ];
  const valid = Boolean(raising && raising.departmentId && Number(raising.year) >= 2000 && Number(raising.lastSerial) >= 1 && raising.reason.trim());

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-sm text-slate-600">
          The counter of the Training Numbers of each department and year (TRN/Department Code/Year-Serial). At go-live, raise a counter to the last serial of the paper log so that the numbers the system
          issues go on after it. A counter can only be raised, never lowered; a number that a paper record already carries is skipped in any case.
        </p>
        {canManage && (
          <Button size="sm" variant="outline-emerald" onClick={() => setRaising({ departmentId: "", year: String(new Date().getFullYear()), lastSerial: "", reason: "" })}>
            <IconArrowUp className="h-4 w-4" /> Raise Counter
          </Button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <DataTable
        rows={rows}
        getRowKey={(r) => `${r.departmentId}-${r.year}`}
        isLoading={loading}
        loadingContent={<SectionLoading text="Loading…" />}
        columns={columns}
        emptyState={<TableEmptyState title="No counter yet" description="A counter is made when the first Training Number of a department and year is issued." />}
        pagination={
          total > 0 ? (
            <TablePagination
              currentPage={page}
              totalPages={totalPages}
              totalItems={total}
              itemsPerPage={limit}
              onPageChange={setPage}
              onItemsPerPageChange={(value) => {
                setLimit(value);
                setPage(1);
              }}
            />
          ) : undefined
        }
      />
      <FormModal
        isOpen={!!raising}
        onClose={() => setRaising(undefined)}
        onConfirm={() => void raise()}
        title="Raise the Counter"
        description="The serial is the last one written in the paper log of the department for the year. The next number the system issues is the one after it."
        confirmText="Raise"
        isLoading={busy}
        confirmDisabled={!valid}
        size="2xl"
      >
        {raising && (
          <div className="grid gap-4">
            <FormField label="Department" required>
              <Select value={raising.departmentId} onChange={(v) => setRaising({ ...raising, departmentId: String(v) })} options={departments} placeholder="Select department..." />
            </FormField>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormField label="Year" required>
                <input type="number" className={INPUT} min={2000} value={raising.year} onChange={(e) => setRaising({ ...raising, year: e.target.value })} />
              </FormField>
              <FormField label="Last Serial of the Paper Log" required>
                <input type="number" className={INPUT} min={1} value={raising.lastSerial} onChange={(e) => setRaising({ ...raising, lastSerial: e.target.value })} />
              </FormField>
            </div>
            <FormField label="Reason" required>
              {/* Three lines, fixed: the person cannot drag it to another size; a long reason scrolls inside it. */}
              <textarea
                rows={3}
                className="block w-full resize-none overflow-y-auto rounded-lg border border-slate-200 px-3.5 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                value={raising.reason}
                onChange={(e) => setRaising({ ...raising, reason: e.target.value })}
              />
            </FormField>
          </div>
        )}
      </FormModal>
    </div>
  );
}
