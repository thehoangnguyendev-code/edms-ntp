import React, { useEffect, useState } from "react";
import { ChevronDown, Droplets, QrCode, Stamp } from "lucide-react";
import { FormSection } from "@/components/ui/form/FormSection";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch/Switch";
import { ColorPickerInput } from "@/components/ui/color-picker/ColorPickerInput";

/** Field names are shared by the issued-copy marking and the per-status marking, so one editor serves both. */
export interface WatermarkValue {
  watermarkText: string;
  watermarkColor: string;
  watermarkOpacityPercent: number;
  watermarkLayer: "BEHIND" | "ABOVE";
  watermarkPages?: "ALL" | "FIRST";
  watermarkFontFamily: string;
}

export interface StampValue {
  stampText: string;
  stampColor: string;
  stampOpacityPercent: number;
  stampPages?: "ALL" | "FIRST";
  stampFontFamily: string;
}

const FONT_OPTIONS = [
  { label: "Noto Sans (default)", value: "NOTO_SANS" },
  { label: "Noto Serif", value: "NOTO_SERIF" },
  { label: "Times New Roman", value: "TIMES_NEW_ROMAN" },
  { label: "Roboto Mono", value: "ROBOTO_MONO" },
  { label: "Oswald (condensed)", value: "OSWALD" },
];

const FIELD_INPUT =
  "w-full h-9 px-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 disabled:bg-slate-50 disabled:text-slate-500";

const PAGE_OPTIONS = [
  { label: "Every page", value: "ALL" },
  { label: "First page only", value: "FIRST" },
];

const Field: React.FC<{ label: string; hint?: string; children: React.ReactNode }> = ({ label, hint, children }) => (
  <div className="min-w-0">
    <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">{label}</label>
    {children}
    {hint && <p className="mt-1 text-2xs text-slate-400 break-words">{hint}</p>}
  </div>
);

const NumberField: React.FC<{
  label: string;
  hint: string;
  value: number;
  min: number;
  max: number;
  disabled?: boolean;
  onChange: (v: number) => void;
}> = ({ label, hint, value, min, max, disabled, onChange }) => {
  // A local text buffer so the field can sit empty (or mid-edit, e.g. "-") while typing, instead of
  // snapping to 0 the instant it's cleared -- onChange only fires once the text is a real number.
  const [text, setText] = useState(String(value));
  useEffect(() => {
    setText((current) => (Number(current) === value ? current : String(value)));
  }, [value]);
  return (
    <Field label={label} hint={hint}>
      <input
        type="number"
        className={FIELD_INPUT}
        min={min}
        max={max}
        step={1}
        value={text}
        onChange={(e) => {
          const next = e.target.value;
          setText(next);
          if (next.trim() !== "" && Number.isFinite(Number(next))) {
            onChange(Number(next));
          }
        }}
        onBlur={() => {
          if (text.trim() === "" || !Number.isFinite(Number(text))) {
            setText(String(value));
          }
        }}
        disabled={disabled}
      />
    </Field>
  );
};

/** An accordion card: clicking the header expands/collapses the body, animated with a pure-CSS
 *  grid-rows trick (no JS height measuring, no layout thrash). Independent of the on/off switch,
 *  which only enables/disables the mark itself -- collapsing the card never touches that. */
const MARK_ICONS: Record<string, React.ReactNode> = {
  stamp: <Stamp className="h-4 w-4" />,
  watermark: <Droplets className="h-4 w-4" />,
  qr: <QrCode className="h-4 w-4" />,
};
const markIcon = (title: string) => {
  const t = title.toLowerCase();
  return t.includes("stamp") ? MARK_ICONS.stamp : t.includes("watermark") ? MARK_ICONS.watermark : t.includes("qr") ? MARK_ICONS.qr : undefined;
};

