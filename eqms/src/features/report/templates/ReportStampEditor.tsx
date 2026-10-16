import React, { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch/Switch";
import { ColorPickerInput } from "@/components/ui/color-picker/ColorPickerInput";
import { Button } from "@/components/ui/button/Button";
import type { ReportFontFamily, ReportStamp } from "@/services/api/reportTemplates";

const FONT_OPTIONS = [
  { label: "Noto Sans (default)", value: "NOTO_SANS" },
  { label: "Noto Serif", value: "NOTO_SERIF" },
  { label: "Times New Roman", value: "TIMES_NEW_ROMAN" },
  { label: "Roboto Mono", value: "ROBOTO_MONO" },
  { label: "Oswald (condensed)", value: "OSWALD" },
];

const PAGE_OPTIONS = [
  { label: "Every page", value: "ALL" },
  { label: "First page only", value: "FIRST" },
];

const FIELD_INPUT =
  "w-full h-9 px-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 disabled:bg-slate-50 disabled:text-slate-500";

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
  // A local text buffer so the field can sit empty (or mid-edit) while typing, instead of snapping to 0 the instant it is cleared;
  // onChange only fires once the text is a real number.
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
          if (next.trim() !== "" && Number.isFinite(Number(next))) onChange(Number(next));
        }}
        onBlur={() => {
          if (text.trim() === "" || !Number.isFinite(Number(text))) setText(String(value));
        }}
        disabled={disabled}
      />
    </Field>
  );
};

/** An accordion card: the header expands and collapses the body; the switch only turns the mark on or off. */
export const ReportMarkCard: React.FC<{
  title: string;
  enabled: boolean;
  onToggle: (v: boolean) => void;
  disabled?: boolean;
  children: React.ReactNode;
}> = ({ title, enabled, onToggle, disabled, children }) => {
  const [expanded, setExpanded] = useState(true);
  return (
    <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50/60 overflow-hidden">
      <div className="flex items-center gap-3 pr-3 sm:pr-4">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="flex min-w-0 flex-1 items-center gap-3 p-3 sm:p-4 text-left hover:bg-slate-100/60 transition-colors"
        >
          <div className="flex min-w-0 items-center gap-2">
            <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform duration-300 ${expanded ? "rotate-0" : "-rotate-90"}`} />
            <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
          </div>
        </button>
        <Switch checked={enabled} onChange={onToggle} size="sm" disabled={disabled} />
      </div>
      <div className="grid transition-[grid-template-rows] duration-300 ease-in-out" style={{ gridTemplateRows: expanded ? "1fr" : "0fr" }}>
        <div className="overflow-hidden">
          <div className="space-y-4 border-t border-slate-200 p-3 pt-4 sm:p-4 sm:pt-4">{children}</div>
        </div>
      </div>
    </div>
  );
};

/**
 * The fields of the stamp of a report: its text, colour, font, opacity and the pages it is on. Where it sits and how wide it is are set by dragging it on
 * the preview; Reset Position puts it back in the top right corner at its natural size.
 */
export const ReportStampFields: React.FC<{
  text: string;
  stamp: ReportStamp;
  disabled?: boolean;
  onText: (text: string) => void;
  onChange: (patch: Partial<ReportStamp>) => void;
}> = ({ text, stamp, disabled, onText, onChange }) => (
  <>
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Field label="Text" hint="Letters, digits and . , : ; / ( ) -">
          <input className={FIELD_INPUT} value={text} maxLength={40} onChange={(e) => onText(e.target.value)} disabled={disabled} />
        </Field>
      </div>
      <Field label="Color">
        <ColorPickerInput value={stamp.color} onChange={(color) => onChange({ color })} disabled={disabled} />
      </Field>
      <Select
        label="Font"
        value={stamp.font}
        onChange={(font) => onChange({ font: String(font) as ReportFontFamily })}
        options={FONT_OPTIONS}
        enableSearch={false}
        disabled={disabled}
      />
      <NumberField label="Opacity (%)" hint="30 to 100" value={stamp.opacity} min={30} max={100} disabled={disabled} onChange={(opacity) => onChange({ opacity })} />
      <Select
        label="Pages"
        value={stamp.pages}
        onChange={(pages) => onChange({ pages: String(pages) as ReportStamp["pages"] })}
        options={PAGE_OPTIONS}
        enableSearch={false}
        disabled={disabled}
      />
    </div>
    {!disabled && (stamp.x != null || stamp.y != null || stamp.width != null) && (
      <div className="mt-4 flex justify-end border-t border-slate-200 pt-3">
        <Button
          size="sm"
          variant="outline-emerald"
          aria-label="Reset Stamp Position"
          onClick={() => onChange({ x: undefined, y: undefined, width: undefined })}
        >
          Reset Position
        </Button>
      </div>
    )}
  </>
);
