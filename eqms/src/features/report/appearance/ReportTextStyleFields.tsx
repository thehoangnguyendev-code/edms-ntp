import { useState } from "react";
import { IconAlignCenter, IconAlignLeft, IconAlignRight, IconBold, IconItalic, IconUnderline } from "@tabler/icons-react";
import { FormField, Input } from "@/components/ui/form/ResponsiveForm";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button/Button";
import { ColorPickerInput } from "@/components/ui/color-picker/ColorPickerInput";
import { cn } from "@/components/ui/utils";
import type { ReportFontFamily, ReportTextStyle } from "@/services/api/reportTemplates";

export const REPORT_FONTS: { value: ReportFontFamily; label: string }[] = [
  { value: "NOTO_SANS", label: "Noto Sans" },
  { value: "NOTO_SERIF", label: "Noto Serif" },
  { value: "TIMES_NEW_ROMAN", label: "Times New Roman" },
  { value: "ROBOTO_MONO", label: "Roboto Mono" },
  { value: "OSWALD", label: "Oswald" },
];
const SAME_FONT = "__REPORT__";
const NO_TRANSFORM = "__NONE__";
const TRANSFORMS = [
  { value: NO_TRANSFORM, label: "None" },
  { value: "UPPERCASE", label: "Uppercase" },
  { value: "LOWERCASE", label: "Lowercase" },
  { value: "CAPITALIZE", label: "Capitalize each word" },
];

/** The bundled Noto, Roboto Mono and Oswald files are bold; Times New Roman (Tinos) is regular. A text with no bold setting looks like that, so the button shows it. */
export const legacyBold = (font: string) => font !== "TIMES_NEW_ROMAN";
export const effectiveBold = (style: ReportTextStyle | null | undefined, reportFont: string) => style?.bold ?? legacyBold(style?.font ?? reportFont);
const isPlain = (style: ReportTextStyle | null | undefined) => !style || Object.values(style).every((value) => value == null);