/** One marking (stamp, watermark, QR code) as a section of the left column, the same card as the other administration screens, with its on/off switch and a fold. */
export const MarkCard: React.FC<{
  title: string;
  icon?: React.ReactNode;
  enabled: boolean;
  onToggle: (v: boolean) => void;
  disabled?: boolean;
  defaultExpanded?: boolean;
  children: React.ReactNode;
}> = ({ title, icon, enabled, onToggle, disabled, defaultExpanded = true, children }) => {
  const [expanded, setExpanded] = useState(defaultExpanded);
  return (
    <FormSection
      title={title}
      icon={icon ?? markIcon(title)}
      headerRight={
        <div className="flex items-center gap-2">
          <Switch checked={enabled} onChange={onToggle} size="sm" disabled={disabled} />
          <button type="button" aria-label={`${expanded ? "Collapse" : "Expand"} ${title}`} aria-expanded={expanded} onClick={() => setExpanded((v) => !v)} className="rounded p-1 text-slate-500 hover:bg-slate-100">
            <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
          </button>
        </div>
      }
    >
      {expanded ? <div className="space-y-4">{children}</div> : null}
    </FormSection>
  );
};

export const WatermarkFields: React.FC<{
  value: WatermarkValue;
  onChange: (key: keyof WatermarkValue, value: string | number) => void;
  disabled?: boolean;
  textHint: string;
  opacityRange: [number, number];
  layerOptions: { label: string; value: string }[];
}> = ({ value, onChange, disabled, textHint, opacityRange, layerOptions }) => (
  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
    <div className="sm:col-span-2">
      <Field label="Text" hint={textHint}>
        <input
          className={FIELD_INPUT}
          value={value.watermarkText}
          maxLength={60}
          onChange={(e) => onChange("watermarkText", e.target.value)}
          disabled={disabled}
        />
      </Field>
    </div>
    <Field label="Color">
      <ColorPickerInput value={value.watermarkColor} onChange={(v) => onChange("watermarkColor", v)} disabled={disabled} />
    </Field>
    <Select
      label="Layer"
      value={value.watermarkLayer}
      onChange={(v) => onChange("watermarkLayer", String(v))}
      options={layerOptions}
      enableSearch={false}
      disabled={disabled}
    />
    <Select
      label="Font"
      value={value.watermarkFontFamily}
      onChange={(v) => onChange("watermarkFontFamily", String(v))}
      options={FONT_OPTIONS}
      enableSearch={false}
      disabled={disabled}
    />
    <NumberField
      label="Opacity (%)"
      hint={`${opacityRange[0]} to ${opacityRange[1]}`}
      value={value.watermarkOpacityPercent}
      min={opacityRange[0]}
      max={opacityRange[1]}
      disabled={disabled}
      onChange={(v) => onChange("watermarkOpacityPercent", v)}
    />
    {value.watermarkPages !== undefined && (
      <Select
        label="Pages"
        value={value.watermarkPages}
        onChange={(v) => onChange("watermarkPages", String(v))}
        options={PAGE_OPTIONS}
        enableSearch={false}
        disabled={disabled}
      />
    )}
  </div>
);

export const StampFields: React.FC<{
  value: StampValue;
  onChange: (key: keyof StampValue, value: string | number) => void;
  disabled?: boolean;
}> = ({ value, onChange, disabled }) => (
  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
    <div className="sm:col-span-2">
      <Field label="Text" hint="Letters, digits and . , : ; / ( ) -">
        <input
          className={FIELD_INPUT}
          value={value.stampText}
          maxLength={40}
          onChange={(e) => onChange("stampText", e.target.value)}
          disabled={disabled}
        />
      </Field>
    </div>
    <Field label="Color">
      <ColorPickerInput value={value.stampColor} onChange={(v) => onChange("stampColor", v)} disabled={disabled} />
    </Field>
    <Select
      label="Font"
      value={value.stampFontFamily}
      onChange={(v) => onChange("stampFontFamily", String(v))}
      options={FONT_OPTIONS}
      enableSearch={false}
      disabled={disabled}
    />
    <NumberField
      label="Opacity (%)"
      hint="30 to 100"
      value={value.stampOpacityPercent}
      min={30}
      max={100}
      disabled={disabled}
      onChange={(v) => onChange("stampOpacityPercent", v)}
    />
    {value.stampPages !== undefined && (
      <Select
        label="Pages"
        value={value.stampPages}
        onChange={(v) => onChange("stampPages", String(v))}
        options={PAGE_OPTIONS}
        enableSearch={false}
        disabled={disabled}
      />
    )}
  </div>
);

