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
  const key = useRef<string | undefined>(undefined);
  const drag = useTableDragScroll();
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
  const previewSort = (index: number) => {
    const field = criteria.fields[index];
    const direction: "asc" | "desc" = criteria.sortBy === field && criteria.direction === "asc" ? "desc" : "asc";
    return {
      direction: criteria.sortBy === field ? criteria.direction : undefined,
      onSort: (): void => {
        void loadPreview(1, { ...criteria, sortBy: field, direction });
      },
    };
  };
  const previewColumns: DataTableColumn<string[]>[] = (preview?.rows[0] ?? []).map((name, index) => ({
    id: String(index),
    header: name,
    sort: previewSort(index),
    cell: (row: string[]) => row[index],
  }));
  const { layout: previewLayout, control: previewControl } = useCustomColumnLayout("reportRunPreview", previewColumns);
  const generate = async () => {
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
          <Button variant="outline" size="sm" disabled={busy} onClick={onBack}>
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
        <label className="mb-5 block text-sm font-medium text-slate-700">
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
                ) : (
                  <div key={field.code} className="sm:col-span-2">
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      {field.name}
                    </label>
                    <SearchInput
                      value={criteria.filters[field.code] ?? ""}
                      onChange={(value) => filter(field.code, value)}
                      placeholder="Search documents..."
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
          </div>
        )}
        {stage === 1 && preview && (
          <div className="space-y-4">
            <p className="text-sm text-slate-500">
              {preview.pagination.total} matching records · Previewed{" "}
              {displayDateTime(preview.asOfAt)}
            </p>
            <div className="flex justify-end">{previewControl}</div>
            <DataTable
              rows={preview.rows.slice(1)}
              columns={previewColumns}
              columnLayout={previewLayout}
              getRowKey={(_row, index) => index}
              scrollerRef={drag.scrollerRef}
              scrollProps={drag.dragEvents}
              isDragging={drag.isDragging}
              isLoading={busy}
              loadingContent={
                <p className="p-6 text-sm text-slate-500">Loading preview…</p>
              }
              pagination={
                <TablePagination
                  currentPage={preview.pagination.page}
                  totalPages={preview.pagination.totalPages}
                  totalItems={preview.pagination.total}
                  itemsPerPage={10}
                  onPageChange={(page) => void loadPreview(page)}
                  showItemsPerPageSelector={false}
                />
              }
            />
            <p className="text-xs text-slate-500">
              Export is limited to 10,000 records. Narrow criteria if the result
              exceeds this limit; the server never silently truncates it.
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
                options={template.allowedFormats.map((value) => ({
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
            </div>
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
            <Button size="sm" loading={busy} onClick={() => void loadPreview()}>
              Preview Report
            </Button>
          ) : stage === 1 ? (
            <Button
              size="sm"
              disabled={busy || !preview}
              onClick={() => setStage(2)}
            >
              Continue to Output
            </Button>
          ) : (
            <Button
              size="sm"
              loading={busy}
              disabled={!reportTitle.trim()}
              onClick={() => void generate()}
            >
              Generate Report
            </Button>
          )}
        </div>
      </FormSection>
    </div>
  );
}
