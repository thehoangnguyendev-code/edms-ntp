import { TrainingPersonName } from "../shared/TrainingPersonName";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePersistedState } from "@/hooks/usePersistedState";
import { resettingDates, useDateRange, useDepartmentNameOptions } from "../shared/useListFilters";
import { useNavigate } from "react-router-dom";
import { MoreVertical } from "lucide-react";
import { IconEye, IconPlus, IconCheck, IconBan, IconPhotoShare, IconX, IconInfoCircle, IconFileDownload, IconFileTypeDocx, IconFileTypePdf } from "@tabler/icons-react";
import { useSpecimenActions } from "./useSpecimenActions";
import { SPECIMEN_STATUS_COLOR as STATUS_COLOR, SPECIMEN_STATUS_LABEL as STATUS_LABEL } from "./specimenLabels";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { Button } from "@/components/ui/button/Button";
import { Badge } from "@/components/ui/badge/Badge";
import { FormModal } from "@/components/ui/modal/FormModal";
import { FormField } from "@/components/ui/form/ResponsiveForm";
import { Textarea } from "../shared/TrainingFields";
import { Select } from "@/components/ui/select/Select";
import {
  DataTable,
  useCustomColumnLayout,
  type DataTableColumn,
} from "@/components/ui/table/DataTable";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { PortalDropdownMenu, DropdownMenuItem } from "@/components/ui/dropdown";
import { useToast } from "@/components/ui/toast/Toast";
import { usePortalDropdown } from "@/hooks/usePortalDropdown";
import { usePermissions } from "@/hooks/usePermissions";
import { useServerTable } from "@/features/settings/shared/hooks/useServerTable";
import {
  ReportListToolbar,
  type ReportSelectFilter,
} from "@/features/report/shared/ReportListToolbar";
import {
  trainingActivitiesApi,
  trainingError,
  trainingSpecimenApi,
  type TrainingSpecimen,
} from "@/services/api/trainingActivities";
import {
  day,
  trainingBreadcrumbs,
  TRAINING_PAGES } from "../shared/trainingLabels";
import { SpecimenImagePicker } from "../shared/SpecimenImagePicker";


