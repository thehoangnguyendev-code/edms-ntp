import { useMemo, useState } from "react";
import { MoreVertical } from "lucide-react";
import {
  IconCircleCheck,
  IconCircleOff,
  IconDownload,
  IconEye,
  IconToggleLeft,
  IconToggleRight,
} from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge/Badge";
import { OnlyOfficeDocumentViewer } from "@/features/documents/shared/components/OnlyOfficeDocumentViewer";
import { Button } from "@/components/ui/button/Button";
import { PortalDropdownMenu, DropdownMenuItem } from "@/components/ui/dropdown";
import { ESignatureModal } from "@/components/ui/esign-modal/ESignatureModal";
import { FormField } from "@/components/ui/form/ResponsiveForm";
import { FormModal } from "@/components/ui/modal/FormModal";
import {
  DataTable,
  useCustomColumnLayout,
  type DataTableColumn,
} from "@/components/ui/table/DataTable";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { useToast } from "@/components/ui/toast/Toast";
import { usePortalDropdown } from "@/hooks/usePortalDropdown";
import { useTableDragScroll } from "@/hooks/useTableDragScroll";
import { usePersistedState } from "@/hooks/usePersistedState";
import { useServerTable } from "@/features/settings/shared/hooks/useServerTable";
import {
  ReportListToolbar,
  type ReportSelectFilter,
} from "@/features/report/shared/ReportListToolbar";
import {
  Input,
  Textarea,
} from "@/features/training-activities/shared/TrainingFields";
import { TrainingFileDropzone } from "@/features/training-activities/shared/TrainingFileDropzone";
import {
  saveBlob,
  when,
} from "@/features/training-activities/shared/trainingLabels";
import {
  trainingError,
  trainingFormTemplatesApi,
  type TrainingFormTemplate,
} from "@/services/api/trainingActivities";

const STATUS_LABEL = { ENABLED: "Enabled", DISABLED: "Disabled" } as const;
const STATUS_COLOR = { ENABLED: "emerald", DISABLED: "slate" } as const;

/**
 * The Word templates of the assessment forms (for example APD.0009). A template is uploaded Disabled and is enabled with an electronic signature; the person who prepares a test
 * starts from the enabled template. Enabling one disables the other of the same document number. The file of a template never changes.
 */
