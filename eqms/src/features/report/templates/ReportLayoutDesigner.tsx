import { lazy, Suspense, useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/form/ResponsiveForm";
import { FormSection } from "@/components/ui/form/FormSection";
import { TabNav } from "@/components/ui/tabs/TabNav";
const ReportMarkCanvas = lazy(() =>
  import("./ReportMarkCanvas").then((module) => ({
    default: module.ReportMarkCanvas,
  })),
);
import { Button } from "@/components/ui/button/Button";
import { Checkbox } from "@/components/ui/checkbox/Checkbox";
import { Select } from "@/components/ui/select";
import { Popover } from "@/components/ui/popover";
import { ColorPickerInput } from "@/components/ui/color-picker/ColorPickerInput";
import { MarkCard } from "@/features/settings/document-administration/controlled-copies-policy/MarkingEditors";
import {
  defaultReportMark,
  reportTemplatesApi,
  reportError,
  type ReportLayout,
  type ReportMark,
  type ReportChart,
} from "@/services/api/reportTemplates";

const input =
  "h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500";
const tokens = [
  {
    code: "report.title",
    name: "Report name",
    example: "Document Status Report",
  },
  { code: "report.code", name: "Template code", example: "DOCUMENT_STATUS" },
  { code: "template.version", name: "Template version", example: "2" },
  {
    code: "report.executor",
    name: "Prepared by",
    example: "Name of the user generating the report",
  },
  {
    code: "report.generatedAt",
    name: "Generation time",
    example: "Server date and time (UTC)",
  },
  {
    code: "report.asOfAt",
    name: "Data snapshot time",
    example: "Server date and time (UTC)",
  },
  {
    code: "page.number",
    name: "Page number",
    example: "Current PDF page. Use text settings, not uploaded Word.",
  },
  {
    code: "page.total",
    name: "Total pages",
    example: "Total PDF pages. Use text settings, not uploaded Word.",
  },
];
const pageOptions = [
  { value: "ALL", label: "Every page" },
  { value: "FIRST", label: "First page only" },
];
const fonts = [
  { value: "NOTO_SANS", label: "Noto Sans" },
  { value: "NOTO_SERIF", label: "Noto Serif" },
  { value: "ROBOTO_MONO", label: "Roboto Mono" },
  { value: "OSWALD", label: "Oswald" },
];
function NumberField({
  label,
  value,
  onChange,
  min = 0,
  max = 100,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <label className="block space-y-1.5 text-sm text-slate-700">
      <span>{label}</span>
      <Input
        className={input}
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => {
          if (e.target.value !== "" && Number.isFinite(Number(e.target.value)))
            onChange(Number(e.target.value));
        }}
      />
    </label>
  );
}
function MarkEditor({
  value,
  onChange,
}: {
  value: ReportMark;
  onChange: (value: ReportMark) => void;
}) {
  const patch = (p: Partial<ReportMark>) => onChange({ ...value, ...p });
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="space-y-1.5 text-sm text-slate-700">
        <span>Color</span>
        <ColorPickerInput
          value={value.color}
          onChange={(color) => patch({ color })}
        />
      </label>
      <Select
        label="Font"
        value={value.font}
        options={fonts}
        enableSearch={false}
        onChange={(font) => patch({ font: font as ReportMark["font"] })}
      />
      <NumberField
        label="Opacity (%)"
        value={value.opacity}
        min={1}
        onChange={(opacity) => patch({ opacity })}
      />
      <NumberField
        label="Font size (pt)"
        value={value.fontSize}
        min={6}
        max={96}
        onChange={(fontSize) => patch({ fontSize })}
      />
      <NumberField
        label="Rotation (degrees)"
        value={value.rotation}
        min={-180}
        max={180}
        onChange={(rotation) => patch({ rotation })}
      />
      <NumberField
        label="Width (%)"
        value={value.width}
        min={5}
        max={100 - value.x}
        onChange={(width) => patch({ width })}
      />
      <NumberField
        label="Left position (%)"
        value={value.x}
        max={95}
        onChange={(x) => patch({ x, width: Math.min(value.width, 100 - x) })}
      />
      <NumberField
        label="Top position (%)"
        value={value.y}
        max={98}
        onChange={(y) => patch({ y })}
      />
      <Select
        label="Pages"
        value={value.pages}
        options={pageOptions}
        enableSearch={false}
        onChange={(pages) => patch({ pages: pages as ReportMark["pages"] })}
      />
      <Select
        label="Layer"
        value={value.layer}
        options={[
          { value: "ABOVE", label: "Above content" },
          { value: "BEHIND", label: "Behind content" },
        ]}
        enableSearch={false}
        onChange={(layer) => patch({ layer: layer as ReportMark["layer"] })}
      />
    </div>
  );
}
export function ReportLayoutDesigner({
  value,
  onChange,
  title,
  disabled,
  fields = [],
}: {
  value: ReportLayout;
  onChange: (value: ReportLayout) => void;
  title: string;
  disabled: boolean;
  fields?: Array<{ code: string; name: string; type?: string }>;
}) {
  const [uploadError, setUploadError] = useState("");
  const [section, setSection] = useState("markings");
  const previewTitle = title.trim() || "Report preview";
  const [copiedToken, setCopiedToken] = useState("");
  const [uploadingPart, setUploadingPart] = useState("");
  const latest = useRef({ value, onChange });
  latest.current = { value, onChange };
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const wordUpload = (type: "cover" | "header" | "footer") => {
    const component = value.wordComponents?.[type];
    return (
      <div className="space-y-3">
        <label className="block cursor-pointer rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 p-4 text-center text-sm text-slate-600">
          <span>
            {uploadingPart === type
              ? "Inspecting on server…"
              : (component?.fileName ?? `Upload ${type} template (.docx)`)}
          </span>
          <input
            aria-label={`Upload ${type} Word template`}
            type="file"
            accept=".docx"
            className="sr-only"
            disabled={disabled || !!uploadingPart}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              if (
                !file.name.toLowerCase().endsWith(".docx") ||
                file.size > 2097152
              ) {
                setUploadError("Use a DOCX file up to 2 MB.");
                return;
              }
              setUploadError("");
              setUploadingPart(type);
              try {
                const ref = await reportTemplatesApi.uploadComponent(
                  type,
                  file,
                );
                if (ref && mounted.current) {
                  const current = latest.current;
                  current.onChange({
                    ...current.value,
                    wordComponents: {
                      ...current.value.wordComponents,
                      [type]: ref,
                    },
                  });
                }
              } catch (error) {
                if (mounted.current) setUploadError(reportError(error));
              } finally {
                if (mounted.current) setUploadingPart("");
              }
            }}
          />
        </label>
        <p className="text-xs text-slate-500">
          Optional Word template overrides the text settings below in PDF
          output. One page maximum. Use report placeholders; page numbering is
          configured separately. Save Changes is required.
        </p>
        {component && (
          <>
            <p className="break-all text-xs text-slate-500">
              Detected:{" "}
              {component.placeholders.map((p) => `{{${p}}}`).join(" · ") ||
                "No placeholders"}
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const next = { ...value.wordComponents };
                delete next[type];
                patch({ wordComponents: next });
              }}
            >
              Use text settings instead
            </Button>
          </>
        )}
      </div>
    );
  };
  type TextTarget =
    | "coverTitle"
    | "subtitle"
    | "header"
    | "footer"
    | "watermark"
    | "stamp";
  const patch = (p: Partial<ReportLayout>) => onChange({ ...value, ...p });
  const watermark = value.watermarkStyle ?? defaultReportMark(),
    stamp = value.stampStyle ?? defaultReportMark(true);
  const logo = value.logo ?? {
    enabled: false,
    data: "",
    x: 5,
    y: 8,
    width: 18,
    pages: "FIRST" as const,
  };
  const text = (key: TextTarget, label: string, max: number) => (
    <div className="space-y-2">
      <label className="block space-y-1.5 text-sm text-slate-700">
        <span>{label}</span>
        <Input
          className={input}
          value={value[key]}
          maxLength={max}
          onChange={(e) => patch({ [key]: e.target.value })}
        />
      </label>
      <Select
        label={`Insert field into ${label.toLowerCase()}`}
        value=""
        placeholder="Choose an automatic field…"
        disabled={disabled}
        options={tokens.map((token) => ({
          value: token.code,
          label: `${token.name} · ${token.example}`,
        }))}
        onChange={(code) => {
          const next = value[key] + `{{${code}}}`;
          if (next.length <= max) patch({ [key]: next });
        }}
      />
      {tokens
        .filter((token) => value[key].includes(`{{${token.code}}}`))
        .map((token) => (
          <p key={token.code} className="text-xs text-slate-500">
            {token.name}: filled automatically by the server ({token.example}).
          </p>
        ))}
    </div>
  );
  const chartChange = (index: number, p: Partial<ReportChart>) =>
    patch({
      charts: (value.charts ?? []).map((c, i) =>
        i === index ? { ...c, ...p } : c,
      ),
    });
  return (
    <div className="grid min-w-0 grid-cols-1 items-start gap-4 lg:grid-cols-12">
      <fieldset disabled={disabled} className="min-w-0 space-y-4 lg:col-span-4">
        <TabNav
          tabs={[
            { id: "markings", label: "PDF Markings" },
            { id: "paper", label: "Page Templates" },
            { id: "charts", label: "Charts" },
          ]}
          activeTab={section}
          onChange={setSection}
          variant="pill"
          ariaLabel="Report layout settings"
        />
        {uploadError && (
          <p role="alert" className="text-sm text-red-700">
            {uploadError}
          </p>
        )}
        <div hidden={section !== "paper"} className="space-y-4">
          <FormSection title="Page Layout">
            <Select
              label="Orientation"
              value={value.orientation ?? "LANDSCAPE"}
              enableSearch={false}
              options={[
                { value: "PORTRAIT", label: "Portrait" },
                { value: "LANDSCAPE", label: "Landscape" },
              ]}
              onChange={(orientation) =>
                patch({
                  orientation: orientation as ReportLayout["orientation"],
                })
              }
            />
          </FormSection>
          <FormSection title="Report Placeholders">
            <p className="mb-3 text-xs text-slate-500">
              Hover for an explanation. Click a variable to copy it into your
              template. Names and times are server-derived information, not
              electronic signatures.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {tokens.map((token) => (
                <div
                  key={token.code}
                  translate="no"
                  className="flex min-w-0 items-center gap-2 rounded-lg border border-slate-200 px-3 py-2"
                  title={`${token.name}: ${token.example}`}
                >
                  <Button
                    size="sm"
                    variant="ghost"
                    className="min-w-0 flex-1 break-all text-left text-xs"
                    aria-label={`Copy ${token.code}`}
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(
                          `{{${token.code}}}`,
                        );
                        setCopiedToken(token.code);
                      } catch {
                        setCopiedToken("");
                        setUploadError(
                          "Unable to copy. Select the variable text and copy it manually.",
                        );
                      }
                    }}
                  >
                    {`{{${token.code}}}`}
                    {copiedToken === token.code ? " · Copied" : ""}
                  </Button>
                  <Popover
                    content={`${token.name}. ${token.example}. Filled automatically by the server.`}
                    triggerAriaLabel={`Explain ${token.code}`}
                  />
                </div>
              ))}
            </div>
          </FormSection>
          <FormSection
            title="Cover Template"
            headerRight={
              <Checkbox
                label="Enable cover"
                checked={value.cover}
                onChange={(cover) => patch({ cover })}
                disabled={disabled}
              />
            }
          >
            <fieldset disabled={disabled || !value.cover} className="space-y-4">
              {wordUpload("cover")}
              {text("coverTitle", "Report title", 255)}
              {text("subtitle", "Subtitle", 500)}
              <Checkbox
                label="Show report executor"
                checked={value.showExecutor}
                onChange={(showExecutor) => patch({ showExecutor })}
              />
              <Checkbox
                label="Show generation time (server UTC)"
                checked={value.showGeneratedAt}
                onChange={(showGeneratedAt) => patch({ showGeneratedAt })}
              />
            </fieldset>
          </FormSection>
          <FormSection title="Header Template">
            <div className="mb-4">{wordUpload("header")}</div>
            {text("header", "Header", 200)}
          </FormSection>
          <FormSection title="Footer Template">
            <div className="space-y-4">
              {wordUpload("footer")}
              {text("footer", "Footer", 200)}
              <Checkbox
                label="Show page numbers"
                checked={value.pageNumbers}
                onChange={(pageNumbers) => patch({ pageNumbers })}
              />
            </div>
          </FormSection>
        </div>
        <div hidden={section !== "markings"} className="space-y-4">
          {([true, false] as const).map((isStamp) => (
            <MarkCard
              key={String(isStamp)}
              title={isStamp ? "Stamp" : "Watermark"}
              enabled={isStamp ? value.stampEnabled : value.watermarkEnabled}
              disabled={disabled}
              onToggle={(enabled) =>
                patch(
                  isStamp
                    ? { stampEnabled: enabled }
                    : { watermarkEnabled: enabled },
                )
              }
            >
              {text(
                isStamp ? "stamp" : "watermark",
                isStamp ? "Stamp text" : "Watermark text",
                isStamp ? 60 : 80,
              )}
              <MarkEditor
                value={isStamp ? stamp : watermark}
                onChange={(style) =>
                  patch(
                    isStamp ? { stampStyle: style } : { watermarkStyle: style },
                  )
                }
              />
              <Button
                variant="outline-emerald"
                size="sm"
                onClick={() => {
                  const style = defaultReportMark(isStamp);
                  patch(
                    isStamp
                      ? {
                          stampStyle: {
                            ...stamp,
                            x: style.x,
                            y: style.y,
                            width: style.width,
                            rotation: style.rotation,
                          },
                        }
                      : {
                          watermarkStyle: {
                            ...watermark,
                            x: style.x,
                            y: style.y,
                            width: style.width,
                            rotation: style.rotation,
                          },
                        },
                  );
                }}
              >
                Reset Position
              </Button>
            </MarkCard>
          ))}
          <MarkCard
            title="Logo"
            enabled={logo.enabled}
            disabled={disabled}
            onToggle={(enabled) => patch({ logo: { ...logo, enabled } })}
          >
            <label className="block cursor-pointer rounded-lg border-2 border-dashed border-slate-200 bg-white p-4 text-center text-sm text-slate-600">
              {logo.data ? (
                <img
                  src={logo.data}
                  alt="Report logo"
                  className="mx-auto mb-3 max-h-16 max-w-full"
                />
              ) : null}
              <span>Upload PNG or JPEG · max 1 MB</span>
              <input
                aria-label="Upload report logo"
                type="file"
                accept="image/png,image/jpeg"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (
                    file.size > 1048576 ||
                    !["image/png", "image/jpeg"].includes(file.type)
                  ) {
                    setUploadError("Use PNG/JPEG up to 1 MB.");
                    return;
                  }
                  setUploadError("");
                  const reader = new FileReader();
                  reader.onload = () =>
                    patch({
                      logo: {
                        ...logo,
                        data: String(reader.result),
                        enabled: true,
                      },
                    });
                  reader.readAsDataURL(file);
                  e.target.value = "";
                }}
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <NumberField
                label="Logo width (%)"
                value={logo.width}
                min={5}
                onChange={(width) => patch({ logo: { ...logo, width } })}
              />
              <Select
                label="Logo pages"
                value={logo.pages}
                options={pageOptions}
                enableSearch={false}
                onChange={(pages) =>
                  patch({ logo: { ...logo, pages: pages as "ALL" | "FIRST" } })
                }
              />
              <NumberField
                label="Logo left (%)"
                value={logo.x}
                max={90}
                onChange={(x) =>
                  patch({
                    logo: { ...logo, x, width: Math.min(logo.width, 100 - x) },
                  })
                }
              />
              <NumberField
                label="Logo top (%)"
                value={logo.y}
                max={90}
                onChange={(y) => patch({ logo: { ...logo, y } })}
              />
            </div>
            <Button
              variant="outline-emerald"
              size="sm"
              onClick={() =>
                patch({ logo: { ...logo, x: 5, y: 8, width: 18 } })
              }
            >
              Reset Position
            </Button>
          </MarkCard>
        </div>
        <div
          hidden={section !== "charts"}
          className="space-y-4 rounded-xl border border-slate-200 p-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-800">
              Analysis charts
            </h3>
            <Button
              size="sm"
              variant="outline-emerald"
              disabled={!fields.length || (value.charts?.length ?? 0) >= 6}
              onClick={() =>
                patch({
                  charts: [
                    ...(value.charts ?? []),
                    {
                      title: `Records by ${fields.find((f) => f.code === "status")?.name ?? fields[0].name}`,
                      type: "BAR",
                      field:
                        fields.find((f) => f.code === "status")?.code ??
                        fields[0].code,
                      metric: "COUNT",
                    },
                  ],
                })
              }
            >
              Add chart
            </Button>
          </div>
          <p className="text-xs text-slate-500">
            1. Choose a chart type. 2. Choose what to group records by. 3.
            Choose counts or percentages. Each chart appears on its own PDF
            page. This configuration preview uses demonstration data; generated
            reports calculate actual authorized records on the server.
          </p>
          {(value.charts ?? []).map((chart, index) => (
            <div
              key={index}
              className="space-y-3 border-t border-slate-100 pt-4"
            >
              <label className="block space-y-1.5 text-sm text-slate-700">
                <span>Chart title</span>
                <Input
                  className={input}
                  maxLength={100}
                  value={chart.title}
                  onChange={(e) =>
                    chartChange(index, { title: e.target.value })
                  }
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <Select
                  label="Chart type"
                  value={chart.type}
                  options={[
                    { value: "BAR", label: "Column" },
                    { value: "PIE", label: "Pie" },
                    ...(fields.some((f) => f.type === "DATE")
                      ? [{ value: "LINE", label: "Monthly trend" }]
                      : []),
                  ]}
                  enableSearch={false}
                  onChange={(type) =>
                    chartChange(index, {
                      type: type as ReportChart["type"],
                      ...(type === "LINE" &&
                      !fields.some(
                        (f) => f.code === chart.field && f.type === "DATE",
                      ) &&
                      fields.some((f) => f.type === "DATE")
                        ? {
                            field: fields.find((f) => f.type === "DATE")!.code,
                          }
                        : {}),
                    })
                  }
                />
                <Select
                  label="Group by"
                  value={chart.field}
                  options={fields
                    .filter((f) => chart.type !== "LINE" || f.type === "DATE")
                    .map((f) => ({
                      value: f.code,
                      label: f.name,
                    }))}
                  onChange={(field) =>
                    chartChange(index, { field: String(field) })
                  }
                />
                <Select
                  label="Metric"
                  value={chart.metric}
                  options={[
                    { value: "COUNT", label: "Number of records" },
                    { value: "PERCENT", label: "Share of all records (%)" },
                  ]}
                  enableSearch={false}
                  onChange={(metric) =>
                    chartChange(index, {
                      metric: metric as ReportChart["metric"],
                    })
                  }
                />
              </div>
              <p className="text-xs text-slate-500">
                {chart.type === "LINE"
                  ? "Dates are grouped by month. Choose a date field."
                  : `Count records with the same ${fields.find((f) => f.code === chart.field)?.name ?? "field value"}.`}{" "}
                {chart.metric === "PERCENT"
                  ? "All categories total 100%."
                  : "No sums or user formulas are required."}
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  patch({ charts: value.charts?.filter((_, i) => i !== index) })
                }
              >
                Remove chart
              </Button>
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-500">
          Automatic fields use a server placeholder internally; choose a named
          field above instead of typing a key. Presentation stamps are not
          electronic signatures.
        </p>
      </fieldset>
      <div className="min-w-0 lg:col-span-8 lg:sticky lg:top-4">
        <Suspense
          fallback={
            <p role="status" className="text-sm text-slate-500">
              Loading position editor…
            </p>
          }
        >
          <ReportMarkCanvas
            title={previewTitle}
            layout={value}
            onChange={onChange}
            disabled={disabled}
          />
        </Suspense>
        <p className="mt-3 text-xs text-slate-500">
          Layout preview uses demonstration rows, not business records. Save
          Changes applies this layout to future reports. PDF supports the full
          presentation; XLSX includes analysis images/data; CSV is data only.
        </p>
      </div>
    </div>
  );
}
