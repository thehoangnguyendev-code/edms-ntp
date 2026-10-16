import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Eye,
  Pencil,
  Trash2,
  Plus,
  Settings2,
  FilePlus2,
  MoreVertical,
} from "lucide-react";
import { IconFileSettings, IconFilter2, IconInfoCircle, IconPencilMinus } from "@tabler/icons-react";
import { Button } from "@/components/ui/button/Button";
import { Badge } from "@/components/ui/badge/Badge";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { type SelectOption } from "@/components/ui/select/Select";
import { ReportListToolbar } from "../shared/ReportListToolbar";
import { humanize } from "../shared/reportLabels";
import { Textarea } from "@/components/ui/form/ResponsiveForm";
import { FormModal } from "@/components/ui/modal/FormModal";
import { PortalDropdownMenu, DropdownMenuItem } from "@/components/ui/dropdown";
import { DataTable, useCustomColumnLayout, type DataTableAction, type DataTableColumn } from "@/components/ui/table/DataTable";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { useTableDragScroll } from "@/hooks/useTableDragScroll";
import { usePortalDropdown } from "@/hooks/usePortalDropdown";
import { usePermissions } from "@/hooks/usePermissions";
import {
  reportTemplatesApi,
  reportError,
  type ReportTemplate,
  type ReportTemplateCapabilities,
  type TemplatePage,
} from "@/services/api/reportTemplates";
import { reportBreadcrumbs } from "../shared/reportBreadcrumbs";

const LIFECYCLE_TEXT: Record<string, string> = { ACTIVE: "Active", INACTIVE: "Disabled", DRAFT: "Draft", PENDING_APPROVAL: "Pending Approval" };
const defaults = { status: "", sourceCode: "", format: "", orientation: "" };
type Filters = typeof defaults;
const date = (value?: string) =>
  value ? new Date(value).toLocaleString() : "—";

