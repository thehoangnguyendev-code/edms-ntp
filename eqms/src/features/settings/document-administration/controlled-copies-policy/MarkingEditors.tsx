import React, { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
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
    <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50/60 overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between gap-3 p-3 sm:p-4 text-left hover:bg-slate-100/60 transition-colors"
      >
        <div className="flex min-w-0 items-center gap-2">
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-slate-400 transition-transform duration-300 ${expanded ? "rotate-0" : "-rotate-90"}`}
          />
          {icon && <span className="text-emerald-600">{icon}</span>}
          <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        </div>
        {/* Stops the switch's click from also toggling the accordion. */}
        <span onClick={(e) => e.stopPropagation()}>
          <Switch checked={enabled} onChange={onToggle} size="sm" disabled={disabled} />
        </span>
      </button>
      <div
        className="grid transition-[grid-template-rows] duration-300 ease-in-out"
        style={{ gridTemplateRows: expanded ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          <div className="space-y-4 border-t border-slate-200 p-3 pt-4 sm:p-4 sm:pt-4">{children}</div>
        </div>
      </div>
    </div>
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
          maxLength={40}
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
