import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button/Button";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { Radio } from "@/components/ui/radio/Radio";
import { Checkbox } from "@/components/ui/checkbox/Checkbox";
import { Select } from "@/components/ui/select/Select";
import { Badge } from "@/components/ui/badge/Badge";
import { cn } from "@/components/ui/utils";
import { BackupCopyNotice } from "../shared/BackupCopyNotice";
import { ReportFieldFilters } from "../shared/ReportFieldFilters";
import { CORE_GROUP, DEFAULT_MAX_COLUMNS, fieldMatches, groupNames } from "../shared/reportFieldCatalog";
import { SearchInput } from "@/components/ui/form/SearchInput";
import { DateTimePicker } from "@/components/ui/datetime-picker/DateTimePicker";
import { WorkflowStepper } from "@/components/ui/workflow-stepper/WorkflowStepper";
import { Input } from "@/components/ui/form/ResponsiveForm";
import { AlertModal } from "@/components/ui/modal/AlertModal";
import { ESignatureModal } from "@/components/ui/esign-modal/ESignatureModal";
import { DataTable, type DataTableColumn } from "@/components/ui/table/DataTable";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { useTableDragScroll } from "@/hooks/useTableDragScroll";
import { reportsApi, type ReportFormat } from "@/services/api/reports";
import {
  reportTemplatesApi,
  reportError,
  type ReportTemplate,
  type TemplateCriteria,
  type TemplateFilter,
  type TemplatePreview,
} from "@/services/api/reportTemplates";
import { ROUTES } from "@/app/routes.constants";
import { ReportLookup } from "./ReportLookup";
import { DateRangePicker } from "@/components/ui/datetime-picker/DateRangePicker";
import { RealtimeReportPreview } from "../shared/RealtimeReportPreview";
import { ReportFilePreview } from "../shared/ReportFilePreview";
import { reportBreadcrumbs } from "../shared/reportBreadcrumbs";
import { tr } from "@/i18n";

