import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button/Button";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { FormSection } from "@/components/ui/form/FormSection";
import { Checkbox } from "@/components/ui/checkbox/Checkbox";
import { Select } from "@/components/ui/select/Select";
import { SearchInput } from "@/components/ui/form/SearchInput";
import { DateTimePicker } from "@/components/ui/datetime-picker/DateTimePicker";
import { WorkflowStepper } from "@/components/ui/workflow-stepper/WorkflowStepper";
import { Input } from "@/components/ui/form/ResponsiveForm";
import { ESignatureModal } from "@/components/ui/esign-modal/ESignatureModal";
import { DataTable, useCustomColumnLayout, type DataTableColumn } from "@/components/ui/table/DataTable";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { useTableDragScroll } from "@/hooks/useTableDragScroll";
import { reportsApi, type ReportFormat } from "@/services/api/reports";
import {
  reportTemplatesApi,
  reportError,
  type ReportTemplate,
  type TemplateCriteria,
  type TemplatePreview,
} from "@/services/api/reportTemplates";
import { ROUTES } from "@/app/routes.constants";
import { ReportLookup } from "./ReportLookup";
import { RealtimeReportPreview } from "../shared/RealtimeReportPreview";
import { reportBreadcrumbs } from "../shared/reportBreadcrumbs";
import { displayDateTime } from "@/utils/format";

const stages = ["Criteria", "Preview", "Output"];
function isoDate(value: string): string {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : value;
}
/**
 * The preview table. It is its own component so that its column layout is made when the columns exist: the columns come from the first
 * answer of the server, and a layout made earlier (with no columns) would show an empty table.
 */
function PreviewResults({
  preview,
  criteria,
  busy,
  onSort,
  onPage,
}: {
  preview: TemplatePreview;
  criteria: TemplateCriteria;
  busy: boolean;
  onSort: (field: string) => void;
  onPage: (page: number) => void;
}) {
  const drag = useTableDragScroll();
  const columns: DataTableColumn<string[]>[] = (preview.rows[0] ?? []).map((name, index) => {
    const field = criteria.fields[index];
    return {
      id: String(index),
      header: name,
      sort: { direction: criteria.sortBy === field ? criteria.direction : undefined, onSort: (): void => onSort(field) },
      cell: (row: string[]) => row[index],
    };
  });
  const { layout, control } = useCustomColumnLayout("reportRunPreview", columns);
  return (
    <>
      <div className="flex justify-end">{control}</div>
      <DataTable
        rows={preview.rows.slice(1)}
        columns={columns}
        columnLayout={layout}
        getRowKey={(_row, index) => index}
        scrollerRef={drag.scrollerRef}
        scrollProps={drag.dragEvents}
        isDragging={drag.isDragging}
        isLoading={busy}
        loadingContent={<p className="p-6 text-sm text-slate-500">Loading preview…</p>}
        pagination={
          <TablePagination
            currentPage={preview.pagination.page}
            totalPages={preview.pagination.totalPages}
            totalItems={preview.pagination.total}
            itemsPerPage={10}
            onPageChange={onPage}
            showItemsPerPageSelector={false}
          />
        }
      />
    </>
  );
}