/** A group of icon buttons joined in one frame, as in the Placeholder Style window: each is a toggle (or a choice, in a group of alignments). */
function ButtonGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div role="group" aria-label={label} className="inline-flex overflow-hidden rounded-lg border border-slate-200 bg-white [&>button]:rounded-none [&>button]:border-0 [&>button+button]:border-l [&>button+button]:border-slate-200">
      {children}
    </div>
  );
}
/** A number typed from the keyboard: it is kept as typed while the person types (a "1" on the way to "12" is not a size) and made to fit its range when the field is left. */
function SizeInput({ label, min, max, placeholder, value, disabled, onCommit }: { label: string; min: number; max: number; placeholder?: string; value: number | null | undefined; disabled: boolean; onCommit: (size: number | null) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? (value == null ? "" : String(value));
  return (
    <Input
      aria-label={label}
      type="number"
      min={min}
      max={max}
      placeholder={placeholder}
      value={shown}
      disabled={disabled}
      onChange={(event) => {
        const raw = event.target.value;
        setDraft(raw);
        if (raw === "") onCommit(null);
        else if (Number(raw) >= min && Number(raw) <= max) onCommit(Math.round(Number(raw)));
      }}
      onBlur={() => {
        if (draft !== null && draft !== "") onCommit(Math.min(max, Math.max(min, Math.round(Number(draft)))));
        setDraft(null);
      }}
    />
  );
}

/** Left, centre and right as three joined icon buttons. */
export function AlignGroup({ label, value, onChange, disabled }: { label: string; value: "LEFT" | "CENTER" | "RIGHT" | null | undefined; onChange: (align: "LEFT" | "CENTER" | "RIGHT") => void; disabled?: boolean }) {
  const current = value ?? "LEFT";
  return (
    <ButtonGroup label={`${label} alignment`}>
      <IconToggle label={`${label} align left`} pressed={current === "LEFT"} disabled={disabled} onClick={() => onChange("LEFT")}>
        <IconAlignLeft className="h-4 w-4" />
      </IconToggle>
      <IconToggle label={`${label} align centre`} pressed={current === "CENTER"} disabled={disabled} onClick={() => onChange("CENTER")}>
        <IconAlignCenter className="h-4 w-4" />
      </IconToggle>
      <IconToggle label={`${label} align right`} pressed={current === "RIGHT"} disabled={disabled} onClick={() => onChange("RIGHT")}>
        <IconAlignRight className="h-4 w-4" />
      </IconToggle>
    </ButtonGroup>
  );
}

export function IconToggle({ label, pressed, onClick, disabled, children }: { label: string; pressed: boolean; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <Button
      size="xs"
      variant="ghost"
      disabled={disabled}
      aria-label={label}
      aria-pressed={pressed}
      onClick={onClick}
      className={cn("h-9 w-10 md:h-9 md:w-10 px-0", pressed ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-50" : "text-slate-600")}
    >
      {children}
    </Button>
  );
}

/** The small heading of a group of fields, as in the Placeholder Style window (USAGE, FONT, TEXT PROCESSING). */
export function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-2xs font-bold uppercase tracking-wider text-slate-400 md:text-xs">{children}</p>;
}

/**
 * The type of a text of the report, laid out as the FONT section of the Placeholder Style window (REPORT-TEXT-STYLE-2026-11-14): a row of font family, size and colour, and
 * under it a row of bold, italic, underline and, where the place lets the text be aligned, left, centre and right; "Clear style" at the end of the row. A value left alone
 * is the report as it was. The size is the style's own, or `size` when the place keeps it elsewhere (the places of the header and the footer). The server checks every value again.
 */
export function ReportTextStyleFields({
  label,
  title = "Font",
  value,
  onChange,
  disabled,
  reportFont,
  defaultSize,
  size,
  onClear,
  leading,
  withAlign = false,
}: {
  label: string;
  title?: string;
  value: ReportTextStyle | null | undefined;
  onChange: (style: ReportTextStyle | null) => void;
  disabled: boolean;
  reportFont: string;
  /** The size the text has when none is set. */
  defaultSize?: number;
  /** The size is kept outside the style (a place of the header or the footer): its value and how it changes. */
  size?: { value: number | null | undefined; onChange: (size: number | null) => void; min: number; max: number };
  /** Clears the style and the size in one change (a place whose size is kept outside the style). */
  onClear?: () => void;
  /** Put in front of the row of buttons (the place of the header or the footer): the row is then the first line and the small heading is left out. */
  leading?: React.ReactNode;
  withAlign?: boolean;
}) {
  const style = value ?? {};
  const set = (change: Partial<ReportTextStyle>) => {
    const next = { ...style, ...change };
    onChange(isPlain(next) ? null : next);
  };
  const bold = effectiveBold(style, reportFont);
  const align = style.align ?? "LEFT";
  const min = size?.min ?? 6, max = size?.max ?? 48;
  const sizeValue = size ? size.value : style.size;
  const commitSize = (next: number | null) => {
    if (size) size.onChange(next); else set({ size: next });
  };
  return (
    <div className="space-y-3" role="group" aria-label={`${label} style`}>
      {!leading && <SectionLabel>{title}</SectionLabel>}
      <div className="flex flex-wrap items-center gap-2">
        {leading}
        <ButtonGroup label={`${label} emphasis`}>
          <IconToggle label={`${label} bold`} pressed={bold} disabled={disabled} onClick={() => set({ bold: !bold })}>
            <IconBold className="h-4 w-4" />
          </IconToggle>
          <IconToggle label={`${label} italic`} pressed={!!style.italic} disabled={disabled} onClick={() => set({ italic: !style.italic })}>
            <IconItalic className="h-4 w-4" />
          </IconToggle>
          <IconToggle label={`${label} underline`} pressed={!!style.underline} disabled={disabled} onClick={() => set({ underline: !style.underline })}>
            <IconUnderline className="h-4 w-4" />
          </IconToggle>
        </ButtonGroup>
        {withAlign && <AlignGroup label={label} value={style.align} onChange={(next) => set({ align: next })} />}
        <Button size="xs" variant="outline" disabled={disabled || (isPlain(value) && sizeValue == null)} onClick={() => (onClear ? onClear() : onChange(null))} className="ml-auto">
          Clear style
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Select
          label="Font family"
          value={style.font ?? SAME_FONT}
          enableSearch={false}
          disabled={disabled}
          options={[{ value: SAME_FONT, label: "Report font" }, ...REPORT_FONTS]}
          onChange={(font) => set({ font: font === SAME_FONT ? null : (font as ReportFontFamily) })}
        />
        <FormField label="Font size (pt)">
          <SizeInput label={`${label} font size`} min={min} max={max} placeholder={defaultSize ? String(defaultSize) : undefined} value={sizeValue} disabled={disabled} onCommit={commitSize} />
        </FormField>
        <FormField label="Text color">
          <ColorPickerInput value={style.color ?? "#000000"} disabled={disabled} onChange={(color) => set({ color })} />
        </FormField>
        <Select
          label="Text transform"
          value={style.transform ?? NO_TRANSFORM}
          enableSearch={false}
          disabled={disabled}
          options={TRANSFORMS}
          onChange={(transform) => set({ transform: transform === NO_TRANSFORM ? null : (transform as ReportTextStyle["transform"]) })}
        />
      </div>
    </div>
  );
}
