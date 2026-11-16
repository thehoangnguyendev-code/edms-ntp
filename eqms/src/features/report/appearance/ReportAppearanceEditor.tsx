import { useState } from "react";
import { FormField, Input } from "@/components/ui/form/ResponsiveForm";
import { FormSection } from "@/components/ui/form/FormSection";
import { WarningBanner } from "@/components/ui/banner/WarningBanner";
import { Button } from "@/components/ui/button/Button";
import { Select } from "@/components/ui/select";
import { effectiveReportFrame, type ReportLayout } from "@/services/api/reportTemplates";
import { IconEye, IconSettings } from "@tabler/icons-react";
import { ReportLiveSheet } from "./ReportLiveSheet";
import { ReportPlaceholdersSection } from "./ReportPlaceholdersSection";
import { ZonePanel, type ZoneKey } from "./ReportZonePanels";

const fonts = [
  { value: "NOTO_SANS", label: "Noto Sans" },
  { value: "NOTO_SERIF", label: "Noto Serif" },
  { value: "TIMES_NEW_ROMAN", label: "Times New Roman" },
  { value: "ROBOTO_MONO", label: "Roboto Mono" },
  { value: "OSWALD", label: "Oswald" },
];
const papers = [
  { value: "LANDSCAPE", label: "Landscape" },
  { value: "PORTRAIT", label: "Portrait" },
];
/** The parts a person can point at, in the order of the quick buttons above the page. */
const QUICK: { zone: ZoneKey; label: string }[] = [
  { zone: "cover", label: "Cover Page" },
  { zone: "hl", label: "Header" },
  { zone: "logo", label: "Logo" },
  { zone: "info", label: "Information" },
  { zone: "fl", label: "Footer" },
  { zone: "appr", label: "Approval" },
  { zone: "notes", label: "Notes" },
  { zone: "wm", label: "Watermark" },
  { zone: "stamp", label: "Stamp" },
];
const HEADER_ZONES: ZoneKey[] = ["hl", "hc", "hr"];
const FOOTER_ZONES: ZoneKey[] = ["fl", "fc", "fr"];

/**
 * The appearance of the reports (REPORT-APPEARANCE-2026-11-14), on one screen made of sections like the other screens: the layout of the page (the page is drawn here from the layout being
 * edited, so every change shows at once, and a click on a part of it opens the fields of that part), the cover page, and the list of automatic fields. Nothing here decides
 * anything: the server checks every value again when it is saved.
 */
export function ReportAppearanceEditor({ value, onChange, disabled }: { value: ReportLayout; onChange: (value: ReportLayout) => void; disabled: boolean }) {
  const [selected, setSelected] = useState<ZoneKey>("hl");
  const [error, setError] = useState("");

  const frame = effectiveReportFrame(value);
  const closing = frame.approval || frame.notes;
  const tablePage = (value.cover ? 1 : 0) + 1;
  const closingPage = tablePage + 1;
  // The page shown follows the part that is chosen: the cover for the cover, the last page for approval and notes, the report page for the rest.
  const shownPage = selected === "cover" ? (value.cover ? 1 : tablePage) : selected === "appr" || selected === "notes" ? (closing ? closingPage : tablePage) : tablePage;
  const hasWord = Object.keys(value.wordComponents ?? {}).length > 0;

  const select = (zone: ZoneKey) => setSelected(zone);

  return (
    <div className="space-y-4">
      {hasWord && (
        <WarningBanner variant="warning" description="This layout still carries Word page templates from an earlier setup. They replace the header, footer or cover set on the page. Remove them to edit those parts here.">
          <Button size="sm" variant="outline" className="mt-2" disabled={disabled} onClick={() => onChange({ ...value, wordComponents: {} })}>
            Remove Word templates
          </Button>
        </WarningBanner>
      )}

      <>
          <FormSection title="Page Setup" icon={<IconSettings className="h-4 w-4" />}>
            <div className="grid gap-4 md:grid-cols-3">
              <Select label="Paper" value={value.orientation ?? "LANDSCAPE"} enableSearch={false} options={papers} disabled={disabled} onChange={(orientation) => onChange({ ...value, orientation: orientation as ReportLayout["orientation"] })} />
              <Select label="Report Font" value={value.fontFamily ?? "NOTO_SANS"} enableSearch={false} options={fonts} disabled={disabled} onChange={(fontFamily) => onChange({ ...value, fontFamily: fontFamily as ReportLayout["fontFamily"] })} />
              <FormField label="Company Name" hint="Printed wherever a text has {{company.name}}">
                <Input maxLength={120} value={frame.companyName} disabled={disabled} onChange={(e) => onChange({ ...value, frame: { ...frame, companyName: e.target.value } })} />
              </FormField>
            </div>
          </FormSection>
          <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-[minmax(0,9fr)_minmax(0,11fr)]">
            <FormSection title="Page Preview" icon={<IconEye className="h-4 w-4" />} className="flex min-w-0 flex-col" contentClassName="min-w-0 flex-1 space-y-3 p-3 md:p-4">
              <div data-testid="page-stage" className="min-w-0 space-y-3">
                <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Parts of the page">
                  <span className="mr-1 text-xs text-slate-500">Click on the page:</span>
                  {QUICK.map((quick) => {
                    const active = selected === quick.zone || (quick.zone === "hl" && HEADER_ZONES.includes(selected)) || (quick.zone === "fl" && FOOTER_ZONES.includes(selected));
                    return (
                      <Button key={quick.zone} size="xs" variant={active ? "outline-emerald" : "outline"} aria-pressed={active} onClick={() => select(quick.zone)} className="rounded-full">
                        {quick.label}
                      </Button>
                    );
                  })}
                </div>
                <ReportLiveSheet
                  layout={value}
                  page={shownPage}
                  tablePage={tablePage}
                  closingPage={closingPage}
                  selected={selected}
                  hot={[]}
                  disabled={disabled}
                  onSelect={select}
                  onChange={onChange}
                />
              </div>
            </FormSection>
            <aside className="min-w-0 space-y-4" aria-label="Properties of the part of the page">
              {error && <WarningBanner variant="error" description={error} />}
              <ZonePanel zone={selected} value={value} onChange={onChange} disabled={disabled} onError={setError} onZone={select} />
            </aside>
          </div>
      </>
      <ReportPlaceholdersSection />
    </div>
  );
}
