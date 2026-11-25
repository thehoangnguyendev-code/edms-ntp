import { tr } from "@/i18n";
import { useEffect, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ROUTES } from "@/app/routes.constants";
import { Badge } from "@/components/ui/badge/Badge";
import { flagColor } from "@/utils/status";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { MoreVertical } from "lucide-react";
import { IconArrowUpRight, IconChecks, IconInfoCircle, IconPencilMinus } from "@tabler/icons-react";
import { PortalDropdownMenu, DropdownMenuItem } from "@/components/ui/dropdown";
import { usePortalDropdown } from "@/hooks/usePortalDropdown";
import { DataTable, useCustomColumnLayout, type DataTableAction, type DataTableColumn } from "@/components/ui/table/DataTable";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { Button } from "@/components/ui/button/Button";
import { useTableDragScroll } from "@/hooks/useTableDragScroll";
import { SEARCH_DEBOUNCE_MS } from "@/constants/search";
import { reportTemplatesApi, reportError, type ReportSource, type ReportRevisionListPage, type ReportRevisionListRow } from "@/services/api/reportTemplates";
import { ReportListToolbar, pickerDateToIso } from "../shared/ReportListToolbar";
import { reportBreadcrumbs } from "../shared/reportBreadcrumbs";
import { comingFrom, reportRevisionParent } from "../shared/reportRevisionParent";
import { reportRevisionLabel } from "../shared/reportLabels";
import { REVISION_STATUS, whenText } from "./ReportTemplateRevisions";
import { reportRevisionRowActions, type ReportRevisionRowAction } from "./reportRevisionRowActions";

const defaults = { status: "", gmp: "", sourceCode: "" };
type Filters = typeof defaults;

/**
 * The revisions of every report template in one list, the way Document Control lists document revisions (REPORT-TEMPLATE-REVISIONS-LIST-2026-11-15).
 * `pendingApproval`: the revisions waiting for approval that the person may decide (they hold the approval permission and did not write or submit them).
 * Search, filters, sort and paging are applied by the server. The column GMP says whether the template was used for GMP decisions in that revision.
 */
