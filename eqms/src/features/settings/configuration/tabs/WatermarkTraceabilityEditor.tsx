import React from 'react';
import { Select } from '@/components/ui/select/Select';
import { Slider } from '@/components/ui/slider/Slider';
import { Button } from '@/components/ui/button/Button';
import { Checkbox } from '@/components/ui/checkbox/Checkbox';
import { ColorPickerInput } from '@/components/ui/color-picker/ColorPickerInput';

/** The turn the watermark has always had; the range is what the server accepts. */
/** The watermark is drawn in Helvetica Bold on every line, in the PDF and in the OnlyOffice viewer; the sample uses the same face (Arial and Liberation Sans have the same letter widths). */
export const WATERMARK_FONT = 'Helvetica, Arial, "Liberation Sans", sans-serif';

export const DEFAULT_WATERMARK_ANGLE = 45;
export const MIN_WATERMARK_ANGLE = -90;
export const MAX_WATERMARK_ANGLE = 90;

/** The settings of a traceability watermark. The PDF preview and the OnlyOffice viewer keep them under the same names. */
export interface WatermarkFields {
  watermarkText?: string;
  watermarkShowViewerName?: boolean;
  watermarkShowOpenedAt?: boolean;
  watermarkShowEmployeeCode?: boolean;
  watermarkTiled?: boolean;
  watermarkColor?: string;
  watermarkStrength?: 'light' | 'standard' | 'strong';
  watermarkAngle?: number;
}

interface WatermarkTraceabilityEditorProps {
  /** Prefix of the ids of the checkboxes, so two editors on one screen never share an id. */
  idPrefix: string;
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  fields?: WatermarkFields;
  onChange: (patch: WatermarkFields) => void;
  description: string;
  textHint: string;
  sampleNote: string;
}

/**
 * "Watermark and Traceability": the text, strength, colour, angle, what is printed about the viewer (code, name, time) and the grid layout, with a sample that turns
 * and fades as the settings change. One editor for the PDF preview and the OnlyOffice viewer, so the two cannot drift apart.
 */
