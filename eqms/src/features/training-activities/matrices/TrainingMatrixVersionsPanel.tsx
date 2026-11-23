import { useCallback, useMemo, useState } from "react";
import { usePersistedState } from "@/hooks/usePersistedState";
import { useNavigate } from "react-router-dom";
import { MoreVertical } from "lucide-react";
import { IconEye, IconGitCompare, IconInfoCircle } from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge/Badge";
import { FormModal } from "@/components/ui/modal/FormModal";
import { DataTable, useCustomColumnLayout, type DataTableColumn } from "@/components/ui/table/DataTable";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { PortalDropdownMenu, DropdownMenuItem } from "@/components/ui/dropdown";
import { usePortalDropdown } from "@/hooks/usePortalDropdown";
import { useTableDragScroll } from "@/hooks/useTableDragScroll";
import { useServerTable } from "@/features/settings/shared/hooks/useServerTable";
import { ReportListToolbar, type ReportSelectFilter } from "@/features/report/shared/ReportListToolbar";
import { trainingError, trainingMatrixApi, type TrainingMatrixRow, type TrainingMatrixVersionRef } from "@/services/api/trainingActivities";
import { day } from "../shared/trainingLabels";
import { tr, trFormat } from "@/i18n";

const STATUS_LABEL: Record<string, string> = { DRAFT: "Draft", PENDING_APPROVAL: "Pending Approval", EFFECTIVE: "Effective", OBSOLETED: "Obsoleted" };
const STATUS_OPTIONS = [{ label: "All", value: "" }, ...Object.entries(STATUS_LABEL).map(([value, label]) => ({ label, value }))];
const rowName = (r: TrainingMatrixRow) => (r.topicText ? r.topicText : `${r.documentNumber} — ${r.documentName}`);
type Diff = Awaited<ReturnType<typeof trainingMatrixApi.compare>>;

/**
 * The versions of one matrix, as a tab of the matrix page: which one is in use, which are history, and what changed between a version and the one before it.
 * Search, filter, sort and paging are done by the server.
 */
export function TrainingMatrixVersionsPanel({ matrixId, currentVersionId }: { matrixId: string; currentVersionId: string }) {
  const navigate = useNavigate();
  const drag = useTableDragScroll();
  const menu = usePortalDropdown();
  const [status, setStatus] = usePersistedState("training.matrixVersions.status", "");
  const [error, setError] = useState("");
  const [diff, setDiff] = useState<Diff>();

  const fetcher = useMemo(() => trainingMatrixApi.versions(matrixId), [matrixId]);
  const extraParams = useMemo(() => ({ status: status || undefined }), [status]);
  const table = useServerTable<TrainingMatrixVersionRef>({ persistKey: "training.matrixVersions", liveTypes: ["TRAINING"], fetcher, defaultSortBy: "versionNo", defaultSortDirection: "desc", extraParams, syncToUrl: false });
  const sorted = (key: string) => ({ direction: table.sortConfig.key === key ? table.sortConfig.direction : undefined, onSort: () => table.handleSort(key) });
  const open = (v: TrainingMatrixVersionRef) => navigate(`/training-management/matrix/${v.id}`);

  const compare = useCallback(async (v: TrainingMatrixVersionRef) => {
    try {
      if (v.previousId) setDiff(await trainingMatrixApi.compare(v.previousId, v.id));
    } catch (e) {
      setError(trainingError(e));
    }
  }, []);

  const columns: DataTableColumn<TrainingMatrixVersionRef>[] = [
    { id: "rowNo", header: "No.", locked: true, cell: (_r, i) => (table.currentPage - 1) * table.itemsPerPage + i + 1 },
    {
      id: "version", header: "Version", sort: sorted("versionNo"),
      cell: (v) => (
        <button type="button" className="font-medium text-emerald-600 hover:underline" onClick={() => open(v)}>
          {tr("Version")} {v.versionNo}{v.id === currentVersionId ? " (shown)" : ""}
        </button>
      ),
    },
    { id: "status", header: "Status", sort: sorted("status"), cell: (v) => <Badge color={v.status === "EFFECTIVE" ? "emerald" : v.status === "OBSOLETED" ? "slate" : "amber"}>{STATUS_LABEL[v.status]}</Badge> },
    { id: "reason", header: tr("What changed"), sort: sorted("changeReason"), cell: (v) => <div className="max-w-80 whitespace-normal">{v.changeReason || "—"}</div> },
    { id: "prepared", header: tr("Prepared by"), sort: sorted("preparedBy"), cell: (v) => v.preparedByName ?? "—" },
    { id: "approved", header: tr("Approved by"), sort: sorted("approvedBy"), cell: (v) => v.approvedByName ?? "—" },
    { id: "effective", header: "Effective", sort: sorted("effectiveAt"), cell: (v) => day(v.effectiveAt) },
  ];
  const action = {
    cell: (v: TrainingMatrixVersionRef) => (
      <button type="button" ref={menu.getRef(v.id)} aria-label={tr("More actions")} className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-200 md:h-8 md:w-8" onClick={(event) => menu.toggle(v.id, event)}>
        <MoreVertical className="h-4 w-4" />
      </button>
    ),
  };
  const { layout, control } = useCustomColumnLayout("training.matrix.versions", columns, action);
  const actionRow = table.items.find((row) => row.id === menu.openId);
  const filters: ReportSelectFilter[] = [{ id: "status", label: "Status", value: status, options: STATUS_OPTIONS, onChange: (v) => { setStatus(v); table.setCurrentPage(1); } }];

  return (
    <div className="space-y-4">
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <ReportListToolbar
        searchPlaceholder={tr("Search version, change or person…")} search={table.searchQuery}
        onSearch={(value) => { table.setSearchQuery(value); table.setCurrentPage(1); }}
        filters={filters} dates={[]} hasActiveFilters={Boolean(status || table.searchQuery)}
        onClear={() => { setStatus(""); table.setSearchQuery(""); table.setCurrentPage(1); }} customControl={control}
        framed={false} flush
      >
        <DataTable
          rows={table.items} getRowKey={(v) => v.id} isLoading={table.isLoading}
          emptyState={<TableEmptyState title={tr("No version found")} description={tr("Change the search or the filter.")} />}
          scrollerRef={drag.scrollerRef} scrollProps={drag.dragEvents} isDragging={drag.isDragging}
          columns={columns} columnLayout={layout} action={action}
          pagination={table.totalItems > 0 ? <TablePagination currentPage={table.currentPage} totalPages={table.totalPages} totalItems={table.totalItems} itemsPerPage={table.itemsPerPage} onPageChange={table.setCurrentPage} onItemsPerPageChange={table.setItemsPerPage} /> : undefined}
        />
      </ReportListToolbar>
      <PortalDropdownMenu isOpen={!!actionRow} onClose={menu.close} position={menu.position} minWidth={220}>
        {actionRow && (
          <div className="py-1">
            <DropdownMenuItem icon={<IconInfoCircle className="h-4 w-4" />} onClick={() => { open(actionRow); menu.close(); }}>{tr("View Details")}</DropdownMenuItem>
            {actionRow.previousId && ["EFFECTIVE", "OBSOLETED"].includes(actionRow.status) && (
              <DropdownMenuItem icon={<IconGitCompare className="h-4 w-4" />} onClick={() => { void compare(actionRow); menu.close(); }}>{tr("Compare With Previous")}</DropdownMenuItem>
            )}
          </div>
        )}
      </PortalDropdownMenu>
      {diff && <CompareModal diff={diff} onClose={() => setDiff(undefined)} />}
    </div>
  );
}