const stages = ["Criteria", "Preview", "Output"];
function isoDate(value: string): string {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : value;
}
/** yyyy-MM-dd (how a date filter is stored and sent) to dd/MM/yyyy (how the date pickers show it). */
function pickerDate(value: string): string {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
}
/** "Created from" and "Created to" are one period: the label of the pair, "Created Date Range", comes from the name of the first. */
function rangeLabel(from: TemplateFilter, base: string): string {
  const named = /^(.*\S)\s+from$/i.exec(from.name.trim());
  const subject = named ? named[1] : base.replace(/([A-Z])/g, " $1");
  return `${subject.charAt(0).toUpperCase()}${subject.slice(1)} Date Range`;
}
type FilterItem = { kind: "field"; field: TemplateFilter } | { kind: "range"; from: TemplateFilter; to: TemplateFilter; label: string };
/** The filters of a template, with each pair of dates (xFrom and xTo) merged into one range field. */
function filterItemsOf(fields: TemplateFilter[]): FilterItem[] {
  const items: FilterItem[] = [];
  const used = new Set<string>();
  for (const field of fields) {
    if (used.has(field.code)) continue;
    if (field.type === "DATE" && field.code.endsWith("From")) {
      const base = field.code.slice(0, -4);
      const to = fields.find((other) => other.type === "DATE" && other.code === `${base}To`);
      if (to) {
        used.add(field.code);
        used.add(to.code);
        items.push({ kind: "range", from: field, to, label: rangeLabel(field, base) });
        continue;
      }
    }
    items.push({ kind: "field", field });
  }
  return items;
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
  // The number of a row counts through the pages of the preview (10 to a page).
  const withNumber: DataTableColumn<string[]>[] = [
    { id: "no", header: "No.", locked: true, cell: (_row: string[], index: number) => (preview.pagination.page - 1) * 10 + index + 1 },
    ...columns,
  ];
  return (
    <>
      <DataTable
        rows={preview.rows.slice(1)}
        columns={withNumber}
        getRowKey={(_row, index) => index}
        scrollerRef={drag.scrollerRef}
        scrollProps={drag.dragEvents}
        isDragging={drag.isDragging}
        isLoading={busy}
        loadingContent={<SectionLoading text="Loading preview..." />}
        emptyState={<TableEmptyState title="No Records Found" description={tr("No record matches the criteria. Go back and change the filters to continue.")} />}
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

const withRequiredMark = (name: string, required: boolean) => (required ? <>{name} <span className="text-red-600">*</span></> : name);

export function ReportTemplateRun({
  template,
  onBack,
  initialFilters,
}: {
  template: ReportTemplate;
  onBack: () => void;
  /** Filters to start with (a screen that sends the person here, such as Access Explorer, fills them in). */
  initialFilters?: Record<string, string>;
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
    filters: { ...(initialFilters ?? {}) },
    sortBy: template.fields.find((field) => field.allowed)?.code ?? "",
    direction: "asc",
  });
  const [preview, setPreview] = useState<TemplatePreview>();
  const [format, setFormat] = useState<ReportFormat>(
    template.allowedFormats[0],
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [columnSearch, setColumnSearch] = useState("");
  const [columnGroup, setColumnGroup] = useState("");
  /** The choice to run without a filter (REPORT-FULL-RUN-2026-11-12). */
  const [full, setFull] = useState(false);
  const key = useRef<string | undefined>(undefined);
  /** A run of the Audit Trail report is signed; the reason is the one given in the signature window (REPORT-RUN-SIGNATURE-2026-11-12). */
  const [signing, setSigning] = useState(false);
  const narrowed = (template.filterFields ?? []).some((field) => (criteria.filters[field.code] ?? "").trim() !== "");
  /** A filter the report cannot be made without (the server says which): both dates of the Audit Trail report, for example. */
  const requiredFiltersMissing = (template.filterFields ?? []).some((field) => field.required === "true" && (criteria.filters[field.code] ?? "").trim() === "");
  const columnsInvalid = criteria.fields.length === 0 || criteria.fields.length > DEFAULT_MAX_COLUMNS;
  const canPreview = (narrowed || full) && !requiredFiltersMissing && !columnsInvalid;
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
  const filterFields = template.filterFields ?? [];
  const filterItems = filterItemsOf(filterFields);
  const columnFields = template.fields.filter((field) => field.allowed && fieldMatches(field.name, field.group ?? CORE_GROUP, columnSearch, columnGroup));
  const chooseScope = (isFull: boolean) => {
    setFull(isFull);
    setPreview(undefined);
    key.current = undefined;
  };
  /** Back, the previous step and the button of this step: shown in the header and again at the bottom of the page. */
  const actionButtons = (
    <>
      <Button variant="outline-emerald" size="sm" disabled={busy} onClick={onBack}>
        Back
      </Button>
      {stage > 0 && (
        <Button variant="outline-emerald" size="sm" disabled={busy} onClick={() => setStage(stage - 1)}>
          Previous
        </Button>
      )}
      {stage === 0 ? (
        <Button size="sm" variant="outline-emerald" loading={busy} disabled={!canPreview} onClick={() => void loadPreview()}>
          Preview Report
        </Button>
      ) : stage === 1 ? (
        <Button
          size="sm"
          variant="outline-emerald"
          disabled={busy || !preview || tooLarge || total === 0}
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
          {template.runNeedsSignature ? tr("Sign And Generate Report") : "Generate Report"}
        </Button>
      )}
    </>
  );
  return (
    <div className="flex min-w-0 flex-col gap-4 md:gap-6">
      <PageHeader
        title="Create Report"
        breadcrumbItems={reportBreadcrumbs(navigate, "Create Report", false, {
          label: tr("Report Library"),
          onClick: onBack,
        })}
        actions={actionButtons}
      />
      {template.sourceCode === "BACKUP_RUNS" && <BackupCopyNotice />}
      {/* The steps stand on their own above the form. */}
      <WorkflowStepper steps={stages} currentStepIndex={stage} numbered />
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="min-w-0 p-4 md:p-5">
          {stage === 0 && (
            <div className="space-y-6">
              <section aria-labelledby="report-scope-title">
                <h3 id="report-scope-title" className="mb-2 text-sm font-semibold text-slate-900">
                  Scope
                </h3>
                <div role="radiogroup" aria-labelledby="report-scope-title" className="grid gap-3 sm:grid-cols-2">
                  <Radio
                    variant="card"
                    name="report-scope"
                    value="filtered"
                    checked={!full}
                    onChange={() => chooseScope(false)}
                    label="Filtered"
                    description={tr("Narrow the report with at least one filter.")}
                  />
                  <Radio
                    variant="card"
                    name="report-scope"
                    value="full"
                    checked={full}
                    onChange={() => chooseScope(true)}
                    label={tr("Full report (no filter)")}
                    description={tr("Made in the background as CSV or XLSX when it is large, and written to the Audit Trail.")}
                  />
                </div>
              </section>

              <section aria-labelledby="report-filters-title">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h3 id="report-filters-title" className="text-sm font-semibold text-slate-900">
                    Filters and sort
                  </h3>
                  <Button variant="outline" size="sm" disabled={busy || !narrowed} onClick={() => changeCriteria({ ...criteria, filters: {} })}>
                    Clear Filters
                  </Button>
                </div>
                <div className="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {filterItems.map((item) =>
                    item.kind === "range" ? (
                      <DateRangePicker
                        key={item.from.code}
                        label={withRequiredMark(item.label, item.from.required === "true" || item.to.required === "true")}
                        startDate={pickerDate(criteria.filters[item.from.code] ?? "")}
                        endDate={pickerDate(criteria.filters[item.to.code] ?? "")}
                        placeholder={tr("Select date range")}
                        onStartDateChange={() => undefined}
                        onEndDateChange={() => undefined}
                        onApply={({ startDate, endDate }) =>
                          changeCriteria({
                            ...criteria,
                            filters: { ...criteria.filters, [item.from.code]: isoDate(startDate), [item.to.code]: isoDate(endDate) },
                          })
                        }
                      />
                    ) : ((field) => field.type === "DATE" ? (
                      <DateTimePicker
                        key={field.code}
                        label={withRequiredMark(field.name, field.required === "true")}
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
                        required={field.required === "true"}
                        value={criteria.filters[field.code] ?? ""}
                        onChange={(value) => filter(field.code, value)}
                      />
                    ) : field.type === "NUMBER" ? (
                      <div key={field.code}>
                        <label htmlFor={`report-filter-${field.code}`} className="mb-1.5 block text-sm font-medium text-slate-700">
                          {withRequiredMark(field.name, field.required === "true")}
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
                      <div key={field.code}>
                        <label className="mb-1.5 block text-sm font-medium text-slate-700 capitalize">{withRequiredMark(field.name, field.required === "true")}</label>
                        <SearchInput
                          value={criteria.filters[field.code] ?? ""}
                          onChange={(value) => filter(field.code, value)}
                          placeholder={`${field.name}...`}
                        />
                      </div>
                    ))(item.field),
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
                      { value: "desc", label: tr("Descending") },
                    ]}
                    onChange={(value) =>
                      changeCriteria({
                        ...criteria,
                        direction: value as "asc" | "desc",
                      })
                    }
                  />
                </div>
              </section>

              <section aria-labelledby="report-columns-title" className="border-t border-slate-200 pt-5">
                <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                  <h3 id="report-columns-title" className="text-sm font-semibold text-slate-900">
                    Included columns
                  </h3>
                  <p className={cn("text-xs", criteria.fields.length > DEFAULT_MAX_COLUMNS ? "font-medium text-red-600" : "text-slate-500")} aria-live="polite">
                    {criteria.fields.length} of {DEFAULT_MAX_COLUMNS} columns included
                  </p>
                </div>
                <p className="mb-3 text-xs text-slate-500">Required columns and chart fields remain included. A report carries at most {DEFAULT_MAX_COLUMNS} columns.</p>
                <div className="space-y-3">
                  <ReportFieldFilters
                    narrow
                    search={columnSearch}
                    onSearchChange={setColumnSearch}
                    group={columnGroup}
                    onGroupChange={setColumnGroup}
                    groups={groupNames(template.fields.filter((field) => field.allowed).map((field) => field.group ?? CORE_GROUP))}
                  />
                  <div className="grid max-h-80 gap-3 overflow-y-auto rounded-lg border border-slate-200 p-3 sm:grid-cols-2 xl:grid-cols-3">
                    {columnFields.length === 0 && <p className="text-sm text-slate-500 sm:col-span-2 xl:col-span-3">No column matches the search.</p>}
                    {columnFields.map((field) => (
                      <div key={field.code} className="flex min-w-0 flex-wrap items-center gap-2">
                        <Checkbox
                          label={`${field.name}${field.required ? " (required)" : ""}`}
                          checked={criteria.fields.includes(field.code)}
                          disabled={
                            field.required ||
                            template.layout?.charts?.some((c) => c.field === field.code) ||
                            (!criteria.fields.includes(field.code) && criteria.fields.length >= DEFAULT_MAX_COLUMNS)
                          }
                          onChange={(checked) =>
                            changeCriteria({
                              ...criteria,
                              fields: checked
                                ? [...criteria.fields, field.code]
                                : criteria.fields.filter((code) => code !== field.code),
                            })
                          }
                        />
                        {field.sensitive && <Badge color="amber">Sensitive</Badge>}
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            </div>
          )}

          {stage === 1 && preview && (
            <div className="space-y-4">
              {/* Only a result too large for one report file is said here: it is the reason Continue to Output is disabled. */}
              {tooLarge && (
                <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700 sm:text-sm" role="alert">
                  {`This result has ${total.toLocaleString()} records, more than a ${full ? "Full " : ""}report file may hold (${limit.toLocaleString()}). ${full ? "Add a filter to narrow it." : "Add a filter to narrow it, or choose Full (up to " + fullLimit.toLocaleString() + ")."} The server never silently truncates a report.`}
                </p>
              )}
              <PreviewResults
                preview={preview}
                criteria={criteria}
                busy={busy}
                onSort={sortPreview}
                onPage={(page) => void loadPreview(page)}
              />
            </div>
          )}

          {stage === 2 && (
            <div className="grid min-w-0 gap-5 xl:grid-cols-[20rem_minmax(0,1fr)]">
              <div className="space-y-4">
                <label className="block text-sm font-medium text-slate-700">
                  {tr("Generated Report Name")} <span className="text-red-600">*</span>
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
                <p className="text-xs text-slate-500">
                  The report is made from your current access and is listed in Report Run History when it is ready.
                  {template.runNeedsSignature ? " It is signed electronically when you generate it; you give the reason in the signature window." : ""}
                </p>
              </div>
              {format === "CSV" || format === "XLSX" ? (
                <ReportFilePreview code={template.code} criteria={criteria} title={reportTitle} format={format} full={full} disabled={!reportTitle.trim()} />
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
        </div>

      </div>
      {/* Footer actions: the same buttons again at the bottom of the page, as on Document Details (a plain row, no frame). */}
      <div className="flex flex-wrap items-center gap-2 md:gap-3">{actionButtons}</div>
      {/* What the server refuses (a period that is too long, a limit, a lost right) is said in a window, not in a line above the form. */}
      <AlertModal isOpen={!!error} onClose={() => setError("")} onConfirm={() => setError("")} type="error" title="Cannot Create Report" description={error} />
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
