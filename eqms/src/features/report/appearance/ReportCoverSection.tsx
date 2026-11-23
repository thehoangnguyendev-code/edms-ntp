import { FormField, Input } from "@/components/ui/form/ResponsiveForm";
import { IconFile } from "@tabler/icons-react";
import { FormSection } from "@/components/ui/form/FormSection";
import { Checkbox } from "@/components/ui/checkbox/Checkbox";
import { Switch } from "@/components/ui/switch/Switch";
import type { ReportLayout, ReportTextStyle } from "@/services/api/reportTemplates";
import { ReportTextStyleFields } from "./ReportTextStyleFields";
import { tr } from "@/i18n";

/** The cover page: shown before the first page of a report when it is on. Typed on the web; a Word file is no longer uploaded (REPORT-APPEARANCE-2026-11-14). */
export function ReportCoverSection({ value, onChange, disabled }: { value: ReportLayout; onChange: (value: ReportLayout) => void; disabled: boolean }) {
  const patch = (change: Partial<ReportLayout>) => onChange({ ...value, ...change });
  const off = disabled || !value.cover;
  const text = (key: "coverTitle" | "subtitle", styleKey: "coverTitleStyle" | "coverSubtitleStyle", label: string, max: number, defaultSize: number) => (
    <div className="space-y-3">
      <FormField label={label}>
        <Input value={value[key]} maxLength={max} disabled={off} onChange={(e) => patch({ [key]: e.target.value })} />
      </FormField>
      <ReportTextStyleFields
        label={label}
        title={`${label} font`}
        value={value[styleKey]}
        onChange={(style: ReportTextStyle | null) => patch({ [styleKey]: style })}
        disabled={off}
        reportFont={value.fontFamily ?? "NOTO_SANS"}
        defaultSize={defaultSize}
        withAlign
      />
    </div>
  );
  return (
    <FormSection title={tr("Cover Page")} icon={<IconFile className="h-4 w-4" />} headerRight={<Switch checked={value.cover} onChange={(cover) => patch({ cover })} size="sm" disabled={disabled} aria-label={tr("Enable cover")} />}>
      <div className="space-y-4">
        <div className="space-y-5">
          {text("coverTitle", "coverTitleStyle", "Report Title", 255, 22)}
          {text("subtitle", "coverSubtitleStyle", "Subtitle", 500, 12)}
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <Checkbox label={tr("Show report executor")} checked={value.showExecutor} disabled={off} onChange={(showExecutor) => patch({ showExecutor })} />
          <Checkbox label={tr("Show generation time (UTC+7)")} checked={value.showGeneratedAt} disabled={off} onChange={(showGeneratedAt) => patch({ showGeneratedAt })} />
        </div>
      </div>
    </FormSection>
  );
}