function CompareModal({ diff, onClose }: { diff: Diff; onClose: () => void }) {
  const names = new Map(diff.positions.map((p) => [p.id, p.name]));
  const list = (ids: string[]) => (ids.length ? ids.map((id) => names.get(id) ?? "?").join(", ") : "nobody");
  const none = <p className="text-slate-500">{tr("None.")}</p>;
  return (
    <FormModal isOpen onClose={onClose} title={`What Changed from Version ${diff.from} to Version ${diff.to}`} showCancel={false} confirmText="Close" onConfirm={onClose} size="xl">
      <div className="space-y-5 text-sm">
        <p className="flex flex-wrap gap-2">
          <Badge color="emerald">{diff.added.length} {tr("added")}</Badge><Badge color="red">{diff.removed.length} {tr("removed")}</Badge><Badge color="amber">{diff.changed.length} {tr("changed")}</Badge>
        </p>
        <section>
          <h4 className="font-semibold text-slate-900">{tr("Added in version")} {diff.to}</h4>
              <p className="mb-2 text-xs text-slate-500">{trFormat("Training Topics or documents that were not in version {version}. The Work Positions are the ones that must be trained.", { version: diff.from })}</p>
          {diff.added.length === 0 ? none : <ul className="space-y-2">{diff.added.map((r, i) => <li key={i} className="rounded-lg border border-slate-200 p-3"><div className="font-medium">{rowName(r)}</div><div className="text-xs text-slate-600">{trFormat("For: {positions}", { positions: list(r.positionIds) })}{r.annualRequired ? ` · ${tr("every year")}` : ""}</div></li>)}</ul>}
        </section>
        <section>
          <h4 className="font-semibold text-slate-900">{tr("Removed in version")} {diff.to}</h4>
              <p className="mb-2 text-xs text-slate-500">{trFormat("Training Topics or documents that were in version {version} and are no longer required.", { version: diff.from })}</p>
          {diff.removed.length === 0 ? none : <ul className="space-y-2">{diff.removed.map((r, i) => <li key={i} className="rounded-lg border border-slate-200 p-3"><div className="font-medium">{rowName(r)}</div><div className="text-xs text-slate-600">{trFormat("Was for: {positions}", { positions: list(r.positionIds) })}{r.annualRequired ? ` · ${tr("every year")}` : ""}</div></li>)}</ul>}
        </section>
        <section>
          <h4 className="font-semibold text-slate-900">{tr("Same Training Topic, different Work Positions or yearly rule")}</h4>
          <p className="mb-2 text-xs text-slate-500">{tr("The Training Topic or document is in both versions, but who must be trained, or the yearly repeat, is not the same.")}</p>
          {diff.changed.length === 0 ? none : (
            <ul className="space-y-2">
              {diff.changed.map((r, i) => (
                <li key={i} className="rounded-lg border border-slate-200 p-3">
                  <div className="font-medium">{rowName(r)}</div>
                  <div className="text-xs text-slate-600">{trFormat("Work Positions: {previous} → {next}", { previous: list(r.previousPositionIds), next: list(r.positionIds) })}</div>
                  {r.previousAnnualRequired !== r.annualRequired && <div className="text-xs text-slate-600">{trFormat("Every year: {previous} → {next}", { previous: r.previousAnnualRequired ? tr("yes") : tr("no"), next: r.annualRequired ? tr("yes") : tr("no") })}</div>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </FormModal>
  );
}