export function ReportTemplateCatalog({ inAdministration = false }: { inAdministration?: boolean }) {
  const navigate = useNavigate();
  const { hasAnyPermission } = usePermissions();
  // Authoring a new template is a permission of the person; what may be done to a given template comes from the server (see the row menu).
  const canManage = hasAnyPermission([
    "reports.definition.manage",
    "settings.configuration.manage",
  ]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [filters, setFilters] = useState<Filters>(defaults);
  const [mobileDraft, setMobileDraft] = useState<Filters>(defaults);
  const [filterOpen, setFilterOpen] = useState(false);
  const [sort, setSort] = useState({
    field: "displayName",
    direction: "asc" as "asc" | "desc",
  });
  const [result, setResult] = useState<TemplatePage>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [deleting, setDeleting] = useState<ReportTemplate>();
  const [reason, setReason] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [saving, setSaving] = useState(false);
  const drag = useTableDragScroll();
  const { openId, position, getRef, toggle, close } = usePortalDropdown();
  const openTemplate = useMemo(
    () =>
      openId ? result?.data?.find((item) => item.code === openId) : undefined,
    [openId, result?.data],
  );
  // The actions of the row menu come from the server's decision for the template that was opened.
  const [rowCaps, setRowCaps] = useState<ReportTemplateCapabilities>();
  const openCode = openTemplate?.code;
  useEffect(() => {
    setRowCaps(undefined);
    if (!openCode) return;
    let alive = true;
    reportTemplatesApi
      .capabilities(openCode)
      .then((value) => alive && setRowCaps(value))
      .catch(() => alive && setRowCaps(undefined));
    return () => {
      alive = false;
    };
  }, [openCode]);
  const rowCan = (action: string) => rowCaps?.actions?.[action]?.allowed === true;
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    () => new Set(["status", "sourceCode", "format", "orientation"]),
  );
  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  };
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    const timer = window.setTimeout(() => {
      reportTemplatesApi
        .list(
          {
            search,
            page,
            limit: pageSize,
            sortBy: sort.field,
            direction: sort.direction,
            status: filters.status || undefined,
            sourceCode: filters.sourceCode || undefined,
            format: filters.format || undefined,
            orientation: filters.orientation || undefined,
          },
          inAdministration,
        )
        .then((data) => {
          if (alive) setResult(data);
        })
        .catch((error) => {
          if (alive) {
            setResult(undefined);
            setError(reportError(error));
          }
        })
        .finally(() => {
          if (alive) setLoading(false);
        });
    }, 250);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [search, page, pageSize, sort.field, sort.direction, filters, inAdministration, refresh]);
  const apply = (next: Filters) => {
    setPage(1);
    setFilters(next);
  };
  const sortable = (field: string) => ({
    direction: sort.field === field ? sort.direction : undefined,
    onSort: () => {
      setPage(1);
      setSort({
        field,
        direction:
          sort.field === field && sort.direction === "asc" ? "desc" : "asc",
      });
    },
  });
  const groups: Array<{
    id: keyof Filters;
    label: string;
    options: SelectOption[];
  }> = [
    {
      id: "status",
      label: "Status",
      options: [
        { value: "", label: "All" },
        { value: "ACTIVE", label: "Active" },
        ...(inAdministration
          ? [
              { value: "DISABLED", label: "Disabled" },
              { value: "DRAFT", label: "Draft" },
              { value: "PENDING_APPROVAL", label: "Pending Approval" },
            ]
          : []),
      ],
    },
    {
      id: "sourceCode",
      label: "Data Source",
      options: [{ value: "", label: "All" }, ...(result?.sources ?? [])],
    },
    {
      id: "format",
      label: "Output Format",
      options: [
        { value: "", label: "All" },
        ...["PDF", "XLSX", "CSV"].map((value) => ({ value, label: value })),
      ],
    },
    {
      id: "orientation",
      label: "Page Orientation",
      options: [
        { value: "", label: "All" },
        { value: "PORTRAIT", label: "Portrait" },
        { value: "LANDSCAPE", label: "Landscape" },
      ],
    },
  ];
  /** A template opens on a page of its own: the library page, or the details page of Report Definitions. */
  const detailPath = (row: ReportTemplate) =>
    inAdministration ? `/settings/report-configuration/${encodeURIComponent(row.code)}/details` : `/report/templates/${encodeURIComponent(row.code)}`;
  const edit = (row: ReportTemplate) =>
    navigate(`/settings/report-configuration/${encodeURIComponent(row.code)}`);
  const columns: DataTableColumn<ReportTemplate>[] = [
    {
      id: "no",
      header: "No.",
      cell: (_row, index) => (page - 1) * pageSize + index + 1,
    },
    {
      id: "code",
      header: "Template Number",
      sort: sortable("code"),
      cell: (row) => (
        <button
          type="button"
          className="font-medium text-emerald-600 hover:text-emerald-700 hover:underline text-left whitespace-nowrap"
          onClick={() => navigate(detailPath(row))}
        >
          {row.code}
        </button>
      ),
    },
    {
      id: "name",
      header: "Template Name",
      sort: sortable("displayName"),
      cell: (row) => <div className="min-w-48 whitespace-normal">{row.displayName}</div>,
    },
    {
      id: "source",
      header: "Data Source",
      sort: sortable("sourceCode"),
      cell: (row) =>
        result?.sources?.find((source) => source.value === row.sourceCode)
          ?.label ?? row.sourceCode,
    },
    {
      id: "category",
      header: "Category",
      sort: sortable("category"),
      cell: (row) => humanize(row.category),
    },
    {
      id: "revision",
      header: "Revision",
      sort: sortable("revision"),
      cell: (row) => (row.effectiveRevision != null ? `Rev ${row.effectiveRevision}` : "—"),
    },
    // The revision being written is for people who maintain templates; someone who only runs reports sees the effective revision.
    ...(inAdministration
      ? [
        {
          id: "inProgress",
          header: "Revision in progress",
          cell: (row) =>
            row.openRevision != null ? (
              <span className="whitespace-nowrap">
                Rev {row.openRevision} · {row.openRevisionStatus === "PENDING_APPROVAL" ? "Pending Approval" : "Draft"}
              </span>
            ) : (
              "—"
            ),
        },
      ]
      : []),
    {
      id: "formats",
      header: "Output Formats",
      cell: (row) => row.allowedFormats.join(" · "),
    },
    {
      id: "orientation",
      header: "Orientation",
      cell: (row) =>
        row.layout?.orientation === "PORTRAIT" ? "Portrait" : "Landscape",
    },
    {
      id: "status",
      header: "Status",
      sort: sortable("active"),
      cell: (row) => (
        <Badge semantic={row.lifecycleStatus === "ACTIVE" ? "success" : row.lifecycleStatus === "PENDING_APPROVAL" ? "warning" : "neutral"}>
          {LIFECYCLE_TEXT[row.lifecycleStatus ?? (row.active ? "ACTIVE" : "INACTIVE")]}
        </Badge>
      ),
    },
    {
      id: "updated",
      header: "Last Updated",
      sort: sortable("updatedAt"),
      cell: (row) => (
        <span className="whitespace-nowrap">{date(row.updatedAt)}</span>
      ),
    },
  ];
  const remove = async () => {
    if (!deleting || saving || !reason.trim()) return;
    setSaving(true);
    setDeleteError("");
    try {
      await reportTemplatesApi.delete(
        deleting.code,
        deleting.definitionVersion,
        reason.trim(),
      );
      setDeleting(undefined);
      setPage(1);
      setRefresh((value) => value + 1);
    } catch (error) {
      setDeleteError(reportError(error));
    } finally {
      setSaving(false);
    }
  };
  const rowAction: DataTableAction<ReportTemplate> = {
                cell: (row) => (
                  <button
                    ref={getRef(row.code)}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggle(row.code, e);
                    }}
                    className="inline-flex items-center justify-center h-7 w-7 md:h-8 md:w-8 rounded-lg hover:bg-slate-200 text-slate-600 transition-colors"
                    aria-label="More actions"
                  >
                    <MoreVertical className="h-3.5 w-3.5 md:h-4 md:w-4" />
                  </button>
                ),
  };
  const { layout, control } = useCustomColumnLayout("reportDefinitions", columns, rowAction);
  const title = inAdministration ? "Report Definitions" : "Report Library";
  return (
    <div className="flex min-w-0 flex-col h-full gap-4 md:gap-6 w-full flex-1">
      <PageHeader
        title={title}
        breadcrumbItems={reportBreadcrumbs(navigate, title, inAdministration)}
        actions={
          inAdministration && canManage ? (
            <Button
              size="sm"
              onClick={() => navigate("/settings/report-configuration/new")}
            >
              <Plus className="mr-2 h-4 w-4" />
              New Report Template
            </Button>
          ) : !inAdministration && canManage ? (
            <Button
              variant="default"
              size="sm"
              onClick={() => navigate("/settings/report-configuration")}
            >
              <IconFileSettings className="mr-2 h-4 w-4" />
              Configure Templates
            </Button>
          ) : undefined
        }
      />
      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          {error}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setRefresh((value) => value + 1)}
          >
            Retry
          </Button>
        </div>
      )}
      <ReportListToolbar
            searchPlaceholder="Search report templates..."
            search={search}
            onSearch={(value) => {
              setSearch(value);
              setPage(1);
            }}
            filters={groups.map((group) => ({
              id: group.id,
              label: group.label,
              value: filters[group.id],
              options: group.options.map((option) => ({ label: option.label, value: String(option.value) })),
              onChange: (value) => apply({ ...filters, [group.id]: value }),
            }))}
            hasActiveFilters={Boolean(search || Object.values(filters).some(Boolean))}
            onClear={() => {
              setSearch("");
              apply(defaults);
            }}
            customControl={control}
          >
          <div className="flex-1 flex flex-col relative">
            <DataTable
              rows={result?.data ?? []}
              columns={columns}
              getRowKey={(row) => row.code}
              isLoading={loading}
              loadingContent={
                <SectionLoading text="Loading report templates..." />
              }
              emptyState={
                <TableEmptyState
                  title={
                    error
                      ? "Unable to load report templates"
                      : "No Report Templates Found"
                  }
                  description={
                    error ||
                    (inAdministration
                      ? "No templates match these filters."
                      : "No templates are available for your active roles and filters.")
                  }
                />
              }
              scrollerRef={drag.scrollerRef}
              scrollProps={drag.dragEvents}
              isDragging={drag.isDragging}
              columnLayout={layout}
              action={rowAction}
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
      {openTemplate && (
        <PortalDropdownMenu
          isOpen={openId !== null}
          onClose={close}
          position={position}
          minWidth={200}
        >
          <div className="py-1">
            <DropdownMenuItem
              icon={<IconInfoCircle className="h-4 w-4" />}
              onClick={() => {
                navigate(detailPath(openTemplate));
                close();
              }}
            >
              View Detail
            </DropdownMenuItem>
            {!inAdministration && rowCan("createReport") && (
              <DropdownMenuItem
                icon={<FilePlus2 className="h-4 w-4" />}
                onClick={() => {
                  navigate(`/report/templates/${encodeURIComponent(openTemplate.code)}/run`);
                  close();
                }}
              >
                Create Report
              </DropdownMenuItem>
            )}
            {/* Changing a template belongs to Report Definitions; an effective revision is changed by Upgrade, on its details page. */}
            {inAdministration && (rowCan("edit") || rowCan("delete")) && (
              <>
                {rowCan("edit") && (
                  <DropdownMenuItem
                    icon={<IconPencilMinus className="h-4 w-4" />}
                    onClick={() => {
                      edit(openTemplate);
                      close();
                    }}
                  >
                    Edit Report Template
                  </DropdownMenuItem>
                )}
                {/* A GMP template is disabled, never deleted (REPORT-GMP-USE-APPROVAL-2026-10-14). */}
                {rowCan("delete") && (
                  <>
                    <div className="my-1 border-t border-slate-100" />
                    <DropdownMenuItem
                      icon={<Trash2 className="h-4 w-4" />}
                      variant="danger"
                      onClick={() => {
                        setDeleting(openTemplate);
                        setReason("");
                        setDeleteError("");
                        close();
                      }}
                    >
                      Delete Report Template
                    </DropdownMenuItem>
                  </>
                )}
              </>
            )}
          </div>
        </PortalDropdownMenu>
      )}
      <FormModal
        isOpen={!!deleting}
        title="Delete Report Template"
        description={`Remove ${deleting?.displayName ?? "this template"} from future use? Existing reports, files, versions and audit history will be preserved.`}
        onClose={() => {
          if (!saving) setDeleting(undefined);
        }}
        onConfirm={() => void remove()}
        confirmText="Delete Template"
        confirmVariant="destructive"
        isLoading={saving}
        confirmDisabled={!reason.trim()}
        size="md"
      >
        <label className="block space-y-2 text-sm font-medium text-slate-700">
          <span>Reason for deletion</span>
          <Textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={1000}
            required
          />
        </label>
        {deleteError && (
          <p role="alert" className="mt-3 text-sm text-red-600">
            {deleteError}
          </p>
        )}
      </FormModal>
    </div>
  );
}
