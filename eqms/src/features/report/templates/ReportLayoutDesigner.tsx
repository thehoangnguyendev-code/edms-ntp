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
import { WatermarkFields } from "@/features/settings/document-administration/controlled-copies-policy/MarkingEditors";
import { ReportMarkCard, ReportStampFields } from "./ReportStampEditor";
import {
  defaultReportMark,
  defaultReportStamp,
  reportTemplatesApi,
  reportError,
  type ReportLayout,
  type ReportMark,
} from "@/services/api/reportTemplates";

const input =
  "h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500";
const tokens = [
  {
    code: "report.title",
    name: "Report name",
    example: "Document Status Report",
  },
  { code: "report.code", name: "Template number", example: "RPT.0001" },
  { code: "template.version", name: "Template revision", example: "2" },
  { code: "template.name", name: "Template name", example: "EQMS - Document status register" },
  { code: "report.runId", name: "Run ID", example: "Identifier of the run, to trace a printout to its record" },
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
  { value: "TIMES_NEW_ROMAN", label: "Times New Roman" },
  { value: "ROBOTO_MONO", label: "Roboto Mono" },
  { value: "OSWALD", label: "Oswald" },
];
/** Where the watermark sits and how it is turned and sized until it is dragged on the preview. */
const markHome = () => {
  const home = defaultReportMark();
  return { x: home.x, y: home.y, width: home.width, rotation: home.rotation };
};
const markMoved = (mark: ReportMark) => {
  const home = markHome();
  return mark.x !== home.x || mark.y !== home.y || mark.width !== home.width || mark.rotation !== home.rotation;
};
function ResetPosition({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <div className="mt-4 flex justify-end border-t border-slate-200 pt-3">
      <Button size="sm" variant="outline-emerald" aria-label={`Reset ${label} Position`} onClick={onClick}>
        Reset Position
      </Button>
    </div>
  );
}
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
/** The biggest picture that may be chosen; it is reduced before it goes into the layout. */
const LOGO_MAX_UPLOAD = 10 * 1024 * 1024;
/** What the layout keeps: the server takes a picture of up to 1 MB and 4 megapixels, and a report needs far less than that. */
const LOGO_MAX_SIDE = 1600;
const LOGO_MAX_PIXELS = 3_000_000;
const LOGO_MAX_DATA_URL = 1_300_000;

/**
 * Reads a logo as a data URL that the layout can keep. A picture that is too big in pixels or in bytes is reduced step by step (the sides by a fifth each time,
 * a photograph in JPEG when the PNG stays too heavy) until it fits; its proportions and transparency are kept. Where the picture cannot be measured
 * (no canvas) it is used as it is when it is small enough, otherwise refused.
 */
function readLogo(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read"));
    reader.onload = () => {
      const source = String(reader.result);
      const image = new Image();
      image.onerror = () => reject(new Error("image"));
      image.onload = () => {
        const width = image.naturalWidth;
        const height = image.naturalHeight;
        const fits = (data: string) => data.length <= LOGO_MAX_DATA_URL;
        if (!width || !height || (width * height <= LOGO_MAX_PIXELS && Math.max(width, height) <= 4096 && fits(source))) {
          if (fits(source)) resolve(source);
          else reject(new Error("size"));
          return;
        }
        let scale = Math.min(1, LOGO_MAX_SIDE / Math.max(width, height), Math.sqrt(LOGO_MAX_PIXELS / (width * height)));
        for (let attempt = 0; attempt < 10; attempt++) {
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(width * scale));
          canvas.height = Math.max(1, Math.round(height * scale));
          const context = canvas.getContext("2d");
          if (!context) {
            reject(new Error("canvas"));
            return;
          }
          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          const png = canvas.toDataURL("image/png");
          if (fits(png)) {
            resolve(png);
            return;
          }
          // A heavy PNG is usually a photograph: JPEG is much smaller (transparency becomes white).
          if (file.type === "image/jpeg" || attempt >= 2) {
            context.globalCompositeOperation = "destination-over";
            context.fillStyle = "#ffffff";
            context.fillRect(0, 0, canvas.width, canvas.height);
            const jpeg = canvas.toDataURL("image/jpeg", 0.85);
            if (fits(jpeg)) {
              resolve(jpeg);
              return;
            }
          }
          scale *= 0.8;
        }
        reject(new Error("size"));
      };
      image.src = source;
    };
    reader.readAsDataURL(file);
  });
}

