import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MoreVertical } from "lucide-react";
import { IconBinoculars, IconCopy, IconEye, IconPencil, IconPencilMinus, IconPlus, IconTrash, IconToggleRight } from "@tabler/icons-react";
import { Button } from "@/components/ui/button/Button";
import { Badge } from "@/components/ui/badge/Badge";
import { flagColor } from "@/utils/status";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { AlertModal } from "@/components/ui/modal/AlertModal";
import { WarningBanner } from "@/components/ui/banner/WarningBanner";
import { useToast } from "@/components/ui/toast/Toast";
import { DataTable, useCustomColumnLayout, type DataTableColumn } from "@/components/ui/table/DataTable";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { PortalDropdownMenu, DropdownMenuItem } from "@/components/ui/dropdown";
import { usePortalDropdown } from "@/hooks/usePortalDropdown";
import { useTableDragScroll } from "@/hooks/useTableDragScroll";
import { usePermissions } from "@/hooks/usePermissions";
import { useServerTable } from "@/features/settings/shared/hooks/useServerTable";
import { ReportListToolbar, pickerDateToIso, type ReportDateFilter, type ReportSelectFilter } from "../shared/ReportListToolbar";
import { reportBreadcrumbs } from "../shared/reportBreadcrumbs";
import { reportAppearanceApi, type ReportAppearanceRow } from "@/services/api/reportAppearance";
import { reportError } from "@/services/api/reportTemplates";
import { displayDateTime } from "@/utils/format";
import { REPORT_FONTS } from "./ReportTextStyleFields";
import { ReportAppearancePreview } from "./ReportAppearancePreview";

const ANY = { label: "All", value: "" };
const ON_OFF = [ANY, { label: "On", value: "ON" }, { label: "Off", value: "OFF" }];
const FONT_LABEL = Object.fromEntries(REPORT_FONTS.map((font) => [font.value, font.label]));

/**
 * The appearances of the reports, as a list (REPORT-APPEARANCE-LIST-2026-11-15): many can be made, exactly one is Active, and activating another makes the present one Inactive.
 * Search, filters, sort and paging are all done by the server; this screen only sends what the person typed and chose. A row can be looked at in full (every page, in the PDF
 * viewer), edited, copied, activated or deleted; Create Appearance opens the screen of a new one.
 */
