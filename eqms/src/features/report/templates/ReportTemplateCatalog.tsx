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
import { IconFilter2, IconInfoCircle, IconPencilMinus } from "@tabler/icons-react";
import { Button } from "@/components/ui/button/Button";
import { Badge } from "@/components/ui/badge/Badge";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { SearchInput } from "@/components/ui/form/SearchInput";
import { Select, type SelectOption } from "@/components/ui/select/Select";
import { Textarea } from "@/components/ui/form/ResponsiveForm";
import { Drawer } from "@/components/ui/drawer/Drawer";
import { FormModal } from "@/components/ui/modal/FormModal";
import { PortalDropdownMenu, DropdownMenuItem } from "@/components/ui/dropdown";
import { DesktopFilterPanel } from "@/components/ui/filter/DesktopFilterPanel";
import { FilterOptionList } from "@/components/ui/filter/FilterOptionList";
import {
  FilterDrawer,
  FilterAccordionItem,
} from "@/components/ui/filter/FilterDrawer";
import { FilterOptionButton } from "@/components/ui/filter/FilterOptionButton";
import { DataTable, type DataTableColumn } from "@/components/ui/table";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { useTableDragScroll } from "@/hooks/useTableDragScroll";
import { usePortalDropdown } from "@/hooks/usePortalDropdown";
import { usePermissions } from "@/hooks/usePermissions";
import { useBranding } from "@/components/branding/BrandLogo";
import {
  reportTemplatesApi,
  reportError,
  type ReportTemplate,
  type TemplatePage,
} from "@/services/api/reportTemplates";
import { ReportTemplateRun } from "./ReportTemplateRun";
import { reportBreadcrumbs } from "../shared/reportBreadcrumbs";

const defaults = { status: "", sourceCode: "", format: "", orientation: "" };
type Filters = typeof defaults;
const date = (value?: string) =>
  value ? new Date(value).toLocaleString() : "—";

