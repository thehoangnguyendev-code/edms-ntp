import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DataTable, useCustomColumnLayout, type DataTableColumn } from "@/components/ui/table/DataTable";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { useServerTable } from "@/features/settings/shared/hooks/useServerTable";
import { ReportListToolbar, pickerDateToIso, type ReportSelectFilter } from "@/features/report/shared/ReportListToolbar";
import { usePersistedState } from "@/hooks/usePersistedState";
import { displayDateTime } from "@/utils/format";
import { electronicSignatureSettingsApi, type ElectronicSignatureMeaning, type ElectronicSignatureMeaningRow } from "@/services/api/electronicSignatureSettings";

interface Props {
  /** The meanings as they are being edited, with what has not been saved yet. */
  meanings: ElectronicSignatureMeaning[];
  canEdit: boolean;
  onRename: (code: string, displayName: string) => void;
  /** Changes when the settings were saved: the table asks the server again (the dates of the last update changed). */
  savedVersion: string;
}

/**
 * The signature meanings, one row per system-defined signing action, as a table that is searched, filtered by module and by the date of the last update, sorted and paged by the server.
 * The code is fixed by the application; the display name is the only field that can be changed, and what is typed stays (also on other pages) until the settings are saved with a signature.
 */
export const SignatureMeaningsTable: React.FC<Props> = ({ meanings, canEdit, onRename, savedVersion }) => {
  const [module, setModule] = usePersistedState("esign.meanings.module", "");
  const [from, setFrom] = usePersistedState("esign.meanings.updatedFrom", "");
  const [to, setTo] = usePersistedState("esign.meanings.updatedTo", "");
  const [modules, setModules] = useState<string[]>([]);
  const [error, setError] = useState("");

  const fetcher = useCallback(
    (params: Record<string, string | number | boolean | undefined>) =>
      electronicSignatureSettingsApi.meaningsPage(params).then((page) => {
        setModules(page.modules);
        setError("");
        return page;
      }).catch((e) => {
        setError("The signature meanings could not be loaded.");
        throw e;
      }),
    [],
  );
  const extraParams = useMemo(() => ({ module: module || undefined, updatedFrom: pickerDateToIso(from) || undefined, updatedTo: pickerDateToIso(to) || undefined }), [module, from, to]);
  const table = useServerTable<ElectronicSignatureMeaningRow>({ persistKey: "esign.meanings", fetcher, defaultSortBy: "code", defaultSortDirection: "asc", extraParams, initialItemsPerPage: 10, syncToUrl: false });
  // After the settings were saved the dates of the last update changed: ask again. The first value is the one the table started with, so it is not asked for twice, and the reload of the table
  // is read from a ref so that a new function from the table never starts another request.
  const reloadRef = useRef(table.reload);
  reloadRef.current = table.reload;
  const seen = useRef(savedVersion);
  useEffect(() => {
    if (seen.current === savedVersion) return;
    seen.current = savedVersion;
    reloadRef.current();
  }, [savedVersion]);

  // what the admin typed and has not saved is shown over what the server holds
  const typed = useMemo(() => new Map(meanings.map((m) => [m.code, m.displayName])), [meanings]);
  const sorted = (key: string) => ({ direction: table.sortConfig.key === key ? table.sortConfig.direction : undefined, onSort: () => table.handleSort(key) });

  const columns: DataTableColumn<ElectronicSignatureMeaningRow>[] = [
    { id: "rowNo", header: "No.", locked: true, cell: (_r, i) => (table.currentPage - 1) * table.itemsPerPage + i + 1 },
    { id: "code", header: "Code", sort: sorted("code"), cell: (r) => <span className="font-mono text-xs text-slate-800">{r.code}</span> },
    { id: "module", header: "Module", sort: sorted("module"), cell: (r) => r.module },
    {
      id: "displayName",
      header: "Display Name",
      sort: sorted("displayName"),
      cell: (r) => (
        <input
          aria-label={`Display name of ${r.code}`}
          className="h-9 w-full min-w-[220px] rounded-lg border border-slate-200 px-2.5 text-xs focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:bg-slate-50 sm:text-sm"
          value={typed.get(r.code) ?? r.displayName}
          disabled={!canEdit}
          maxLength={120}
          onChange={(e) => onRename(r.code, e.target.value)}
        />
      ),
    },
    { id: "updatedAt", header: "Last Updated On", sort: sorted("updatedAt"), cell: (r) => (r.updatedAt ? displayDateTime(r.updatedAt) : "—") },
  ];
  const { layout, control } = useCustomColumnLayout("esign.meanings", columns);

  const filters: ReportSelectFilter[] = [
    { id: "module", label: "Module", value: module, options: [{ label: "All modules", value: "" }, ...modules.map((m) => ({ label: m, value: m }))], onChange: (v) => { setModule(v); table.setCurrentPage(1); } },
  ];

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-600 sm:text-sm">
        One row per system-defined signing action. <strong>Code</strong> is fixed by the application and cannot be changed; <strong>Display Name</strong> is the only editable field and controls the label shown to the signer in the signing modal. Changes are saved with <strong>Save Changes</strong>.
      </p>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <ReportListToolbar
        searchPlaceholder="Search by code or display name…"
        search={table.searchQuery}
        onSearch={(v) => { table.setSearchQuery(v); table.setCurrentPage(1); }}
        filters={filters}
        dates={[{ id: "updated", label: "Last Updated Date Range", from, to, onChange: (a, b) => { setFrom(a); setTo(b); table.setCurrentPage(1); } }]}
        hasActiveFilters={Boolean(module || from || to || table.searchQuery)}
        onClear={() => { setModule(""); setFrom(""); setTo(""); table.setSearchQuery(""); table.setCurrentPage(1); }}
        customControl={control}
        framed={false}
        flush
      >
        <DataTable
          rows={table.items}
          getRowKey={(r) => r.code}
          isLoading={table.isLoading}
          loadingContent={<SectionLoading text="Loading…" />}
          columns={columns}
          columnLayout={layout}
          emptyState={<TableEmptyState title="No Signature Meanings" description="No signature meaning matches the search or the filters." />}
          pagination={table.totalItems > 0 ? (
            <TablePagination currentPage={table.currentPage} totalPages={table.totalPages} totalItems={table.totalItems} itemsPerPage={table.itemsPerPage} onPageChange={table.setCurrentPage} onItemsPerPageChange={table.setItemsPerPage} />
          ) : undefined}
        />
      </ReportListToolbar>
    </div>
  );
};
