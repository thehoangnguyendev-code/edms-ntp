import { useCallback, useRef } from "react";
import { Badge } from "@/components/ui/badge/Badge";
import { Button } from "@/components/ui/button/Button";
import { Checkbox } from "@/components/ui/checkbox/Checkbox";
import { DataTable, type DataTableColumn } from "@/components/ui/table/DataTable";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { FilterSearchInput } from "@/components/ui/filter/FilterSearchInput";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { useTableDragScroll } from "@/hooks/useTableDragScroll";
import { useServerTable } from "@/features/settings/shared/hooks/useServerTable";
import { trainingFollowUpApi, type TrainingImpactPosition } from "@/services/api/trainingActivities";

/**
 * The Work Positions of the department that the assessment of a document can name, as a table: a search box above (name or code), sortable headers, paging and drag-to-scroll, all
 * answered by the server. The choice is kept across pages and searches: only the ids are held here, and the header box selects or clears the rows shown.
 */
export function ImpactPositionsTable({ activityId, selected, onChange }: { activityId: string; selected: string[]; onChange: (ids: string[]) => void }) {
  const drag = useTableDragScroll();
  const fetcher = useCallback((params: Record<string, string | number | boolean | undefined>) => trainingFollowUpApi.impactPositions(activityId, params), [activityId]);
  const table = useServerTable<TrainingImpactPosition>({ fetcher, defaultSortBy: "name", initialItemsPerPage: 5, syncToUrl: false });
  // Only the very first load shows the loading block; after that the rows stay (dimmed) while the next page, search or sort is fetched, so the modal does not jump.
  const loadedOnce = useRef(false);
  if (!table.isLoading) loadedOnce.current = true;
  const refreshing = table.isLoading && loadedOnce.current;
  const sorted = (key: string) => ({ direction: table.sortConfig.key === key ? table.sortConfig.direction : undefined, onSort: () => table.handleSort(key) });
  const chosen = new Set(selected);
  const shown = table.items.map((p) => p.id);
  const allShown = shown.length > 0 && shown.every((id) => chosen.has(id));
  const toggle = (id: string, on: boolean) => onChange(on ? [...selected, id] : selected.filter((x) => x !== id));
  const toggleShown = () => onChange(allShown ? selected.filter((id) => !shown.includes(id)) : [...selected, ...shown.filter((id) => !chosen.has(id))]);

  const columns: DataTableColumn<TrainingImpactPosition>[] = [
    { id: "rowNo", header: "No.", locked: true, cell: (_p, i) => (table.currentPage - 1) * table.itemsPerPage + i + 1 },
    { id: "name", header: "Work Position", sort: sorted("name"), cell: (p) => <span className="font-medium text-slate-900">{p.name}</span> },
    { id: "code", header: "Code", sort: sorted("code"), cell: (p) => p.code || "—" },
    { id: "inMatrix", header: "In The Matrix", sort: sorted("inMatrix"), cell: (p) => (p.inMatrix ? <Badge color="emerald">Yes</Badge> : <Badge color="slate">No</Badge>) },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-56 flex-1">
          <FilterSearchInput aria-label="Search Work Positions" value={table.searchQuery} onChange={(value) => { table.setSearchQuery(value); table.setCurrentPage(1); }} placeholder="Search name or code…" />
        </div>
        <span className="text-xs text-slate-600" role="status">{selected.length} selected</span>
        {selected.length > 0 && <Button size="sm" variant="outline-emerald" onClick={() => onChange([])}>Clear Selection</Button>}
      </div>
      <div className={refreshing ? "pointer-events-none opacity-60 transition-opacity" : "transition-opacity"} aria-busy={refreshing}>
      <DataTable
        rows={table.items} getRowKey={(p) => p.id} isLoading={table.isLoading && !refreshing} loadingContent={<SectionLoading text="Loading Work Positions…" />}
        columns={columns}
        selection={{
          visible: true,
          header: <Checkbox checked={allShown} onChange={toggleShown} aria-label="Select the Work Positions shown" />,
          cell: (p) => <Checkbox checked={chosen.has(p.id)} onChange={(on) => toggle(p.id, Boolean(on))} aria-label={`Select ${p.name}`} />,
        }}
        emptyState={<TableEmptyState title={table.searchQuery ? "No Work Position matches" : "No Work Position"} description={table.searchQuery ? "Change the search." : "The department has no Work Position."} />}
        scrollerRef={drag.scrollerRef} scrollProps={drag.dragEvents} isDragging={drag.isDragging}
        pagination={table.totalItems > 0 ? <TablePagination currentPage={table.currentPage} totalPages={table.totalPages} totalItems={table.totalItems} itemsPerPage={table.itemsPerPage} itemsPerPageOptions={[5]} onPageChange={table.setCurrentPage} onItemsPerPageChange={table.setItemsPerPage} /> : undefined}
      />
      </div>
    </div>
  );
}