export function TrainingFormTemplates({ canEdit, uploadOpen, onUploadClose }: { canEdit: boolean; uploadOpen: boolean; onUploadClose: () => void }) {
  const { showToast } = useToast();
  const drag = useTableDragScroll();
  const menu = usePortalDropdown();
  const [status, setStatus] = usePersistedState(
    "training.admin.templates.status",
    "",
  );
  const extraParams = useMemo(
    () => ({ status: status || undefined }),
    [status],
  );
  const table = useServerTable<TrainingFormTemplate>({
    fetcher: trainingFormTemplatesApi.page,
    defaultSortBy: "code",
    defaultSortDirection: "asc",
    extraParams,
    persistKey: "training.admin.templates",
    liveTypes: ["TRAINING"],
    syncToUrl: false,
  });
  const sorted = (key: string) => ({
    direction:
      table.sortConfig.key === key ? table.sortConfig.direction : undefined,
    onSort: () => table.handleSort(key),
  });

  const [form, setForm] = useState({
    file: null as File | null,
    code: "APD.0009",
    title: "Training assessment",
    versionLabel: "",
    remark: "",
  });
  const [busy, setBusy] = useState(false);
  const [viewing, setViewing] = useState<TrainingFormTemplate>();
  const [enabling, setEnabling] = useState<TrainingFormTemplate>();
  const [disabling, setDisabling] = useState<{
    template: TrainingFormTemplate;
    reason: string;
  }>();

  const upload = async () => {
    if (!form.file) return;
    setBusy(true);
    try {
      await trainingFormTemplatesApi.upload(form.file, {
        code: form.code.trim(),
        title: form.title.trim(),
        versionLabel: form.versionLabel.trim(),
        remark: form.remark.trim() || undefined,
      });
      showToast({
        type: "success",
        title: "Template uploaded",
        message: "It is used only after you enable it.",
      });
      onUploadClose();
      setForm({ ...form, file: null, versionLabel: "", remark: "" });
      table.reload();
    } catch (e) {
      showToast({
        type: "error",
        title: "The template was not uploaded",
        message: trainingError(e),
      });
    } finally {
      setBusy(false);
    }
  };
  const download = async (t: TrainingFormTemplate) => {
    try {
      saveBlob(await trainingFormTemplatesApi.download(t.id), t.originalName);
    } catch (e) {
      showToast({
        type: "error",
        title: "The file was not downloaded",
        message: trainingError(e),
      });
    }
  };
  const disable = async () => {
    if (!disabling) return;
    setBusy(true);
    try {
      await trainingFormTemplatesApi.disable(
        disabling.template.id,
        disabling.reason.trim(),
      );
      showToast({
        type: "success",
        title: "Template disabled",
        message: `${disabling.template.code} ${disabling.template.versionLabel}`,
      });
      setDisabling(undefined);
      table.reload();
    } catch (e) {
      showToast({
        type: "error",
        title: "The template was not disabled",
        message: trainingError(e),
      });
    } finally {
      setBusy(false);
    }
  };

  const columns: DataTableColumn<TrainingFormTemplate>[] = [
    {
      id: "rowNo",
      header: "No.",
      locked: true,
      cell: (_r, i) => (table.currentPage - 1) * table.itemsPerPage + i + 1,
    },
    {
      id: "code",
      header: "Document Number",
      sort: sorted("code"),
      cell: (t) => <span className="font-medium text-slate-900">{t.code}</span>,
    },
    {
      id: "title",
      header: "Document Name",
      sort: sorted("title"),
      cell: (t) => <div className="max-w-60 whitespace-normal">{t.title}</div>,
    },
    {
      id: "version",
      header: "Revision Number",
      sort: sorted("version"),
      cell: (t) => t.versionLabel,
    },
    {
      id: "status",
      header: "Status",
      sort: sorted("status"),
      cell: (t) => (
        <Badge color={STATUS_COLOR[t.status]}>{STATUS_LABEL[t.status]}</Badge>
      ),
    },
    {
      id: "file",
      header: "File Name",
      cell: (t) => (
        <div className="max-w-60 whitespace-normal break-all">
          {t.originalName}
          <div className="font-mono text-xs text-slate-500">
            {t.sha256.slice(0, 16)}…
          </div>
        </div>
      ),
    },
    {
      id: "uploaded",
      header: "Uploaded By",
      sort: sorted("uploadedBy"),
      cell: (t) => (
        <div>
          {t.uploadedByName}
          <div className="text-xs text-slate-500">{when(t.uploadedAt)}</div>
        </div>
      ),
    },
    {
      id: "enabled",
      header: "Enabled By",
      sort: sorted("enabledAt"),
      cell: (t) =>
        t.enabledAt ? (
          <div>
            {t.enabledByName}
            <div className="text-xs text-slate-500">{when(t.enabledAt)}</div>
          </div>
        ) : (
          "—"
        ),
    },
    {
      id: "disabled",
      header: "Disabled By",
      cell: (t) =>
        t.disabledAt ? (
          <div className="max-w-60 whitespace-normal">
            {t.disabledByName}
            <div className="text-xs text-slate-500">{when(t.disabledAt)}</div>
            {t.disableReason ? (
              <div className="text-xs text-slate-500">{t.disableReason}</div>
            ) : null}
          </div>
        ) : (
          "—"
        ),
    },
  ];
  const action = {
    cell: (t: TrainingFormTemplate) => (
      <button
        type="button"
        ref={menu.getRef(t.id)}
        aria-label="More actions"
        className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-200 md:h-8 md:w-8"
        onClick={(event) => menu.toggle(t.id, event)}
      >
        <MoreVertical className="h-4 w-4" />
      </button>
    ),
  };
  const { layout, control } = useCustomColumnLayout(
    "training.admin.templates",
    columns,
    action,
  );
  const actionRow = table.items.find((row) => row.id === menu.openId);
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
  ];

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">
        The Word source of a form such as APD.0009. The person who prepares a
        test starts from the enabled template and edits it in the browser. A
        template is enabled with an electronic signature, and enabling one
        disables the other of the same document number. The file never changes
        after it is uploaded.
      </p>
      <ReportListToolbar
        searchPlaceholder="Search document number, name or revision…"
        search={table.searchQuery}
        onSearch={(value) => {
          table.setSearchQuery(value);
          table.setCurrentPage(1);
        }}
        filters={filters}
        dates={[]}
        hasActiveFilters={Boolean(status || table.searchQuery)}
        onClear={() => {
          setStatus("");
          table.setSearchQuery("");
          table.setCurrentPage(1);
        }}
        customControl={control}
        framed={false}
        flush
      >
        <DataTable
          rows={table.items}
          getRowKey={(t) => t.id}
          isLoading={table.isLoading}
          loadingContent={<SectionLoading text="Loading templates…" />}
          emptyState={
            <TableEmptyState
              title="No template"
              description="Upload the Word file of a form, then enable it with your signature."
            />
          }
          scrollerRef={drag.scrollerRef}
          scrollProps={drag.dragEvents}
          isDragging={drag.isDragging}
          columns={columns}
          columnLayout={layout}
          action={action}
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
        isOpen={!!actionRow}
        onClose={menu.close}
        position={menu.position}
        minWidth={220}
      >
        {actionRow && (
          <div className="py-1">
            <DropdownMenuItem
              icon={<IconEye className="h-4 w-4" />}
              onClick={() => {
                setViewing(actionRow);
                menu.close();
              }}
            >
              View File
            </DropdownMenuItem>
            <DropdownMenuItem
              icon={<IconDownload className="h-4 w-4" />}
              onClick={() => {
                void download(actionRow);
                menu.close();
              }}
            >
              Download
            </DropdownMenuItem>
            {canEdit && actionRow.status === "DISABLED" && (
              <DropdownMenuItem
                icon={<IconToggleRight className="h-4 w-4" />}
                onClick={() => {
                  setEnabling(actionRow);
                  menu.close();
                }}
              >
                Enable Template
              </DropdownMenuItem>
            )}
            {canEdit && actionRow.status === "ENABLED" && (
              <DropdownMenuItem
                icon={<IconToggleLeft className="h-4 w-4" />}
                onClick={() => {
                  setDisabling({ template: actionRow, reason: "" });
                  menu.close();
                }}
              >
                Disable Template
              </DropdownMenuItem>
            )}
          </div>
        )}
      </PortalDropdownMenu>

      {viewing && (
        <FormModal
          isOpen
          onClose={() => setViewing(undefined)}
          title={`${viewing.code} ${viewing.versionLabel}: ${viewing.title}`}
          showFooter={false}
          size="2xl"
          className="max-w-5xl"
        >
          <OnlyOfficeDocumentViewer
            key={viewing.id}
            revisionId={viewing.id}
            watchForChanges={false}
            height="68dvh"
            loadConfig={() => trainingFormTemplatesApi.viewConfig(viewing.id)}
          />
        </FormModal>
      )}
      {canEdit && uploadOpen && (
        <FormModal
          isOpen
          onClose={onUploadClose}
          onConfirm={() => void upload()}
          title="Upload a form template"
          description="The Word file is uploaded Disabled. It is used only after you enable it with your signature."
          confirmText="Upload"
          isLoading={busy}
          confirmDisabled={
            !form.file ||
            !form.code.trim() ||
            !form.title.trim() ||
            !form.versionLabel.trim()
          }
          size="lg"
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <TrainingFileDropzone
                label="Word file (.docx)"
                required
                accept=".docx"
                maxMb={20}
                hint="A Word file of the form, as it is published"
                file={form.file}
                onChange={(f) => setForm({ ...form, file: f })}
              />
            </div>
            <FormField label="Document Number" required>
              <Input
                value={form.code}
                maxLength={40}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
              />
            </FormField>
            <FormField label="Revision Number" required>
              <Input
                value={form.versionLabel}
                maxLength={40}
                placeholder="For example 2.0.0"
                onChange={(e) =>
                  setForm({ ...form, versionLabel: e.target.value })
                }
              />
            </FormField>
            <div className="md:col-span-2">
              <FormField label="Document Name" required>
                <Input
                  value={form.title}
                  maxLength={255}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </FormField>
            </div>
            <div className="md:col-span-2">
              <FormField label="Remark">
                <Textarea
                  rows={2}
                  value={form.remark}
                  onChange={(e) => setForm({ ...form, remark: e.target.value })}
                />
              </FormField>
            </div>
          </div>
        </FormModal>
      )}
      {disabling && (
        <FormModal
          isOpen
          onClose={() => setDisabling(undefined)}
          onConfirm={() => void disable()}
          title={`Disable ${disabling.template.code} ${disabling.template.versionLabel}`}
          description="Nobody can start a new test from this template until it is enabled again. A test that was started from it keeps its own file. The reason stays in the Audit Trail."
          confirmText="Disable"
          confirmVariant="destructive"
          isLoading={busy}
          confirmDisabled={!disabling.reason.trim()}
          size="md"
        >
          <FormField label="Reason" required>
            <Textarea
              rows={2}
              value={disabling.reason}
              onChange={(e) =>
                setDisabling({ ...disabling, reason: e.target.value })
              }
            />
          </FormField>
        </FormModal>
      )}
      <ESignatureModal
        isOpen={!!enabling}
        onClose={() => setEnabling(undefined)}
        onConfirm={async (d: { signatureToken: string; reason: string }) => {
          if (!enabling) return;
          try {
            await trainingFormTemplatesApi.enable(
              enabling.id,
              d.signatureToken,
              d.reason,
            );
            showToast({
              type: "success",
              title: "Template enabled",
              message: `${enabling.code} ${enabling.versionLabel}`,
            });
            setEnabling(undefined);
            table.reload();
          } catch (e) {
            showToast({
              type: "error",
              title: "The template was not enabled",
              message: trainingError(e),
            });
            setEnabling(undefined);
          }
        }}
        actionTitle="Enable the template"
        meaningDisplayName="Form Template Enabled"
        meaningCode="TRAINING_FORM_TEMPLATE_ENABLED"
        targetDetails={{
          code: enabling?.code ?? "",
          title: enabling?.title ?? "",
          revision: enabling?.versionLabel ?? "",
        }}
      />
    </div>
  );
}
