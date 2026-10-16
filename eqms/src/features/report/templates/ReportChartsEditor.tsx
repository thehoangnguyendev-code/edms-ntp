import { Input } from "@/components/ui/form/ResponsiveForm";
import { Button } from "@/components/ui/button/Button";
import { Select } from "@/components/ui/select";
import type { ReportChart } from "@/services/api/reportTemplates";

const input =
  "h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500";

const MOST_CHARTS = 6;

/**
 * The analysis charts of a report template: each is one page of the PDF. The server counts the authorized records; nobody types a formula. How a chart
 * looks (font, colours, page) is the company appearance of Report Properties, so only what it shows is chosen here.
 */
export function ReportChartsEditor({
  charts,
  fields,
  disabled,
  onChange,
}: {
  charts: ReportChart[];
  fields: Array<{ code: string; name: string; type?: string }>;
  disabled: boolean;
  onChange: (charts: ReportChart[]) => void;
}) {
  const change = (index: number, patch: Partial<ReportChart>) => onChange(charts.map((chart, i) => (i === index ? { ...chart, ...patch } : chart)));
  const dateFields = fields.filter((f) => f.type === "DATE");
  return (
    <fieldset disabled={disabled} className="min-w-0 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-800">Analysis charts</h3>
        <Button
          size="sm"
          variant="default"
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
          Add chart
        </Button>
      </div>
      <div className="space-y-2 text-xs text-slate-500">
        <ol className="list-inside list-decimal space-y-1">
          <li>Choose a chart type.</li>
          <li>Choose what to group records by.</li>
          <li>Choose counts or percentages.</li>
        </ol>
        <p>Each chart appears on its own PDF page, up to {MOST_CHARTS}. A generated report calculates the charts on the server from the records the person may see.</p>
      </div>
      {charts.length === 0 && <p className="rounded-lg border border-dashed border-slate-200 p-4 text-center text-sm text-slate-500">This template has no charts.</p>}
      {charts.map((chart, index) => (
        <div key={index} className="space-y-3 border-t border-slate-100 pt-4">
          <label className="block space-y-1.5 text-sm text-slate-700">
            <span>Chart title</span>
            <Input className={input} maxLength={100} value={chart.title} onChange={(e) => change(index, { title: e.target.value })} />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <Select
              label="Chart type"
              value={chart.type}
              options={[
                { value: "BAR", label: "Column" },
                { value: "PIE", label: "Pie" },
                ...(dateFields.length ? [{ value: "LINE", label: "Monthly trend" }] : []),
              ]}
              enableSearch={false}
              onChange={(type) =>
                change(index, {
                  type: type as ReportChart["type"],
                  ...(type === "LINE" && !dateFields.some((f) => f.code === chart.field) && dateFields.length ? { field: dateFields[0].code } : {}),
                })
              }
            />
            <Select
              label="Group by"
              value={chart.field}
              options={fields.filter((f) => chart.type !== "LINE" || f.type === "DATE").map((f) => ({ value: f.code, label: f.name }))}
              onChange={(field) => change(index, { field: String(field) })}
            />
            {chart.type !== "LINE" && (
              <Select
                label="Most groups shown"
                value={String(chart.maxGroups ?? 20)}
                options={[5, 10, 15, 20].map((n) => ({ value: String(n), label: String(n) }))}
                enableSearch={false}
                onChange={(n) => change(index, { maxGroups: Number(n) })}
              />
            )}
            <Select
              label="Metric"
              value={chart.metric}
              options={[
                { value: "COUNT", label: "Number of records" },
                { value: "PERCENT", label: "Share of all records (%)" },
              ]}
              enableSearch={false}
              onChange={(metric) => change(index, { metric: metric as ReportChart["metric"] })}
            />
          </div>
          <p className="text-xs text-slate-500">
            {chart.type === "LINE"
              ? "Dates are grouped by month. Choose a date field."
              : `Count records with the same ${fields.find((f) => f.code === chart.field)?.name ?? "field value"}.`}{" "}
            {chart.metric === "PERCENT" ? "All categories total 100%." : "No sums or user formulas are required."}
            {chart.type !== "LINE" ? ' When there are more groups than the number shown, the others are added together as one "Other" bar that says how many groups it holds.' : ""}
          </p>
          <Button size="sm" variant="outline-emerald" onClick={() => onChange(charts.filter((_, i) => i !== index))}>
            Remove chart
          </Button>
        </div>
      ))}
    </fieldset>
  );
}