export const WatermarkTraceabilityEditor: React.FC<WatermarkTraceabilityEditorProps> = ({ idPrefix, enabled, onEnabledChange, fields, onChange, description, textHint, sampleNote }) => (
    <section className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 xl:col-span-2">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-slate-800">Watermark and Traceability</h3>
        <p className="mt-0.5 text-xs text-slate-500">{description}</p>
      </div>
      <Checkbox
        id={idPrefix}
        label="Enable watermarking"
        checked={enabled}
        onChange={onEnabledChange}
      />
      {enabled && (() => {
        const pdf = fields;
        const text = (pdf?.watermarkText ?? 'FOR PREVIEW ONLY').trim() || 'FOR PREVIEW ONLY';
        const colour = pdf?.watermarkColor ?? '#B3B3F5';
        const strength = pdf?.watermarkStrength ?? 'standard';
        const tiled = pdf?.watermarkTiled ?? false;
        const angle = Math.max(MIN_WATERMARK_ANGLE, Math.min(MAX_WATERMARK_ANGLE, Math.round(pdf?.watermarkAngle ?? DEFAULT_WATERMARK_ANGLE)));
        // The viewer line: code and name together, as the server prints them.
        const viewer = [pdf?.watermarkShowEmployeeCode ? 'NTP.0005' : null, pdf?.watermarkShowViewerName ? 'Nguyen The Hoang' : null]
          .filter(Boolean).join(' - ') || null;
        const sample = [
          text,
          viewer,
          pdf?.watermarkShowOpenedAt ? '16/10/2026 10:00:00' : null,
        ].filter((line): line is string => !!line);
        // The same opacity the server uses for each strength, so the sample is as faint or as strong as the real preview.
        const alpha = strength === 'light' ? 0.10 : strength === 'strong' ? 0.30 : 0.18;
        const mark = (
          // The server turns the text counter-clockwise by the angle; CSS turns clockwise, so the sample turns by minus the angle, at once while the slider moves.
          <div className="flex flex-col items-center gap-1 whitespace-nowrap text-center font-bold" style={{ color: colour, opacity: alpha, transform: `rotate(${-angle}deg)`, fontFamily: WATERMARK_FONT }} data-testid="watermark-sample-mark">
            {sample.map((line, index) => (
              <span key={index} className={index === 0 ? 'text-2xl font-bold' : 'text-sm font-bold'}>{line}</span>
            ))}
          </div>
        );
        return (
          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-700 sm:text-sm capitalize">Watermark text</label>
                <input
                  value={pdf?.watermarkText ?? 'FOR PREVIEW ONLY'}
                  onChange={(event) => onChange({ watermarkText: event.target.value.slice(0, 120) })}
                  maxLength={120}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-emerald-500"
                  placeholder="FOR PREVIEW ONLY"
                />
                <p className="mt-1 text-xs text-slate-500">{textHint}</p>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Select
                    label="Strength"
                    value={strength}
                    onChange={(value) => onChange({ watermarkStrength: value as 'light' | 'standard' | 'strong' })}
                    enableSearch={false}
                    options={[
                      { label: 'Light', value: 'light' },
                      { label: 'Standard', value: 'standard' },
                      { label: 'Strong', value: 'strong' },
                    ]}
                  />
                </div>
                <div>
                  <p className="mb-1.5 block text-xs font-medium text-slate-700 sm:text-sm">Colour</p>
                  <ColorPickerInput value={colour} onChange={(value) => onChange({ watermarkColor: value })} />
                </div>
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <p className="text-xs font-medium text-slate-700 sm:text-sm">Angle</p>
                  <div className="flex items-center gap-2">
                    <span className="min-w-[3.5ch] text-right text-xs font-semibold tabular-nums text-slate-700 sm:text-sm" aria-live="polite" data-testid="watermark-angle-value">{angle}°</span>
                    {angle !== DEFAULT_WATERMARK_ANGLE && (
                      <Button type="button" size="xs" variant="ghost" onClick={() => onChange({ watermarkAngle: DEFAULT_WATERMARK_ANGLE })}>
                        Reset
                      </Button>
                    )}
                  </div>
                </div>
                <Slider label="Watermark angle" min={MIN_WATERMARK_ANGLE} max={MAX_WATERMARK_ANGLE} value={angle} onChange={(value) => onChange({ watermarkAngle: value })} />
              </div>

              <div>
                <p className="mb-2 text-xs font-medium text-slate-700 sm:text-sm">Shown on each page of the preview</p>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  <Checkbox id={`${idPrefix}-employee`} label="Viewer employee ID" checked={pdf?.watermarkShowEmployeeCode ?? false} onChange={(checked) => onChange({ watermarkShowEmployeeCode: checked })} />
                  <Checkbox id={`${idPrefix}-viewer`} label="Viewer Employee Name" checked={pdf?.watermarkShowViewerName ?? false} onChange={(checked) => onChange({ watermarkShowViewerName: checked })} />
                  <Checkbox id={`${idPrefix}-opened-at`} label="Time the preview was opened" checked={pdf?.watermarkShowOpenedAt ?? false} onChange={(checked) => onChange({ watermarkShowOpenedAt: checked })} />
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-medium text-slate-700 sm:text-sm">Layout</p>
                <Checkbox id={`${idPrefix}-tiled`} label="Repeat the watermark as a grid" checked={tiled} onChange={(checked) => onChange({ watermarkTiled: checked })} />
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-medium text-slate-700 sm:text-sm">Sample</p>
              <div className="relative grid h-[260px] place-items-center overflow-hidden rounded-xl border border-dashed border-slate-300 bg-white">
                {tiled ? (
                  <div className="pointer-events-none absolute inset-0 overflow-hidden">
                    {/* The same lattice as the server: copies on rows that run along the text, scaled to the box. */}
                    {[-2, -1, 0, 1, 2].flatMap((i) => [-2, -1, 0, 1, 2].map((j) => {
                      // The lattice turns with the text, as on the server: one step along the text and one across it (scaled to the box).
                      const radians = (angle * Math.PI) / 180;
                      const along = Math.cos(radians) * 0.67;
                      const across = Math.sin(radians) * 0.67;
                      const x = i * 420 * along - j * 240 * across;
                      const y = -(i * 420 * across) - j * 240 * along;
                      return (
                        <div key={`${i}-${j}`} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ transform: `translate(${x}px, ${y}px) translate(-50%, -50%)` }}>
                          {mark}
                        </div>
                      );
                    }))}
                  </div>
                ) : (
                  <div className="pointer-events-none">{mark}</div>
                )}
                <p className="absolute bottom-2 left-0 right-0 text-center text-2xs text-slate-400">{sampleNote}</p>
              </div>
            </div>
          </div>
        );
      })()}
    </section>
);