export function ReportAppearanceListView() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { hasAnyPermission } = usePermissions();
  const canManage = hasAnyPermission(["reports.appearance.manage"]);
  const menu = usePortalDropdown();
  const drag = useTableDragScroll();
  const [filter, setFilter] = useState({ status: "", orientation: "", font: "", cover: "", logo: "" });
  const [changed, setChanged] = useState({ from: "", to: "" });
  const [activated, setActivated] = useState({ from: "", to: "" });
  const [error, setError] = useState("");
  const [previewing, setPreviewing] = useState<ReportAppearanceRow | null>(null);
  const [activating, setActivating] = useState<ReportAppearanceRow | null>(null);
  const [deleting, setDeleting] = useState<ReportAppearanceRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [modalError, setModalError] = useState("");

  const fetcher = useCallback(
    (params: Record<string, string | number | boolean | undefined>) =>
      reportAppearanceApi
        .list({
          search: params.search as string | undefined,
          status: (params.status as string) || undefined,
          orientation: (params.orientation as string) || undefined,
          font: (params.font as string) || undefined,
          cover: (params.cover as string) || undefined,
          logo: (params.logo as string) || undefined,
          changedFrom: (params.changedFrom as string) || undefined,
          changedTo: (params.changedTo as string) || undefined,
          activatedFrom: (params.activatedFrom as string) || undefined,
          activatedTo: (params.activatedTo as string) || undefined,
          sort: params.sortBy as "name" | "status" | "updatedAt" | "activatedAt",
          direction: params.sortDirection as "asc" | "desc",
          page: params.page as number,
          limit: params.limit as number,
        })
        .catch((failure) => {
          setError(reportError(failure));
          throw failure;
        }),
    [],
  );
  const extraParams = useMemo(
    () => ({ ...filter, changedFrom: pickerDateToIso(changed.from), changedTo: pickerDateToIso(changed.to), activatedFrom: pickerDateToIso(activated.from), activatedTo: pickerDateToIso(activated.to) }),
    [filter, changed, activated],
  );
  const table = useServerTable<ReportAppearanceRow>({ fetcher, defaultSortBy: "status", defaultSortDirection: "desc", extraParams, initialItemsPerPage: 10, liveTypes: ["REPORT_APPEARANCE"] });
  const actionRow = table.items.find((row) => row.id === menu.openId);

  const run = async (work: () => Promise<unknown>, done: string, close: () => void) => {
    setBusy(true);
    setModalError("");
    try {
      await work();
      close();
      showToast({ type: "success", title: done, message: "" });
      table.reload();
    } catch (failure) {
      setModalError(reportError(failure));
    } finally {
      setBusy(false);
    }
  };

  const sortOf = (key: string) => ({ direction: table.sortConfig.key === key ? table.sortConfig.direction : undefined, onSort: () => table.handleSort(key) });
  const columns: DataTableColumn<ReportAppearanceRow>[] = [
    { id: "no", header: "No.", label: "No.", locked: true, cell: (_row, index) => (table.currentPage - 1) * table.itemsPerPage + index + 1 },
    {
      id: "name",
      header: "Appearance Name",
      label: "Appearance Name",
      sort: sortOf("name"),
      cell: (row) => (
        <button type="button" className="text-left font-medium text-emerald-600 hover:underline" onClick={() => navigate(`/settings/report-appearance/${row.id}`)}>
          {row.name}
        </button>
      ),
    },
    { id: "status", header: "Appearance Status", label: "Appearance Status", sort: sortOf("status"), cell: (row) => <Badge color={flagColor(row.status === "ACTIVE")}>{row.status === "ACTIVE" ? "Active" : "Inactive"}</Badge> },
    { id: "paper", header: "Paper", label: "Paper", cell: (row) => (row.orientation === "PORTRAIT" ? "Portrait" : "Landscape") },
    { id: "font", header: "Font", label: "Font", cell: (row) => FONT_LABEL[row.fontFamily ?? "NOTO_SANS"] ?? row.fontFamily },
    { id: "cover", header: "Cover page", label: "Cover page", cell: (row) => (row.cover ? "On" : "Off") },
    { id: "logo", header: "Logo", label: "Logo", cell: (row) => (row.logo ? "On" : "Off") },
    { id: "updated", header: "Last Updated", label: "Last Updated", sort: sortOf("updatedAt"), cell: (row) => displayDateTime(row.updatedAt) },
    { id: "updatedBy", header: "Last Updated By", label: "Last Updated By", cell: (row) => row.updatedByName ?? "—" },
    { id: "activated", header: "Activated At", label: "Activated At", sort: sortOf("activatedAt"), cell: (row) => (row.activatedAt ? displayDateTime(row.activatedAt) : "—") },
  ];
  const action = {
    cell: (row: ReportAppearanceRow) => (
      <button
        type="button"
        ref={menu.getRef(row.id)}
        aria-label="More actions"
        className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-200 md:h-8 md:w-8"
        onClick={(event) => menu.toggle(row.id, event)}
      >
        <MoreVertical className="h-4 w-4" />
      </button>
    ),
  };
  const { layout, control } = useCustomColumnLayout("reportAppearances", columns, action);

  const choose = (key: keyof typeof filter) => (value: string) => {
    setFilter((previous) => ({ ...previous, [key]: value }));
    table.setCurrentPage(1);
  };
  const filters: ReportSelectFilter[] = [
    { id: "status", label: "Appearance Status", value: filter.status, options: [ANY, { label: "Active", value: "ACTIVE" }, { label: "Inactive", value: "INACTIVE" }], onChange: choose("status") },
    { id: "orientation", label: "Paper", value: filter.orientation, options: [ANY, { label: "Landscape", value: "LANDSCAPE" }, { label: "Portrait", value: "PORTRAIT" }], onChange: choose("orientation") },
    { id: "font", label: "Font", value: filter.font, options: [ANY, ...REPORT_FONTS.map((font) => ({ label: font.label, value: font.value }))], onChange: choose("font") },
    { id: "cover", label: "Cover page", value: filter.cover, options: ON_OFF, onChange: choose("cover") },
    { id: "logo", label: "Logo", value: filter.logo, options: ON_OFF, onChange: choose("logo") },
  ];
  const dates: ReportDateFilter[] = [
    { id: "changed", label: "Last Updated", from: changed.from, to: changed.to, onChange: (from, to) => { setChanged({ from, to }); table.setCurrentPage(1); } },
    { id: "activated", label: "Activated At", from: activated.from, to: activated.to, onChange: (from, to) => { setActivated({ from, to }); table.setCurrentPage(1); } },
  ];
  const hasActiveFilters = Object.values(filter).some(Boolean) || Boolean(changed.from || changed.to || activated.from || activated.to);

  const title = "Report Appearance";
  return (
    <div className="flex h-full w-full min-w-0 flex-1 flex-col gap-4 md:gap-6">
      <PageHeader
        title={title}
        breadcrumbItems={reportBreadcrumbs(navigate, title, true)}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {canManage && (
              <Button size="sm" variant="default" onClick={() => navigate("/settings/report-appearance/new")}>
                <IconPlus className="mr-2 h-4 w-4" />
                Create Appearance
              </Button>
            )}
          </div>
        }
      />
      {error && <WarningBanner variant="error" description={error} />}
      <ReportListToolbar
        searchPlaceholder="Search by name…"
        search={table.searchQuery}
        onSearch={(value) => {
          table.setSearchQuery(value);
          table.setCurrentPage(1);
        }}
        filters={filters}
        dates={dates}
        hasActiveFilters={hasActiveFilters}
        onClear={() => {
          setFilter({ status: "", orientation: "", font: "", cover: "", logo: "" });
          setChanged({ from: "", to: "" });
          setActivated({ from: "", to: "" });
          table.setCurrentPage(1);
        }}
        customControl={control}
      >
        <DataTable
          rows={table.items}
          getRowKey={(row) => row.id}
          isLoading={table.isLoading}
          emptyState={<TableEmptyState title="No Appearances Found" description="Create an appearance, or change your search or filters." />}
          scrollerRef={drag.scrollerRef}
          scrollProps={drag.dragEvents}
          isDragging={drag.isDragging}
          columns={columns}
          columnLayout={layout}
          action={action}
          pagination={
            table.totalItems > 0 ? (
              <TablePagination currentPage={table.currentPage} totalPages={table.totalPages} totalItems={table.totalItems} itemsPerPage={table.itemsPerPage} onPageChange={table.setCurrentPage} onItemsPerPageChange={table.setItemsPerPage} />
            ) : undefined
          }
        />
      </ReportListToolbar>

      <PortalDropdownMenu isOpen={!!actionRow} onClose={menu.close} position={menu.position} minWidth={220}>
        {actionRow && (
          <div className="py-1">
            <DropdownMenuItem icon={<IconBinoculars className="h-4 w-4" />} onClick={() => { setPreviewing(actionRow); menu.close(); }}>
              Preview Report Appearance
            </DropdownMenuItem>
            <DropdownMenuItem icon={<IconPencilMinus className="h-4 w-4" />} onClick={() => { navigate(`/settings/report-appearance/${actionRow.id}`); menu.close(); }}>
              {canManage ? "Edit" : "View Detail"}
            </DropdownMenuItem>
            {canManage && (
              <>
                <DropdownMenuItem icon={<IconCopy className="h-4 w-4" />} onClick={() => { navigate(`/settings/report-appearance/new?copyFrom=${actionRow.id}`); menu.close(); }}>
                  Duplicate
                </DropdownMenuItem>
                <DropdownMenuItem icon={<IconToggleRight className="h-4 w-4" />} disabled={actionRow.status === "ACTIVE"} onClick={() => { setModalError(""); setActivating(actionRow); menu.close(); }}>
                  Activate
                </DropdownMenuItem>
                <DropdownMenuItem icon={<IconTrash className="h-4 w-4" />} disabled={actionRow.status === "ACTIVE"} onClick={() => { setModalError(""); setDeleting(actionRow); menu.close(); }}>
                  Delete
                </DropdownMenuItem>
              </>
            )}
          </div>
        )}
      </PortalDropdownMenu>

      {previewing && <ReportAppearancePreview id={previewing.id} name={previewing.name} onClose={() => setPreviewing(null)} />}

      <AlertModal
        isOpen={!!activating}
        onClose={() => setActivating(null)}
        onConfirm={() => activating && run(() => reportAppearanceApi.activate(activating.id), "Appearance activated", () => setActivating(null))}
        type="confirm"
        title="Activate this appearance?"
        description={
          <div className="space-y-2 text-sm text-slate-600">
            <p>
              <strong>{activating?.name}</strong> becomes the Active appearance: every new report is drawn with it. The appearance that is Active now becomes Inactive. Reports that are already made are not changed.
            </p>
            <p>This is recorded in the Audit Trail.</p>
            {modalError && <WarningBanner variant="error" description={modalError} />}
          </div>
        }
        confirmText="Activate"
        cancelText="Cancel"
        isLoading={busy}
      />

      <AlertModal
        isOpen={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && run(() => reportAppearanceApi.remove(deleting.id), "Appearance deleted", () => setDeleting(null))}
        type="confirm"
        title="Delete this appearance?"
        description={
          <div className="space-y-2 text-sm text-slate-600">
            <p>
              <strong>{deleting?.name}</strong> will be deleted. This cannot be undone, and it is recorded in the Audit Trail.
            </p>
            {modalError && <WarningBanner variant="error" description={modalError} />}
          </div>
        }
        confirmText="Delete"
        cancelText="Cancel"
        isLoading={busy}
      />
    </div>
  );
}