/** Specimen signatures. The image is never in the list: it is opened on request, with a check each time, and the opening is recorded in the Audit Trail. */
export function TrainingSpecimenView() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { hasPermission } = usePermissions();
  const canManage = hasPermission("training.signature.manage");
  const menu = usePortalDropdown();
  const [status, setStatus] = usePersistedState("training.specimens.status", "");
  const [departmentFilter, setDepartmentFilter] = usePersistedState("training.specimens.department", "");
  const departments = useDepartmentNameOptions();
  const effectiveRange = useDateRange("training.specimens.effective", "Effective Date Range");
  const uploadedRange = useDateRange("training.specimens.uploaded", "Uploaded Date Range");
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [file2, setFile2] = useState<File | null>(null);
  const [forPerson, setForPerson] = useState("");
  const [people, setPeople] = useState<{ label: string; value: string }[]>([]);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const fetcher = useCallback(
    (params: Record<string, string | number | boolean | undefined>) =>
      trainingSpecimenApi.list(params).catch((e) => {
        setError(trainingError(e));
        throw e;
      }),
    [],
  );
  const extra = useMemo(() => ({
    status: status || undefined, department: departmentFilter || undefined,
    ...effectiveRange.params("effectiveFrom", "effectiveTo"), ...uploadedRange.params("uploadedFrom", "uploadedTo"),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [status, departmentFilter, effectiveRange.from, effectiveRange.to, uploadedRange.from, uploadedRange.to]);
  const table = useServerTable<TrainingSpecimen>({ persistKey: "training.specimens", liveTypes: ["TRAINING"],
    fetcher,
    defaultSortBy: "createdAt",
    defaultSortDirection: "desc",
    extraParams: extra,
    initialItemsPerPage: 10,
  });

  const searchPeople = useCallback(async (query: string) => {
    const list = await trainingActivitiesApi.people(query).catch(() => []);
    const mapped = list.map((p) => ({
      label: `${p.fullName}${p.employeeCode ? ` (${p.employeeCode})` : ""}`,
      value: p.id,
    }));
    setPeople(mapped);
    return mapped;
  }, []);
  useEffect(() => {
    if (!uploading) return;
    void (canManage ? searchPeople("") : Promise.resolve([]));
  }, [uploading, canManage, searchPeople]);
  const upload = async () => {
    if (!file || !file2) return;
    setBusy(true);
    try {
      await trainingSpecimenApi.upload(
        file,
        file2,
        forPerson || undefined,
        reason.trim() || undefined,
      );
      showToast({
        type: "success",
        title: "Specimen signature uploaded",
        message: "It is now the current record of the person.",
      });
      setUploading(false);
      setFile(null);
      setFile2(null);
      setReason("");
      setForPerson("");
      table.reload();
    } catch (e) {
      showToast({
        type: "error",
        title: "The image was not uploaded",
        message: trainingError(e),
      });
    } finally {
      setBusy(false);
    }
  };
  const actions = useSpecimenActions();

  const sorted = (key: string) => ({ direction: table.sortConfig.key === key ? table.sortConfig.direction : undefined, onSort: () => table.handleSort(key) });

  const columns: DataTableColumn<TrainingSpecimen>[] = [
    {
      id: "rowNo",
      header: "No.",
      locked: true,
      cell: (_r, i) => (table.currentPage - 1) * table.itemsPerPage + i + 1,
    },
    { id: "employeeCode", header: "Employee ID", sort: sorted("employeeCode"), cell: (r) => r.employeeCode ?? "—" },
    { id: "name", header: "Full Name", sort: sorted("employee"), cell: (r) => <TrainingPersonName fullName={r.fullName} avatar={r.avatar} /> },
    {
      id: "department",
      header: "Department", sort: sorted("department"),
      cell: (r) => r.department ?? "—",
    },
    { id: "version", header: "Version", sort: sorted("version"), cell: (r) => <button type="button" className="font-medium text-emerald-600 hover:underline" onClick={() => navigate(`/training-management/specimen-signatures/${r.id}`)}>{r.versionNo}</button> },
    {
      id: "status",
      header: "Status", sort: sorted("status"),
      cell: (r) => (
        <Badge color={STATUS_COLOR[r.status]}>{STATUS_LABEL[r.status]}</Badge>
      ),
    },
    {
      id: "uploaded",
      header: "Uploaded By", sort: sorted("uploadedBy"),
      cell: (r) => r.uploadedByName,
    },
    { id: "uploadedOn", header: "Uploaded On", sort: sorted("createdAt"), cell: (r) => day(r.createdAt) },
    {
      id: "confirmed",
      header: "Confirmed By (earlier workflow)", sort: sorted("confirmedBy"),
      cell: (r) => r.confirmedByName ?? "—",
    },
    { id: "effective", header: "Effective Date", sort: sorted("effective"), cell: (r) => day(r.effectiveDate) },
    {
      id: "reason",
      header: "Reason", sort: sorted("reason"),
      cell: (r) => (
        <div className="max-w-60 whitespace-normal">
          {r.changeReason ?? "—"}
        </div>
      ),
    },
  ];
  const action = {
    cell: (r: TrainingSpecimen) => (
      <button
        type="button"
        ref={menu.getRef(r.id)}
        aria-label="More actions"
        className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-200 md:h-8 md:w-8"
        onClick={(e) => menu.toggle(r.id, e)}
      >
        <MoreVertical className="h-4 w-4" />
      </button>
    ),
  };
  const { layout, control } = useCustomColumnLayout(
    "training.specimen.signatures",
    columns,
    action,
  );
  const row = table.items.find((r) => r.id === menu.openId);
  const filters: ReportSelectFilter[] = [
    {
      id: "status",
      label: "Status",
      value: status,
      options: [
        { label: "All", value: "" },
        ...Object.entries(STATUS_LABEL).map(([value, label]) => ({
          label,
          value,
        })),
      ],
      onChange: (v) => {
        setStatus(v);
        table.setCurrentPage(1);
      },
    },
    { id: "department", label: "Department", value: departmentFilter, options: [{ label: "All", value: "" }, ...departments], onChange: (v) => { setDepartmentFilter(v); table.setCurrentPage(1); } },
  ];

  return (
    <div className="flex min-w-0 flex-col gap-4 md:gap-6">
      <PageHeader
        title={TRAINING_PAGES.specimen.title}
        breadcrumbItems={trainingBreadcrumbs(navigate, "specimen")}
        actions={
          <Button size="sm" onClick={() => setUploading(true)}>
            <IconPlus className="mr-2 h-4 w-4" />
            Upload Specimen Signature
          </Button>
        }
      />
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <ReportListToolbar
        searchPlaceholder="Search employee…"
        search={table.searchQuery}
        onSearch={(v) => {
          table.setSearchQuery(v);
          table.setCurrentPage(1);
        }}
        filters={filters}
        dates={resettingDates([effectiveRange.filter, uploadedRange.filter], () => table.setCurrentPage(1))}
        hasActiveFilters={Boolean(status || departmentFilter || effectiveRange.isSet || uploadedRange.isSet || table.searchQuery)}
        onClear={() => {
          setStatus("");
          setDepartmentFilter("");
          effectiveRange.clear();
          uploadedRange.clear();
          table.setCurrentPage(1);
        }}
        customControl={control}
      >
        <DataTable
          rows={table.items}
          getRowKey={(r) => r.id}
          isLoading={table.isLoading}
          loadingContent={<SectionLoading text="Loading…" />}
          columns={columns}
          columnLayout={layout}
          action={action}
          emptyState={
            <TableEmptyState
              title="No Specimen Signatures"
              description="Upload the scan of the paper that the employee signed by hand (FRM.0007) to keep it as a record."
            />
          }
          pagination={
            table.totalItems > 0 ? (
              <TablePagination
                currentPage={table.currentPage}
                totalPages={table.totalPages}
                totalItems={table.totalItems}
                itemsPerPage={table.itemsPerPage}
                onPageChange={table.setCurrentPage}
                onItemsPerPageChange={table.setItemsPerPage}
              />
            ) : undefined
          }
        />
      </ReportListToolbar>
      <PortalDropdownMenu
        isOpen={!!row}
        onClose={menu.close}
        position={menu.position}
        minWidth="min(220px, 90vw)"
      >
        {row && (
          <div className="whitespace-nowrap py-1">
            <DropdownMenuItem icon={<IconInfoCircle className="h-4 w-4" />} onClick={() => { navigate(`/training-management/specimen-signatures/${row.id}`); menu.close(); }}>
              View Details
            </DropdownMenuItem>
            {row.capabilities.viewImage && (
              <DropdownMenuItem
                icon={<IconPhotoShare className="h-4 w-4" />}
                onClick={() => {
                  void actions.view(row);
                  menu.close();
                }}
              >
                View Image
              </DropdownMenuItem>
            )}
          </div>
        )}
      </PortalDropdownMenu>

      <FormModal
        isOpen={uploading}
        onClose={() => {
          setUploading(false);
          setFile(null);
          setFile2(null);
        }}
        onConfirm={() => void upload()}
        title="Upload a Specimen Signature"
        description="The scan of the paper that the employee signed by hand (FRM.0007): a PNG, JPEG, WebP or BMP picture of up to 5 MB (not a GIF). It becomes the current record of the employee at once; nobody confirms it."
        confirmText="Upload"
        isLoading={busy}
        confirmDisabled={!file || !file2}
        size="md"
      >
        <div className="grid gap-4">
          {canManage && (
            <FormField label="For another employee (leave empty for yourself)">
              <Select
                value={forPerson}
                onChange={setForPerson}
                options={[{ label: "Myself", value: "" }, ...people, ...(forPerson && !people.some((x) => x.value === forPerson) ? [{ label: "Selected employee", value: forPerson }] : [])]}
                onSearch={searchPeople}
                placeholder="Search by name"
              />
            </FormField>
          )}
          <FormField label="1st specimen signature" required>
            <SpecimenImagePicker file={file} onChange={setFile} />
          </FormField>
          <FormField label="2nd specimen signature" required>
            <SpecimenImagePicker file={file2} onChange={setFile2} />
          </FormField>
          <FormField label="Reason (needed when it replaces the current record)">
            <Textarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </FormField>
        </div>
      </FormModal>
      {actions.modals}
    </div>
  );
}
