import { tr, trFormat } from "@/i18n";
import { Input } from "@/components/ui/form/ResponsiveForm";
import { Button } from "@/components/ui/button/Button";
import { Select } from "@/components/ui/select";
import { ReportChartPreview } from "./ReportChartPreview";
import { REPORT_CHART_TYPES, isTrendChart, type ReportChart } from "@/services/api/reportTemplates";

const input =
  "h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500";

const MOST_CHARTS = 6;

/**
 * The analysis charts of a report template: each is one page of the PDF and one sheet of the XLSX. The server counts the authorized records and draws the chart with
 * Chart.js; the browser draws none (REPORT-CHARTJS-2026-11-15); nobody types a formula. How a chart
 * looks (font, colours, page) is the company appearance of Report Properties, so only what it shows is chosen here.
 */
export function ReportChartsEditor({
  charts,
  fields,
  disabled,
  font,
  onChange,
}: {
  charts: ReportChart[];
  /** The font of the report, so that the preview is drawn in it. */
  font?: string | null;
  fields: Array<{ code: string; name: string; type?: string }>;
  disabled: boolean;
  onChange: (charts: ReportChart[]) => void;
}) {
  const change = (index: number, patch: Partial<ReportChart>) => onChange(charts.map((chart, i) => (i === index ? { ...chart, ...patch } : chart)));
  const dateFields = fields.filter((f) => f.type === "DATE");
  return (
    <fieldset disabled={disabled} className="min-w-0 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-800">{tr("Analysis charts")}</h3>
        <Button
          size="sm"
          variant="outline-emerald"
          disabled={!fields.length || charts.length >= MOST_CHARTS}
          onClick={() =>
            onChange([
              ...charts,
              {
                title: `Records by ${fields.find((f) => f.code === "status")?.name ?? fields[0].name}`,
                type: "BAR",
                field: fields.find((f) => f.code === "status")?.code ?? fields[0].code,
                metric: "COUNT",
              },
            ])
          }
        >
          {tr("Add chart")}
        </Button>
      </div>
      <div className="space-y-2 text-xs text-slate-500">
        <ol className="list-inside list-decimal space-y-1">
          <li>{tr("Choose a chart type.")}</li>
          <li>{tr("Choose what to group records by.")}</li>
          <li>{tr("Choose counts or percentages.")}</li>
        </ol>
        <p>{trFormat("Each chart appears on its own PDF page (after the cover, when there is one) and on its own sheet of an XLSX, up to {max}. A CSV has no chart. A generated report calculates and draws the charts on the server from the records the person may see.", { max: MOST_CHARTS })}</p>
      </div>
      {charts.length === 0 && <p className="rounded-lg border border-dashed border-slate-200 p-4 text-center text-sm text-slate-500">{tr("This template has no charts.")}</p>}
      {charts.map((chart, index) => (
        <div key={index} className="space-y-3 border-t border-slate-100 pt-4">
          <label className="block space-y-1.5 text-sm text-slate-700">
            <span>{tr("Chart title")}</span>
            <Input className={input} maxLength={100} value={chart.title} onChange={(e) => change(index, { title: e.target.value })} />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <Select
              label={tr("Chart type")}
              value={chart.type}
              // A trend by month is offered only when the source has a date field.
              options={REPORT_CHART_TYPES.filter((option) => dateFields.length > 0 || !isTrendChart(option.value)).map(({ value, label }) => ({ value, label }))}
              enableSearch={false}
              onChange={(type) =>
                change(index, {
                  type: type as ReportChart["type"],
                  ...(isTrendChart(type as ReportChart["type"]) && !dateFields.some((f) => f.code === chart.field) && dateFields.length ? { field: dateFields[0].code } : {}),
                })
              }
            />
            <Select
              label="Group by"
              value={chart.field}
              options={fields.filter((f) => !isTrendChart(chart.type) || f.type === "DATE").map((f) => ({ value: f.code, label: f.name }))}
              onChange={(field) => change(index, { field: String(field) })}
            />
            {!isTrendChart(chart.type) && (
              <Select
                label={tr("Most groups shown")}
                value={String(chart.maxGroups ?? 20)}
                options={[5, 10, 15, 20].map((n) => ({ value: String(n), label: String(n) }))}
                enableSearch={false}
                onChange={(n) => change(index, { maxGroups: Number(n) })}
              />
            )}
            <Select
              label={tr("Metric")}
              value={chart.metric}
              options={[
                { value: "COUNT", label: tr("Number of records") },
                { value: "PERCENT", label: tr("Share of all records (%)") },
              ]}
              enableSearch={false}
              onChange={(metric) => change(index, { metric: metric as ReportChart["metric"] })}
            />
          </div>
          <p className="text-xs text-slate-500">
            {isTrendChart(chart.type)
              ? tr("Dates are grouped by month. Choose a date field.")
              : trFormat("Count records with the same {field}.", { field: fields.find((f) => f.code === chart.field)?.name ?? tr("field value") })}{" "}
            {chart.metric === "PERCENT" ? tr("All categories total 100%.") : tr("No sums or user formulas are required.")}
            {!isTrendChart(chart.type) ? ` ${tr('When there are more groups than the number shown, the others are added together as one "Other" bar that says how many groups it holds.')}` : ""}
          </p>
          <ReportChartPreview chart={chart} fieldName={fields.find((f) => f.code === chart.field)?.name ?? "Group"} font={font} />
          <Button size="sm" variant="outline-emerald" onClick={() => onChange(charts.filter((_, i) => i !== index))}>
            {tr("Remove chart")}
          </Button>
        </div>
      ))}
    </fieldset>
  );
}