const QR_POSITION_OPTIONS = [
  { label: "Top left", value: "TOP_LEFT" },
  { label: "Top right", value: "TOP_RIGHT" },
  { label: "Bottom left", value: "BOTTOM_LEFT" },
  { label: "Bottom right", value: "BOTTOM_RIGHT" },
];

export interface QrCodeValue {
  qrCodePosition: string;
  qrCodeSizeMm: number;
  qrCodePages: string;
}

/** Which pages of a paper copy carry the scan code, where it goes and how big it is. Drag or resize it on the preview, or pick a corner. */
export const QrCodeFields: React.FC<{
  value: QrCodeValue;
  onChange: (key: keyof QrCodeValue, value: string | number) => void;
  /** The code was dragged to a place of its own, which replaces the corner until it is reset. */
  positioned?: boolean;
  disabled?: boolean;
}> = ({ value, onChange, positioned, disabled }) => (
  <div className="space-y-3">
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Select
        label="Corner"
        value={value.qrCodePosition}
        onChange={(v) => onChange("qrCodePosition", String(v))}
        options={QR_POSITION_OPTIONS}
        enableSearch={false}
        disabled={disabled}
      />
      <NumberField
        label="Size (mm)"
        hint="15 to 40"
        value={value.qrCodeSizeMm}
        min={15}
        max={40}
        disabled={disabled}
        onChange={(v) => onChange("qrCodeSizeMm", v)}
      />
      <Select
        label="Pages"
        value={value.qrCodePages}
        onChange={(v) => onChange("qrCodePages", String(v))}
        options={PAGE_OPTIONS}
        enableSearch={false}
        disabled={disabled}
      />
    </div>
    <p className="text-2xs text-slate-500">
      {positioned
        ? "Placed by hand on the preview. Choosing a corner puts it back there."
        : "Drag the code on the preview to place it anywhere on the page; drag a corner handle to resize it."}
    </p>
    <p className="text-2xs text-slate-500">
      {value.qrCodePages === "FIRST"
        ? "First page only: a whole copy can be matched from its first page, but loose pages scanned together cannot be sorted back into their copies."
        : "Every page: each page carries its own code with its page number, so pages of many copies scanned as one file are sorted back into their copies and into order."}
    </p>
  </div>
);

/** A compact grid of "Show ..." switches. */
export const ShowToggles: React.FC<{
  items: { label: string; checked: boolean; onChange: (v: boolean) => void; note?: string }[];
  disabled?: boolean;
}> = ({ items, disabled }) => (
  <div>
    <p className="mb-1 text-xs font-medium text-slate-500 uppercase tracking-wider">Also show</p>
    <div className="grid grid-cols-1 gap-x-6 divide-y divide-slate-100 sm:grid-cols-2 sm:divide-y-0">
      {items.map((item) => (
        <div key={item.label} className="flex items-center justify-between gap-3 py-2 sm:border-b sm:border-slate-100">
          <div className="min-w-0">
            <span className="text-xs sm:text-sm font-medium text-slate-900 break-words">{item.label}</span>
            {item.note && <p className="text-2xs text-slate-400 mt-0.5 break-words">{item.note}</p>}
          </div>
          <Switch checked={item.checked} onChange={item.onChange} size="sm" disabled={disabled} />
        </div>
      ))}
    </div>
  </div>
);