export function ReportTemplateCatalog({ admin = false }: { admin?: boolean }) {
  const navigate = useNavigate();
  const { hasAnyPermission } = usePermissions();
  const { compactDesktopFilters } = useBranding();
  const canManage = hasAnyPermission([
    "reports.definition.manage",
    "settings.configuration.manage",
  ]);
  const canRun = hasAnyPermission([
    "reports.run.create",
    "report.module.export",
  ]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<Filters>(defaults);
  const [mobileDraft, setMobileDraft] = useState<Filters>(defaults);
  const [filterOpen, setFilterOpen] = useState(false);
  const [sort, setSort] = useState({
    field: "displayName",
    direction: "asc" as "asc" | "desc",
  });
  const [result, setResult] = useState<TemplatePage>();
  const [selected, setSelected] = useState<ReportTemplate>();
  const [running, setRunning] = useState(false);
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
            sortBy: sort.field,
            direction: sort.direction,
            status: filters.status || undefined,
            sourceCode: filters.sourceCode || undefined,
            format: filters.format || undefined,
            orientation: filters.orientation || undefined,
          },
          admin,
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
  }, [search, page, sort.field, sort.direction, filters, admin, refresh]);
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
        ...(admin ? [{ value: "DISABLED", label: "Disabled" }] : []),
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
  const searchInput = (
    <SearchInput
      value={search}
      onChange={(value) => {
        setSearch(value);
        setPage(1);
      }}
      placeholder="Search report templates..."
    />
  );
  const edit = (row: ReportTemplate) =>
    navigate(`/settings/report-configuration/${encodeURIComponent(row.code)}`);
  const columns: DataTableColumn<ReportTemplate>[] = [
    {
      id: "no",
      header: "No.",
      cell: (_row, index) => (page - 1) * 10 + index + 1,
    },
    {
      id: "name",
      header: "Template Name",
      sort: sortable("displayName"),
      cell: (row) => (
        <div className="min-w-48 space-y-1">
          <button
            type="button"
            className="font-medium text-emerald-600 hover:text-emerald-700 hover:underline text-left block"
            onClick={() => setSelected(row)}
          >
            {row.displayName}
          </button>
          <p className="text-xs text-slate-500">{row.code}</p>
        </div>
      ),
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
      cell: (row) => row.category,
    },
    {
      id: "version",
      header: "Version",
      sort: sortable("definitionVersion"),
      cell: (row) => `v${row.definitionVersion}`,
    },
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
        <Badge semantic={row.active ? "success" : "neutral"}>
          {row.active ? "Active" : "Disabled"}
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
      if (selected?.code === deleting.code) setSelected(undefined);
      setDeleting(undefined);
      setPage(1);
      setRefresh((value) => value + 1);
    } catch (error) {
      setDeleteError(reportError(error));
    } finally {
      setSaving(false);
    }
  };
  if (running && selected)
    return (
      <ReportTemplateRun
        template={selected}
        onBack={() => {
          setRunning(false);
          setSelected(undefined);
          setRefresh((value) => value + 1);
        }}
      />
    );
  const title = admin ? "Report Configuration" : "Report Templates";
  return (
    <div className="flex min-w-0 flex-col h-full gap-4 md:gap-6 w-full flex-1">
      <PageHeader
        title={title}
        breadcrumbItems={reportBreadcrumbs(navigate, title, admin)}
        actions={
          admin && canManage ? (
            <Button
              size="sm"
              onClick={() => navigate("/settings/report-configuration/new")}
            >
              <Plus className="mr-2 h-4 w-4" />
              New Report Template
            </Button>
          ) : !admin && canManage ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/settings/report-configuration")}
            >
              <Settings2 className="mr-2 h-4 w-4" />
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
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm min-w-0 w-full overflow-hidden flex flex-col">
        <div className="p-4 md:p-5 flex-1 flex flex-col">
          <div className="hidden md:block">
            {compactDesktopFilters ? (
              <DesktopFilterPanel
                search={searchInput}
                values={filters}
                defaults={defaults}
                onApply={(next) => apply(next as Filters)}
                fields={groups.map((group) => ({
                  id: group.id,
                  label: group.label,
                  render: (draft, change, active) => (
                    <FilterOptionList
                      label={group.label}
                      value={draft[group.id] ?? ""}
                      options={group.options}
                      active={active}
                      onChange={(value) => change(group.id, value)}
                    />
                  ),
                }))}
              />
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 items-end pb-4 md:pb-5">
                <div>
                  <label className="mb-1.5 block text-xs sm:text-sm font-medium text-slate-700">
                    Search
                  </label>
                  {searchInput}
                </div>
                {groups.map((group) => (
                  <div key={group.id}>
                    <Select
                      label={group.label}
                      value={filters[group.id]}
                      options={group.options}
                      onChange={(value) =>
                        apply({ ...filters, [group.id]: String(value) })
                      }
                      placeholder={`All ${group.label}`}
                    />
                  </div>
                ))}
                <div className="flex items-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSearch("");
                      apply(defaults);
                    }}
                    className="h-9 px-4 gap-2 font-medium hover:bg-red-600 hover:text-white hover:border-red-600 whitespace-nowrap"
                  >
                    Clear Filters
                  </Button>
                </div>
              </div>
            )}
          </div>
          <div className="flex md:hidden flex-col gap-1.5 w-full mb-4">
            <label className="text-xs sm:text-sm font-medium text-slate-700 block">
              Search
            </label>
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1">{searchInput}</div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setMobileDraft(filters);
                  setFilterOpen(true);
                }}
                className="h-10 gap-2 whitespace-nowrap"
              >
                <IconFilter2 className="h-4 w-4" />
                Filters
              </Button>
            </div>
          </div>
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
                    (admin
                      ? "No templates match these filters."
                      : "No templates are available for your active roles and filters.")
                  }
                />
              }
              scrollerRef={drag.scrollerRef}
              scrollProps={drag.dragEvents}
              isDragging={drag.isDragging}
              action={{
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
              }}
              pagination={
                result && (
                  <TablePagination
                    currentPage={page}
                    totalPages={result.pagination.totalPages}
                    totalItems={result.pagination.total}
                    itemsPerPage={10}
                    onPageChange={setPage}
                    showItemsPerPageSelector={false}
                  />
                )
              }
            />
          </div>
        </div>
      </div>
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
                setSelected(openTemplate);
                close();
              }}
            >
              View Detail
            </DropdownMenuItem>
            {!admin && canRun && (
              <DropdownMenuItem
                icon={<FilePlus2 className="h-4 w-4" />}
                onClick={() => {
                  setSelected(openTemplate);
                  setRunning(true);
                  close();
                }}
              >
                Create Report
              </DropdownMenuItem>
            )}
            {canManage && (
              <>
                <DropdownMenuItem
                  icon={<IconPencilMinus className="h-4 w-4" />}
                  onClick={() => {
                    edit(openTemplate);
                    close();
                  }}
                >
                  Edit Report Template
                </DropdownMenuItem>
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
          </div>
        </PortalDropdownMenu>
      )}
      <FilterDrawer
        isOpen={filterOpen}
        onClose={() => setFilterOpen(false)}
        onClear={() => setMobileDraft(defaults)}
        onApply={() => {
          apply(mobileDraft);
          setFilterOpen(false);
        }}
        applyLabel="Apply"
      >
        {groups.map((group) => (
          <FilterAccordionItem
            key={group.id}
            label={group.label}
            isExpanded={expandedSections.has(group.id)}
            onToggle={() => toggleSection(group.id)}
          >
            <div className="grid grid-cols-1 gap-2 pt-1 pb-4">
              {group.options.map((opt) => (
                <FilterOptionButton
                  key={String(opt.value)}
                  label={opt.label}
                  isSelected={
                    (mobileDraft[group.id] ?? "") === String(opt.value)
                  }
                  onClick={() =>
                    setMobileDraft((current) => ({
                      ...current,
                      [group.id]: String(opt.value),
                    }))
                  }
                />
              ))}
            </div>
          </FilterAccordionItem>
        ))}
      </FilterDrawer>
      {selected && (
        <Drawer
          title="Template Details"
          subtitle={selected.displayName}
          onClose={() => setSelected(undefined)}
          footer={
            <>
              {canManage && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => edit(selected)}
                >
                  Edit Report Template
                </Button>
              )}
              {!admin && canRun && (
                <Button size="sm" onClick={() => setRunning(true)}>
                  Create Report
                </Button>
              )}
            </>
          }
        >
          <p className="mb-5 break-words text-sm text-slate-600">
            {selected.description || "No description."}
          </p>
          <dl className="space-y-4 text-sm">
            {[
              ["Template Code", selected.code],
              ["Data Source", selected.sourceCode],
              ["Version", `v${selected.definitionVersion}`],
              ["Status", selected.active ? "Active" : "Disabled"],
              ["Classification", selected.classification],
              ["Output Formats", selected.allowedFormats.join(" · ")],
              [
                "Orientation",
                selected.layout?.orientation === "PORTRAIT"
                  ? "Portrait"
                  : "Landscape",
              ],
              ["Created", date(selected.createdAt)],
              ["Last Updated", date(selected.updatedAt)],
            ].map(([label, value]) => (
              <div
                key={label}
                className="grid grid-cols-[8rem_minmax(0,1fr)] gap-3"
              >
                <dt className="text-slate-500">{label}</dt>
                <dd className="break-words font-medium text-slate-900">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-6 text-xs leading-relaxed text-slate-500">
            Report metadata access does not grant access to source-document
            content. Current role scopes are checked on preview, generation and
            download.
          </p>
        </Drawer>
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