export function ReportTemplateRevisionsView({ pendingApproval = false }: { pendingApproval?: boolean }) {
  const navigate = useNavigate();
  const location = useLocation();
  const drag = useTableDragScroll();
  const { openId, position, getRef, toggle, close } = usePortalDropdown();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [filters, setFilters] = useState<Filters>(defaults);
  const [updated, setUpdated] = useState({ from: "", to: "" });
  const [sort, setSort] = useState<{ field: string; direction: "asc" | "desc" }>({ field: "lastChangedAt", direction: "desc" });
  const [result, setResult] = useState<ReportRevisionListPage>();
  const [sources, setSources] = useState<ReportSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let alive = true;
    reportTemplatesApi.sources().then((value) => alive && setSources(value)).catch(() => alive && setSources([]));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    const timer = window.setTimeout(() => {
      reportTemplatesApi
        .allRevisions({
          scope: pendingApproval ? "pending-approval" : "all",
          status: filters.status || undefined,
          gmp: filters.gmp || undefined,
          sourceCode: filters.sourceCode || undefined,
          search: search.trim() || undefined,
          updatedFrom: pickerDateToIso(updated.from) || undefined,
          updatedTo: pickerDateToIso(updated.to) || undefined,
          sortBy: sort.field,
          sortDirection: sort.direction,
          page,
          limit: pageSize,
        })
        .then((value) => alive && setResult(value))
        .catch((e) => {
          if (alive) {
            setResult(undefined);
            setError(reportError(e));
          }
        })
        .finally(() => alive && setLoading(false));
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [pendingApproval, filters, updated, search, sort, page, pageSize, refresh]);

  const apply = (next: Filters) => {
    setPage(1);
    setFilters(next);
  };
  const sortOf = (field: string) => ({
    direction: sort.field === field ? sort.direction : undefined,
    onSort: () => {
      setPage(1);
      setSort({ field, direction: sort.field === field && sort.direction === "asc" ? "desc" : "asc" });
    },
  });
  // The decision (Approve, Reject) is made on the page of the template; from Pending My Approval the revision opens there, from All Revisions on its own page.
  const open = (row: ReportRevisionListRow) =>
    navigate(
      pendingApproval
        ? `${ROUTES.REPORT.TEMPLATE_MANAGEMENT}/${encodeURIComponent(row.definitionCode)}`
        : `${ROUTES.REPORT.TEMPLATE_MANAGEMENT}/${encodeURIComponent(row.definitionCode)}/revisions/${row.revision}`,
      comingFrom(location.pathname),
    );

  const rowKey = (row: ReportRevisionListRow) => `${row.definitionCode}-${row.revision}`;
  const openRow = openId ? result?.data?.find((row) => rowKey(row) === openId) : undefined;
  const templatePath = (row: ReportRevisionListRow) => `${ROUTES.REPORT.TEMPLATE_MANAGEMENT}/${encodeURIComponent(row.definitionCode)}`;
  /** Where each entry of the row menu leads: the page where the work is done. */
  const goTo = (action: ReportRevisionRowAction, row: ReportRevisionListRow) => {
    if (action === "view") navigate(`${templatePath(row)}/revisions/${row.revision}`, comingFrom(location.pathname));
    else if (action === "edit" || action === "approve") navigate(templatePath(row), comingFrom(location.pathname));
    else navigate(`${templatePath(row)}/details?action=upgrade`);
  };
  const ROW_MENU: Record<ReportRevisionRowAction, { icon: ReactNode; label: string }> = {
    view: { icon: <IconInfoCircle className="h-4 w-4" />, label: tr("View Details") },
    edit: { icon: <IconPencilMinus className="h-4 w-4" />, label: tr("Edit Revision") },
    approve: { icon: <IconChecks className="h-4 w-4" />, label: tr("Approve Revision") },
    upgrade: { icon: <IconArrowUpRight className="h-4 w-4" />, label: tr("Upgrade Report Template") },
  };
  const rowAction: DataTableAction<ReportRevisionListRow> = {
    cell: (row) => (
      <button
        ref={getRef(rowKey(row))}
        onClick={(event) => {
          event.stopPropagation();
          toggle(rowKey(row), event);
        }}
        className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-200 md:h-8 md:w-8"
        aria-label={tr("More actions")}
      >
        <MoreVertical className="h-3.5 w-3.5 md:h-4 md:w-4" />
      </button>
    ),
  };

  const columns: DataTableColumn<ReportRevisionListRow>[] = [
    { id: "no", header: "No.", cell: (_row, index) => (page - 1) * pageSize + index + 1 },
    {
      id: "templateNumber",
      header: tr("Report Template Number"),
      sort: sortOf("templateNumber"),
      cell: (row) => (
        <button
          type="button"
          className="whitespace-nowrap text-left font-medium text-emerald-600 hover:text-emerald-700 hover:underline"
          onClick={() => navigate(`${ROUTES.REPORT.TEMPLATE_MANAGEMENT}/${encodeURIComponent(row.definitionCode)}/details`)}
        >
          {row.definitionCode}
        </button>
      ),
    },
    {
      id: "templateName",
      header: tr("Report Template Name"),
      sort: sortOf("templateName"),
      cell: (row) => <div className="min-w-48 whitespace-normal">{row.displayName}</div>,
    },
    {
      id: "revision",
      header: tr("Report Template Revision"),
      sort: sortOf("revision"),
      cell: (row) => (
        <button type="button" className="whitespace-nowrap font-medium text-emerald-600 hover:text-emerald-700 hover:underline" onClick={() => open(row)}>
          {reportRevisionLabel(row.revision, row.status)}
        </button>
      ),
    },
    {
      id: "status",
      header: "Status",
      sort: sortOf("status"),
      cell: (row) => (
        <Badge color={REVISION_STATUS[row.status]?.color ?? "slate"} size="sm">
          {REVISION_STATUS[row.status]?.label ?? row.status}
        </Badge>
      ),
    },
    {
      id: "gmp",
      header: tr("Used for GMP Decisions"),
      sort: sortOf("gmpUse"),
      cell: (row) => (
        <Badge color={flagColor(row.gmpUse)} size="sm">
          {row.gmpUse ? "GMP" : "Not GMP"}
        </Badge>
      ),
    },
    {
      id: "source",
      header: tr("Report Type"),
      cell: (row) => sources.find((source) => source.code === row.sourceCode)?.name ?? row.sourceCode,
    },
    {
      id: "approval",
      header: "Approval",
      cell: (row) =>
        row.approvalBasis === "NOT_REQUIRED" ? (
          <span className="whitespace-nowrap">{tr("Not required")}</span>
        ) : row.approvedByName ? (
          <span className="whitespace-nowrap">{row.approvedByName}</span>
        ) : (
          "—"
        ),
    },
    { id: "createdBy", header: tr("Created By"), cell: (row) => row.createdByName ?? "—" },
    {
      id: "lastChanged",
      header: tr("Last Updated"),
      sort: sortOf("lastChangedAt"),
      cell: (row) => <span className="whitespace-nowrap">{whenText(row.lastChangedAt)}</span>,
    },
    {
      id: "effectiveAt",
      header: tr("In Force Since"),
      sort: sortOf("effectiveAt"),
      cell: (row) => <span className="whitespace-nowrap">{whenText(row.effectiveAt)}</span>,
    },
  ];
  const { layout, control } = useCustomColumnLayout(pendingApproval ? "reportRevisionsPending" : "reportRevisions", columns, rowAction);
  const title = pendingApproval ? tr("Pending My Approval") : tr("All Revisions");

  const statusOptions = pendingApproval
    ? [{ label: tr("Pending Approval"), value: "PENDING_APPROVAL" }]
    : [
        { label: "All", value: "" },
        ...(Object.keys(REVISION_STATUS) as Array<keyof typeof REVISION_STATUS>).map((value) => ({ label: REVISION_STATUS[value].label, value })),
      ];

  return (
    <div className="flex h-full w-full min-w-0 flex-1 flex-col gap-4 md:gap-6">
      <PageHeader title={title} breadcrumbItems={reportBreadcrumbs(navigate, title)} />
      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
          <Button variant="ghost" size="sm" onClick={() => setRefresh((value) => value + 1)}>
            Retry
          </Button>
        </div>
      )}
      <ReportListToolbar
        searchPlaceholder="Search by template, revision or person..."
        search={search}
        onSearch={(value) => {
          setSearch(value);
          setPage(1);
        }}
        filters={[
          ...(pendingApproval ? [] : [{ id: "status", label: "Status", value: filters.status, options: statusOptions, onChange: (value: string) => apply({ ...filters, status: value }) }]),
          {
            id: "gmp",
            label: tr("Used for GMP Decisions"),
            value: filters.gmp,
            options: [
              { label: "All", value: "" },
              { label: "Yes", value: "YES" },
              { label: "No", value: "NO" },
            ],
            onChange: (value: string) => apply({ ...filters, gmp: value }),
          },
          {
            id: "sourceCode",
            label: tr("Report Type"),
            value: filters.sourceCode,
            options: [{ label: "All", value: "" }, ...sources.map((source) => ({ label: source.name, value: source.code }))],
            onChange: (value: string) => apply({ ...filters, sourceCode: value }),
          },
        ]}
        dates={[
          {
            id: "updated",
            label: tr("Last Updated Range"),
            from: updated.from,
            to: updated.to,
            onChange: (from, to) => {
              setPage(1);
              setUpdated({ from, to });
            },
          },
        ]}
        hasActiveFilters={Boolean(search || updated.from || updated.to || filters.status || filters.gmp || filters.sourceCode)}
        onClear={() => {
          setSearch("");
          setUpdated({ from: "", to: "" });
          apply(defaults);
        }}
        customControl={control}
      >
        <div className="relative flex flex-1 flex-col">
          <DataTable
            rows={result?.data ?? []}
            columns={columns}
            getRowKey={rowKey}
            action={rowAction}
            isLoading={loading}
            loadingContent={<SectionLoading text="Loading report template revisions..." />}
            emptyState={
              <TableEmptyState
                title={error ? tr("Unable to load revisions") : pendingApproval ? tr("Nothing Is Waiting For Your Approval") : tr("No Revisions Found")}
                description={error || (pendingApproval ? tr("No revision is waiting for an approval you may give.") : tr("No revision matches these filters."))}
              />
            }
            scrollerRef={drag.scrollerRef}
            scrollProps={drag.dragEvents}
            isDragging={drag.isDragging}
            columnLayout={layout}
            pagination={
              result && (
                <TablePagination
                  currentPage={page}
                  totalPages={result.pagination.totalPages}
                  totalItems={result.pagination.total}
                  itemsPerPage={pageSize}
                  onPageChange={setPage}
                  onItemsPerPageChange={(size) => {
                    setPage(1);
                    setPageSize(size);
                  }}
                />
              )
            }
          />
        </div>
      </ReportListToolbar>
      {openRow && (
        <PortalDropdownMenu isOpen={openId !== null} onClose={close} position={position} minWidth={200}>
          <div className="py-1">
            {reportRevisionRowActions(openRow).map((action) => (
              <DropdownMenuItem
                key={action}
                icon={ROW_MENU[action].icon}
                onClick={() => {
                  goTo(action, openRow);
                  close();
                }}
              >
                {ROW_MENU[action].label}
              </DropdownMenuItem>
            ))}
          </div>
        </PortalDropdownMenu>
      )}
    </div>
  );
}