export function ReportLayoutDesigner({
  value,
  onChange,
  title,
  disabled,
}: {
  value: ReportLayout;
  onChange: (value: ReportLayout) => void;
  title: string;
  disabled: boolean;
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
        <label className="relative block cursor-pointer overflow-hidden rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 p-4 text-center text-sm text-slate-600">
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
    | "footer";
  const patch = (p: Partial<ReportLayout>) => onChange({ ...value, ...p });
  const watermark = value.watermarkStyle ?? defaultReportMark(),
    stamp = value.stampStyle ?? defaultReportStamp();
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
  return (
    <div className="grid min-w-0 grid-cols-1 items-start gap-4 lg:grid-cols-12">
      <fieldset disabled={disabled} className="min-w-0 space-y-4 lg:col-span-4">
        <TabNav
          tabs={[
            { id: "markings", label: "PDF Markings" },
            { id: "paper", label: "Page Templates" },
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
            <div className="grid gap-4 sm:grid-cols-2">
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
              <div>
                <Select
                  label="Report font"
                  value={value.fontFamily ?? "NOTO_SANS"}
                  enableSearch={false}
                  options={fonts}
                  onChange={(fontFamily) => patch({ fontFamily: fontFamily as ReportLayout["fontFamily"] })}
                />
                <p className="mt-1 text-xs text-slate-500">
                  The font of the cover, header, footer, table and charts of the PDF. Times New Roman is printed in Tinos, a font with the same letter widths. A cover, header or
                  footer made from a Word file keeps the fonts of that file. Stamp and watermark have their own font.
                </p>
              </div>
            </div>
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
          <ReportMarkCard
            title="Stamp"
            enabled={value.stampEnabled}
            disabled={disabled}
            onToggle={(stampEnabled) => patch({ stampEnabled })}
          >
            <ReportStampFields
              text={value.stamp}
              stamp={stamp}
              disabled={disabled}
              onText={(text) => patch({ stamp: text })}
              onChange={(change) => patch({ stampStyle: { ...stamp, ...change } })}
            />
          </ReportMarkCard>
          <ReportMarkCard
            title="Watermark"
            enabled={value.watermarkEnabled}
            disabled={disabled}
            onToggle={(watermarkEnabled) => patch({ watermarkEnabled })}
          >
            <WatermarkFields
              disabled={disabled}
              textHint="Letters, digits and . , : ; / ( ) -"
              opacityRange={[5, 50]}
              layerOptions={[
                { label: "Behind the content (text stays crisp)", value: "BEHIND" },
                { label: "Above the content (always visible)", value: "ABOVE" },
              ]}
              value={{
                watermarkText: value.watermark,
                watermarkColor: watermark.color,
                watermarkOpacityPercent: watermark.opacity,
                watermarkLayer: watermark.layer,
                watermarkPages: watermark.pages,
                watermarkFontFamily: watermark.font,
              }}
              onChange={(key, next) => {
                if (key === "watermarkText") patch({ watermark: String(next) });
                else {
                  const style: Partial<ReportMark> = {};
                  if (key === "watermarkColor") style.color = String(next);
                  if (key === "watermarkOpacityPercent") style.opacity = Number(next);
                  if (key === "watermarkPages") style.pages = next as ReportMark["pages"];
                  if (key === "watermarkFontFamily") style.font = next as ReportMark["font"];
                  if (key === "watermarkLayer") style.layer = next as ReportMark["layer"];
                  patch({ watermarkStyle: { ...watermark, ...style } });
                }
              }}
            />
            {markMoved(watermark) && (
              <ResetPosition
                label="Watermark"
                onClick={() => patch({ watermarkStyle: { ...watermark, ...markHome() } })}
              />
            )}
          </ReportMarkCard>
          <ReportMarkCard
            title="Logo"
            enabled={logo.enabled}
            disabled={disabled}
            onToggle={(enabled) => patch({ logo: { ...logo, enabled } })}
          >
            <label className="relative block cursor-pointer overflow-hidden rounded-lg border-2 border-dashed border-slate-200 bg-white p-4 text-center text-sm text-slate-600">
              {logo.data ? (
                <img
                  src={logo.data}
                  alt="Report logo"
                  className="mx-auto mb-3 max-h-16 max-w-full"
                />
              ) : null}
              <span>Upload PNG or JPEG · up to 10 MB</span>
              <span className="mt-1 block text-xs text-slate-500">A large picture is reduced to a size that suits the report when it is inserted.</span>
              <input
                aria-label="Upload report logo"
                type="file"
                accept="image/png,image/jpeg"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (
                    file.size > LOGO_MAX_UPLOAD ||
                    !["image/png", "image/jpeg"].includes(file.type)
                  ) {
                    setUploadError("Use a PNG or JPEG up to 10 MB.");
                    return;
                  }
                  setUploadError("");
                  // A large picture is reduced here: the server accepts up to 4 megapixels and a report needs far less.
                  void readLogo(file)
                    .then((data) => patch({ logo: { ...logo, data, enabled: true } }))
                    .catch(() => setUploadError("The image could not be read or reduced. Use another PNG or JPEG."));
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
          </ReportMarkCard>
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