export function ReportTemplateRun({
  template,
  onBack,
}: {
  template: ReportTemplate;
  onBack: () => void;
}) {
  const navigate = useNavigate();
  const [stage, setStage] = useState(0);
  const [reportTitle, setReportTitle] = useState(template.displayName);
  const [criteria, setCriteria] = useState<TemplateCriteria>({
    version: template.definitionVersion,
    fields: template.fields
      .filter(
        (field) =>
          field.allowed &&
          (field.required ||
            field.defaultSelected ||
            template.layout?.charts?.some((c) => c.field === field.code)),
      )
      .map((field) => field.code),
    filters: {},
    sortBy: template.fields.find((field) => field.allowed)?.code ?? "",
    direction: "asc",
  });
  const [preview, setPreview] = useState<TemplatePreview>();
  const [format, setFormat] = useState<ReportFormat>(
    template.allowedFormats[0],
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  /** The choice to run without a filter (REPORT-FULL-RUN-2026-11-12). */
  const [full, setFull] = useState(false);
  const key = useRef<string | undefined>(undefined);
  /** A run of the Audit Trail report is signed; the reason is the one given in the signature window (REPORT-RUN-SIGNATURE-2026-11-12). */
  const [signing, setSigning] = useState(false);
  const narrowed = (template.filterFields ?? []).some((field) => (criteria.filters[field.code] ?? "").trim() !== "");
  const canPreview = narrowed || full;
  const total = preview?.pagination.total ?? 0;
  const standardLimit = preview?.maxRows ?? 10000;
  const fullLimit = preview?.maxRowsFull ?? 100000;
  const limit = full ? fullLimit : standardLimit;
  const tooLarge = !!preview && total > limit;
  /** Above the ordinary limit only CSV and XLSX can be made. */
  const formatOptions = template.allowedFormats.filter((value) => total <= standardLimit || value === "CSV" || value === "XLSX");
  const changeCriteria = (next: TemplateCriteria) => {
    setCriteria(next);
    setPreview(undefined);
    key.current = undefined;
  };
  const loadPreview = async (page = 1, next: TemplateCriteria = criteria) => {
    setBusy(true);
    setError("");
    try {
      if (next !== criteria) setCriteria(next);
      setPreview(
        await reportTemplatesApi.preview(template.code, next, page),
      );
      setStage(1);
    } catch (error) {
      setError(reportError(error));
    } finally {
      setBusy(false);
    }
  };
  /** Column sort on the preview runs on the server: it reloads the preview with the new sort (REPORT-LIST-STANDARD-2026-10-14). */
  const sortPreview = (field: string) => {
    const direction: "asc" | "desc" = criteria.sortBy === field && criteria.direction === "asc" ? "desc" : "asc";
    void loadPreview(1, { ...criteria, sortBy: field, direction });
  };
  const generate = async (signatureToken?: string, reason?: string) => {
    setBusy(true);
    setError("");
    key.current ??= crypto.randomUUID();
    try {
      await reportsApi.createRun(
        {
          definitionCode: template.code,
          format,
          fields: criteria.fields,
          parameters: {
            ...criteria.filters,
            definitionVersion: criteria.version,
            reportTitle,
          },
          sort: [{ field: criteria.sortBy, direction: criteria.direction }],
          full,
          ...(template.runNeedsSignature ? { reason: (reason ?? "").trim(), signatureToken } : {}),
        },
        key.current,
      );
      navigate(ROUTES.REPORT.HISTORY);
    } catch (error) {
      setError(reportError(error));
    } finally {
      setBusy(false);
    }
  };
  const filter = (name: string, value: string) =>
    changeCriteria({
      ...criteria,
      filters: { ...criteria.filters, [name]: value },
    });
  return (
    <div className="flex min-w-0 flex-col gap-5">
      <PageHeader
        title="Create Report"
        breadcrumbItems={reportBreadcrumbs(navigate, "Create Report", false, {
          label: "Report Library",
          onClick: onBack,
        })}
        actions={
          <Button variant="outline-emerald" size="sm" disabled={busy} onClick={onBack}>
            Back
          </Button>
        }
      />
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          {error}
        </p>
      )}
      <WorkflowStepper steps={stages} currentStepIndex={stage} />
      <FormSection
        title={template.displayName}
        description={`Template v${template.definitionVersion}. Preview is indicative; generation creates a new server snapshot.`}
      >
        <label className="mb-5 block text-sm font-medium text-slate-700 capitalize">
          Report name <span className="text-red-600">*</span>
          <Input
            className="mt-1.5 h-9 w-full rounded-lg border border-slate-200 px-3 text-sm"
            maxLength={255}
            value={reportTitle}
            onChange={(e) => {
              setReportTitle(e.target.value);
              key.current = undefined;
            }}
          />
        </label>
        {stage === 0 && (
          <div className="grid min-w-0 gap-5 lg:grid-cols-2">
            <div className="grid min-w-0 content-start gap-4 sm:grid-cols-2">
              {template.filterFields?.map((field) =>
                field.type === "DATE" ? (
                  <DateTimePicker
                    key={field.code}
                    label={field.name}
                    showTime={false}
                    value={criteria.filters[field.code] ?? ""}
                    onChange={(value) => filter(field.code, isoDate(value))}
                  />
                ) : field.type === "LOOKUP" ? (
                  <ReportLookup
                    key={field.code}
                    code={template.code}
                    field={field.code}
                    label={field.name}
                    value={criteria.filters[field.code] ?? ""}
                    onChange={(value) => filter(field.code, value)}
                  />
                ) : field.type === "NUMBER" ? (
                  <div key={field.code}>
                    <label htmlFor={`report-filter-${field.code}`} className="mb-1.5 block text-sm font-medium text-slate-700">
                      {field.name}
                    </label>
                    <Input
                      id={`report-filter-${field.code}`}
                      type="number"
                      min={0}
                      max={3650}
                      inputMode="numeric"
                      value={criteria.filters[field.code] ?? ""}
                      onChange={(event) => filter(field.code, event.target.value)}
                    />
                  </div>
                ) : (
                  <div key={field.code} className="sm:col-span-2">
                    <label className="mb-1.5 block text-sm font-medium text-slate-700 capitalize">
                      {field.name}
                    </label>
                    <SearchInput
                      value={criteria.filters[field.code] ?? ""}
                      onChange={(value) => filter(field.code, value)}
                      placeholder={`${field.name}...`}
                    />
                  </div>
                ),
              )}
              <Select
                label="Sort by"
                value={criteria.sortBy}
                enableSearch={false}
                options={template.fields
                  .filter((field) => field.allowed)
                  .map((field) => ({ value: field.code, label: field.name }))}
                onChange={(value) =>
                  changeCriteria({ ...criteria, sortBy: String(value) })
                }
              />
              <Select
                label="Direction"
                value={criteria.direction}
                enableSearch={false}
                options={[
                  { value: "asc", label: "Ascending" },
                  { value: "desc", label: "Descending" },
                ]}
                onChange={(value) =>
                  changeCriteria({
                    ...criteria,
                    direction: value as "asc" | "desc",
                  })
                }
              />
            </div>
            <div className="space-y-4">
            <FormSection
              title="Included columns"
              description="Required columns and chart fields remain included."
            >
              <div className="grid gap-3 sm:grid-cols-2">
                {template.fields
                  .filter((field) => field.allowed)
                  .map((field) => (
                    <Checkbox
                      key={field.code}
                      label={`${field.name}${field.required ? " (required)" : ""}`}
                      checked={criteria.fields.includes(field.code)}
                      disabled={
                        field.required ||
                        template.layout?.charts?.some(
                          (c) => c.field === field.code,
                        )
                      }
                      onChange={(checked) =>
                        changeCriteria({
                          ...criteria,
                          fields: checked
                            ? [...criteria.fields, field.code]
                            : criteria.fields.filter(
                                (code) => code !== field.code,
                              ),
                        })
                      }
                    />
                  ))}
              </div>
            </FormSection>
            <FormSection
              title="Filter required"
              description="A report is run with at least one filter. To run it without one, choose Full."
            >
              <Checkbox
                label="Full report (no filter)"
                checked={full}
                onChange={(checked) => {
                  setFull(checked);
                  setPreview(undefined);
                  key.current = undefined;
                }}
              />
              <p className="mt-2 text-xs text-slate-500">
                A Full report is made in the background as CSV or XLSX when it is large, and is written to the Audit Trail.
              </p>
              {!canPreview && (
                <p role="status" className="mt-3 text-xs font-medium text-amber-700">
                  Choose at least one filter, or choose Full, to continue.
                </p>
              )}
            </FormSection>
            </div>
          </div>
        )}
        {stage === 1 && preview && (
          <div className="space-y-4">
            <p className="text-sm text-slate-500">
              {preview.pagination.total.toLocaleString()} matching records · Previewed{" "}
              {displayDateTime(preview.asOfAt)}
            </p>
            <PreviewResults
              preview={preview}
              criteria={criteria}
              busy={busy}
              onSort={sortPreview}
              onPage={(page) => void loadPreview(page)}
            />
            <p className={tooLarge ? "text-xs font-medium text-red-700" : "text-xs text-slate-500"} role={tooLarge ? "alert" : undefined}>
              {tooLarge
                ? `This result has ${total.toLocaleString()} records, more than a ${full ? "Full " : ""}report file may hold (${limit.toLocaleString()}). ${full ? "Add a filter to narrow it." : "Add a filter to narrow it, or choose Full (up to " + fullLimit.toLocaleString() + ")."} The server never silently truncates a report.`
                : `A report file holds up to ${limit.toLocaleString()} records${full ? " (Full)" : ""}. The server never silently truncates a report.${total > standardLimit ? " A result this large is made as CSV or XLSX only." : ""}`}
            </p>
          </div>
        )}
        {stage === 2 && (
          <div className="grid min-w-0 gap-5 xl:grid-cols-[18rem_minmax(0,1fr)]">
            <div className="space-y-5">
              <Select
                label="Output format"
                value={format}
                enableSearch={false}
                options={formatOptions.map((value) => ({
                  value,
                  label: value,
                }))}
                onChange={(value) => {
                  setFormat(value as ReportFormat);
                  key.current = undefined;
                }}
              />
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm leading-relaxed text-slate-600">
                The server will recheck your current role scopes and permitted
                columns, generate a versioned snapshot and record the result in
                Report History. Downloads require authentication and checksum
                verification. No source document content is included.
              </div>
              {template.runNeedsSignature && (
                <p className="text-xs text-slate-500">This report is signed electronically when you generate it. You give the reason in the signature window.</p>
              )}
            </div>
            {total > standardLimit ? (
              <div className="flex min-h-48 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-600">
                <p>
                  A page preview is not made for a result of {total.toLocaleString()} records. The file is made in the background as CSV or XLSX and listed in Report Run History when it is ready.
                </p>
              </div>
            ) : (
              <RealtimeReportPreview
                requestKey={JSON.stringify([criteria, reportTitle])}
                disabled={!reportTitle.trim()}
                load={(signal) =>
                  reportTemplatesApi.previewPdf(
                    template.code,
                    criteria,
                    reportTitle,
                    signal,
                  )
                }
              />
            )}
          </div>
        )}
        <div className="mt-6 flex flex-wrap justify-between gap-3 border-t border-slate-100 pt-5">
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() =>
              stage === 0
                ? changeCriteria({ ...criteria, filters: {} })
                : setStage(stage - 1)
            }
          >
            {stage === 0 ? "Clear Filters" : "Previous"}
          </Button>
          {stage === 0 ? (
            <Button size="sm" loading={busy} disabled={!canPreview} onClick={() => void loadPreview()}>
              Preview Report
            </Button>
          ) : stage === 1 ? (
            <Button
              size="sm"
              disabled={busy || !preview || tooLarge}
              onClick={() => {
                if (!formatOptions.includes(format)) setFormat(formatOptions[0] ?? format);
                setStage(2);
              }}
            >
              Continue to Output
            </Button>
          ) : (
            <Button
              size="sm"
              loading={busy}
              disabled={!reportTitle.trim()}
              onClick={() => (template.runNeedsSignature ? setSigning(true) : void generate())}
            >
              {template.runNeedsSignature ? "Sign And Generate Report" : "Generate Report"}
            </Button>
          )}
        </div>
      </FormSection>
      {template.runNeedsSignature && (
        <ESignatureModal
          isOpen={signing}
          onClose={() => setSigning(false)}
          deferConfirm
          onConfirm={(data) => {
            setSigning(false);
            void generate(data.signatureToken, data.reason);
          }}
          actionTitle="Generate Report"
          meaningDisplayName="Report Run Requested"
          meaningCode="REPORT_RUN_REQUESTED"
          targetDetails={{ code: template.code, title: reportTitle }}
        />
      )}
    </div>
  );
}
