import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { IconColumns3, IconFilter, IconId, IconInfoCircle, IconLock } from "@tabler/icons-react";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { Button } from "@/components/ui/button/Button";
import { Badge } from "@/components/ui/badge/Badge";
import { FormSection } from "@/components/ui/form/FormSection";
import { FormField } from "@/components/ui/form/ResponsiveForm";
import { ReadOnlyField } from "@/components/ui/form/ReadOnlyField";
import { DataTable, type DataTableColumn } from "@/components/ui/table/DataTable";
import { reportError } from "@/services/api/reportTemplates";
import { reportTypesApi, type ReportTypeDetail } from "@/services/api/reportTypes";
import { reportBreadcrumbs } from "../shared/reportBreadcrumbs";
import { tr, trFormat } from "@/i18n";

type Column = ReportTypeDetail["columns"][number];
type Filter = ReportTypeDetail["filters"][number];

const TYPE_TEXT: Record<string, string> = { TEXT: "Text", DATE: "Date", LOOKUP: "List" };
const code = (value: string) => (
  <span translate="no" className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-700">
    {value}
  </span>
);

const columnColumns: DataTableColumn<Column>[] = [
  { id: "no", header: "No.", label: "No.", locked: true, cell: (_column, index) => index + 1 },
  { id: "label", header: "Column", label: "Column", cell: (column) => <span className="font-medium text-slate-900">{column.label}</span> },
  { id: "code", header: "Code", label: "Code", cell: (column) => code(column.code) },
  { id: "type", header: "Type", label: "Type", cell: (column) => TYPE_TEXT[column.type] ?? column.type },
  { id: "required", header: tr("In every report"), label: tr("In every report"), cell: (column) => (column.required ? <Badge color="emerald">{tr("Yes")}</Badge> : <Badge color="slate">{tr("No")}</Badge>) },
];
const filterColumns: DataTableColumn<Filter>[] = [
  { id: "label", header: "Filter", label: "Filter", cell: (filter) => <span className="font-medium text-slate-900">{filter.label}</span> },
  { id: "code", header: "Code", label: "Code", cell: (filter) => code(filter.code) },
  { id: "type", header: "Type", label: "Type", cell: (filter) => TYPE_TEXT[filter.type] ?? filter.type },
];

/**
 * One Report Type, read only: the data a report can be made from (its name, code and category), who may use it, and the columns and filters that a report template built on it
 * can choose from. Enable and Disable are in the list of Report Types.
 */
export const ReportTypeDetailView: React.FC = () => {
  const navigate = useNavigate();
  const { code: typeCode = "" } = useParams();
  const [detail, setDetail] = React.useState<ReportTypeDetail | null>(null);
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(() => {
    setLoading(true);
    setError("");
    reportTypesApi
      .detail(typeCode)
      .then(setDetail)
      .catch((e) => setError(reportError(e)))
      .finally(() => setLoading(false));
  }, [typeCode]);
  React.useEffect(load, [load]);

  const title = "Report Type Details";
  const noOwnPermission = !!detail && detail.usePermissions.length === 0 && detail.requiredPermissions.length === 0;
  return (
    <div className="space-y-4 md:space-y-6 w-full flex-1 flex flex-col">
      <PageHeader
        title={title}
        breadcrumbItems={reportBreadcrumbs(navigate, title, true, { label: tr("Report Types"), onClick: () => navigate("/settings/report-types") })}
        actions={
          <Button size="sm" variant="outline-emerald" className="whitespace-nowrap" onClick={() => navigate("/settings/report-types")}>
            {tr("Back")}
          </Button>
        }
      />
      {loading && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <SectionLoading text="Loading report type..." />
        </div>
      )}
      {!loading && error && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-8 text-center">
          <p role="alert" className="text-sm font-medium text-amber-800">{error}</p>
          <Button size="sm" variant="outline" onClick={load}>{tr("Retry")}</Button>
        </div>
      )}
      {!loading && !error && detail && (
        <>
          <FormSection
            title={tr("General Information")}
            icon={<IconInfoCircle className="h-4 w-4" />}
            headerRight={detail.enabled ? <Badge color="emerald">{tr("Enabled")}</Badge> : <Badge color="slate">{tr("Disabled")}</Badge>}
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              <FormField label={tr("Report Type Name")}>
                <ReadOnlyField value={detail.name} />
              </FormField>
              <FormField label={tr("Report Type Code")}>
                <ReadOnlyField value={detail.code} className="font-mono text-xs" />
              </FormField>
              <FormField label={tr("Report Type Category")}>
                <ReadOnlyField value={detail.category} />
              </FormField>
              <FormField label={tr("Report Templates")}>
                <ReadOnlyField value={detail.templateCount} />
              </FormField>
              <div className="md:col-span-2 lg:col-span-4">
                <FormField label={tr("Description")}>
                  <p className="min-h-9 rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700">{detail.description || "—"}</p>
                </FormField>
              </div>
            </div>
          </FormSection>

          <FormSection title={tr("Access")} icon={<IconLock className="h-4 w-4" />}>
            {noOwnPermission ? (
              <p className="text-sm text-slate-600">{tr("This type needs no permission of its own: the data scope of each report template decides what a person sees.")}</p>
            ) : (
              <div className="space-y-3">
                {detail.requiredPermissions.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-medium text-slate-500 sm:text-sm">{tr("Needs all of")}</span>
                    {detail.requiredPermissions.map((permission) => code(permission))}
                  </div>
                )}
                {detail.usePermissions.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-medium text-slate-500 sm:text-sm">{tr("Needs one of")}</span>
                    {detail.usePermissions.map((permission) => code(permission))}
                  </div>
                )}
              </div>
            )}
          </FormSection>

          <div className="space-y-4 md:space-y-6">
            <FormSection title={tr("Columns")} icon={<IconColumns3 className="h-4 w-4" />} description={trFormat("{count} columns a report can show", { count: detail.columns.length })}>
              <DataTable rows={detail.columns} getRowKey={(column) => column.code} columns={columnColumns} />
            </FormSection>
            <FormSection title={tr("Filters")} icon={<IconFilter className="h-4 w-4" />} description={trFormat("{count} filters a report can use", { count: detail.filters.length })}>
              <DataTable rows={detail.filters} getRowKey={(filter) => filter.code} columns={filterColumns} />
            </FormSection>
          </div>
        </>
      )}
    </div>
  );
};
