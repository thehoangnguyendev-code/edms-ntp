import { tr as __ariaTr, trFormat as __ariaTrFormat } from "@/i18n";
import { useState } from "react";
import { FormField, Input, Textarea } from "@/components/ui/form/ResponsiveForm";
import { IconAlignCenter, IconAlignLeft, IconAlignRight, IconDroplet, IconLayoutBottombar, IconLayoutNavbar, IconListDetails, IconNote, IconPhoto, IconRubberStamp, IconUserCheck } from "@tabler/icons-react";
import { ReportCoverSection } from "./ReportCoverSection";
import { FormSection } from "@/components/ui/form/FormSection";
import { TabNav } from "@/components/ui/tabs/TabNav";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button/Button";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch/Switch";
import { Checkbox } from "@/components/ui/checkbox/Checkbox";
import { WatermarkFields } from "@/features/settings/document-administration/controlled-copies-policy/MarkingEditors";
import { ReportStampFields } from "../templates/ReportStampEditor";
import { AlignGroup, ReportTextStyleFields, SectionLabel } from "./ReportTextStyleFields";
import { LOGO_MAX_UPLOAD, readLogo } from "../templates/reportLogoImage";
import {
  defaultReportMark,
  defaultReportStamp,
  defaultApprovalColumns,
  effectiveReportFrame,
  type ReportApprovalColumn,
  type ReportFrame,
  type ReportLayout,
  type ReportLogo,
  type ReportMark,
  type ReportPlace,
  type ReportSlot,
} from "@/services/api/reportTemplates";
import { tr } from "@/i18n";

/** The parts of a page a person can point at (REPORT-APPEARANCE-2026-11-14). Each has one panel of fields. */
export type ZoneKey = "hl" | "hc" | "hr" | "logo" | "info" | "fl" | "fc" | "fr" | "appr" | "notes" | "wm" | "stamp" | "cover";

export const ZONE_TITLES: Record<ZoneKey, string> = {
  hl: "Header Left",
  hc: "Header Centre",
  hr: "Header Right",
  logo: "Logo",
  info: "Information Above The Table",
  fl: "Footer Left",
  fc: "Footer Centre",
  fr: "Footer Right",
  appr: "Approval Block",
  notes: "Notes Box",
  wm: "Watermark",
  stamp: "Stamp",
  cover: "Cover Page",
};

const TEXT_FIELD: Record<string, keyof ReportFrame> = {
  hl: "headerLeft",
  hc: "headerCenter",
  hr: "headerRight",
  fl: "footerLeft",
  fc: "footerCenter",
  fr: "footerRight",
};

const sizes = [6, 7, 8, 9, 10, 11, 12, 14, 16].map((n) => ({ value: String(n), label: `${n} pt` }));
const places: { value: ReportPlace; label: string }[] = [
  { value: "LEFT", label: "Left" },
  { value: "CENTER", label: "Centre" },
  { value: "RIGHT", label: "Right" },
];
const pageOptions = [
  { value: "ALL", get label() { return tr("Every page"); } },
  { value: "FIRST", get label() { return tr("First page only"); } },
];
/** The fields most often put in a header or footer; the rest are in the list under "More fields". */
export const defaultApprovalRoles = ["Prepared by", "Reviewed by", "Approved by"];
export const emptyLogo: ReportLogo = { enabled: false, data: "", x: 5, y: 8, width: 14, pages: "ALL", slot: "LEFT" };

/** The place the logo is in, whether it was chosen or comes from the position it had before it had a place. */
export const logoPlace = (logo: ReportLogo): ReportPlace =>
  logo.slot ?? (logo.x + logo.width / 2 < 100 / 3 ? "LEFT" : logo.x + logo.width / 2 < 200 / 3 ? "CENTER" : "RIGHT");

function Panel({ title, icon, toggle, children }: { title: string; icon?: React.ReactNode; toggle?: React.ReactNode; children: React.ReactNode }) {
  return (
    <FormSection title={title} icon={icon} headerRight={toggle}>
      <div className="min-w-0 space-y-4">{children}</div>
    </FormSection>
  );
}

/** A labelled control: the shared FormField, which binds the label to the control. */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <FormField label={label}>{children}</FormField>;
}

/** A switch with its name for people who cannot see which one it is. */
function Toggle({ label, checked, disabled, onChange }: { label: string; checked: boolean; disabled: boolean; onChange: (v: boolean) => void }) {
  return <Switch checked={checked} onChange={onChange} size="sm" disabled={disabled} aria-label={label} />;
}

const HEADER_ZONES: ZoneKey[] = ["hl", "hc", "hr"];
const FOOTER_ZONES: ZoneKey[] = ["fl", "fc", "fr"];
const PLACE_OF: Record<string, ReportPlace> = { hl: "LEFT", hc: "CENTER", hr: "RIGHT", fl: "LEFT", fc: "CENTER", fr: "RIGHT" };

/** The text of one place of the header or footer: the field chips add an automatic field at the end, never typed as a key. */
function PlaceText({ zone, value, onChange, disabled }: PanelProps) {
  const frame = effectiveReportFrame(value);
  const key = TEXT_FIELD[zone];
  const slot = frame[key] as ReportSlot;
  const header = zone[0] === "h";
  const title = tr(ZONE_TITLES[zone]);
  const set = (change: Partial<ReportSlot>) => onChange({ ...value, frame: { ...frame, [key]: { ...slot, ...change } } });
  return (
    <div className="space-y-4">
      <ReportTextStyleFields
        label={title}
        value={slot.style}
        onChange={(style) => set({ style })}
        disabled={disabled}
        reportFont={value.fontFamily ?? "NOTO_SANS"}
        defaultSize={header ? 9 : 7}
        size={{ value: slot.size, onChange: (next) => set({ size: next }), min: 6, max: 16 }}
        onClear={() => set({ style: null, size: null })}
      />
      <div className="space-y-3">
        <SectionLabel>{tr("Text")}</SectionLabel>
        <Field label={tr("Text (up to 5 lines)")}>
          <Textarea aria-label={title} rows={3} maxLength={300} value={slot.text} disabled={disabled} onChange={(e) => set({ text: e.target.value, enabled: true })} />
        </Field>
      </div>
    </div>
  );
}

const PLACE_NAMES: Record<ReportPlace, string> = { LEFT: "Left", CENTER: "Centre", RIGHT: "Right" };

/** One place of the header or the footer, as a section of its own with a switch: when it is off its text is kept and nothing is printed. */
function PlaceSection(props: PanelProps & { place: ZoneKey }) {
  const { value, onChange, disabled, place } = props;
  const frame = effectiveReportFrame(value);
  const key = TEXT_FIELD[place];
  const slot = frame[key] as ReportSlot;
  const header = place[0] === "h";
  const placeName = PLACE_OF[place];
  const on = slot.enabled ?? !!slot.text.trim();
  const Icon = placeName === "LEFT" ? IconAlignLeft : placeName === "CENTER" ? IconAlignCenter : IconAlignRight;
  const title = `${header ? "Header" : "Footer"} ${PLACE_NAMES[placeName].toLowerCase()}`;
  const setOn = (enabled: boolean) => onChange({ ...value, frame: { ...frame, [key]: { ...slot, enabled } } });
  return (
    <Panel
      title={title.charAt(0).toUpperCase() + title.slice(1)}
      icon={<Icon className="h-4 w-4" />}
      toggle={<Toggle label={`Show ${title.toLowerCase()}`} checked={on} disabled={disabled} onChange={setOn} />}
    >
      {on ? <PlaceText {...props} zone={place} /> : <p className="text-xs text-slate-500">{tr("Off: nothing is printed in this place.")}{slot.text.trim() ? " Its text is kept." : ""}</p>}
    </Panel>
  );
}

/** The header or the footer: three sections, one for each place (left, centre, right), each switched on or off by itself. */
function PlaceGroup(props: PanelProps) {
  const header = props.zone[0] === "h";
  const zones = header ? HEADER_ZONES : FOOTER_ZONES;
  return (
    <div className="space-y-4">
      {zones.map((zone) => (
        <PlaceSection key={zone} {...props} place={zone} />
      ))}
      {!header && (
        <FormSection title={tr("Page numbers")} icon={<IconListDetails className="h-4 w-4" />}>
          <div className="space-y-3">
            <Checkbox label={tr("Show page numbers")} checked={!!props.value.pageNumbers} disabled={props.disabled} onChange={(pageNumbers) => props.onChange({ ...props.value, pageNumbers })} />
            <p className="text-xs text-slate-500">{tr("The page number is added at the end of the right place. The statement of GMP status and the electronic signature of a signed run are always above the footer.")}</p>
          </div>
        </FormSection>
      )}
    </div>
  );
}

function LogoZone({ value, onChange, disabled, onError }: PanelProps) {
  const [busy, setBusy] = useState(false);
  const logo = value.logo ?? emptyLogo;
  const set = (change: Partial<ReportLogo>) => onChange({ ...value, logo: { ...logo, slot: logoPlace(logo), ...change } });
  return (
    <Panel title={tr("Logo")} icon={<IconPhoto className="h-4 w-4" />} toggle={<Toggle label={tr("Show logo")} checked={logo.enabled} disabled={disabled} onChange={(enabled) => set({ enabled })} />}>
      <label className="relative block cursor-pointer overflow-hidden rounded-lg border-2 border-dashed border-slate-200 bg-white p-4 text-center text-sm text-slate-600">
        {logo.data ? <img src={logo.data} alt="Report logo" className="mx-auto mb-3 max-h-16 max-w-full" /> : null}
        <span>{busy ? tr("Preparing the picture…") : tr("Upload PNG or JPEG · up to 10 MB")}</span>
        <span className="mt-1 block text-xs text-slate-500">{tr("A large picture is reduced to a size that suits the report when it is inserted.")}</span>
        <input
          aria-label={tr("Upload report logo")}
          type="file"
          accept="image/png,image/jpeg"
          className="sr-only"
          disabled={disabled}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            if (file.size > LOGO_MAX_UPLOAD || !["image/png", "image/jpeg"].includes(file.type)) {
              onError("Use a PNG or JPEG up to 10 MB.");
              return;
            }
            onError("");
            setBusy(true);
            void readLogo(file)
              .then((data) => set({ data, enabled: true }))
              .catch(() => onError("The image could not be read or reduced. Use another PNG or JPEG."))
              .finally(() => setBusy(false));
            e.target.value = "";
          }}
        />
      </label>
      <div className="space-y-1.5">
        <span className="block text-sm font-medium text-slate-700">{tr("Place in the header")}</span>
        <TabNav
          variant="pill"
          ariaLabel={__ariaTr("Logo place")}
          tabs={places.map((place) => ({ id: place.value, label: place.label }))}
          activeTab={logoPlace(logo)}
          onChange={(place) => !disabled && set({ slot: place as ReportPlace })}
        />
        <p className="text-xs text-slate-500">{tr("The logo has its own room in the header: the table starts below it, so it never covers the data. You can also drag it on the page.")}</p>
      </div>
      <FormField label={`Size: ${logo.width}% of the page width`}>
        <Slider label={tr("Logo size")} value={logo.width} min={5} max={60} onChange={(width) => !disabled && set({ width })} />
      </FormField>
      <Select label={tr("Pages")} value={logo.pages} options={pageOptions} enableSearch={false} disabled={disabled} onChange={(pages) => set({ pages: pages as "ALL" | "FIRST" })} />
    </Panel>
  );
}

function InfoZone({ value, onChange, disabled }: PanelProps) {
  const frame = effectiveReportFrame(value);
  const set = (change: Partial<ReportFrame>) => onChange({ ...value, frame: { ...frame, ...change } });
  const edit = (index: number, change: Partial<{ label: string; value: string }>) => set({ info: frame.info.map((x, i) => (i === index ? { ...x, ...change } : x)) });
  return (
    <Panel
            title={tr(ZONE_TITLES.info)}
      icon={<IconListDetails className="h-4 w-4" />}
      toggle={
        <TabNav
          variant="pill"
          ariaLabel={__ariaTr("Columns")}
          tabs={[{ id: "1", label: "1 column" }, { id: "2", label: "2 columns" }]}
          activeTab={String(frame.infoColumns)}
          onChange={(n) => !disabled && set({ infoColumns: n === "1" ? 1 : 2 })}
        />
      }
    >
      <p className="text-xs text-slate-500">{tr("Lines of a label and a value above the table on the first page, and on the information sheet of an Excel file. Leave it empty to show nothing.")}</p>
      <div className="space-y-2">
        {frame.info.map((item, index) => (
          <div key={index} className="space-y-1.5 rounded-lg border border-slate-200 p-2.5">
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              <Input aria-label={__ariaTrFormat("Information label {v1}", { v1: index + 1 })} placeholder={tr("Label")} maxLength={60} value={item.label} disabled={disabled} onChange={(e) => edit(index, { label: e.target.value })} />
              <Input aria-label={__ariaTrFormat("Information value {v1}", { v1: index + 1 })} placeholder={tr("Value")} maxLength={200} value={item.value} disabled={disabled} onChange={(e) => edit(index, { value: e.target.value })} />
            </div>
            <div className="flex justify-end">
              <Button size="sm" variant="outline" disabled={disabled} aria-label={__ariaTrFormat("Remove information line {v1}", { v1: index + 1 })} onClick={() => set({ info: frame.info.filter((_, i) => i !== index) })}>
                {tr("Remove")}
              </Button>
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between gap-3">
        <Button size="sm" variant="outline-emerald" disabled={disabled || frame.info.length >= 16} onClick={() => set({ info: [...frame.info, { label: "", value: "" }] })}>
          {tr("Add information line")}
        </Button>
        <span className="text-xs text-slate-500">{frame.info.length} {tr("of 16")}</span>
      </div>
      <ReportTextStyleFields label={tr("Information label")} title={tr("Label font")} value={frame.infoLabelStyle} onChange={(infoLabelStyle) => set({ infoLabelStyle })} disabled={disabled} reportFont={value.fontFamily ?? "NOTO_SANS"} defaultSize={8} />
      <ReportTextStyleFields label={tr("Information value")} title={tr("Value font")} value={frame.infoValueStyle} onChange={(infoValueStyle) => set({ infoValueStyle })} disabled={disabled} reportFont={value.fontFamily ?? "NOTO_SANS"} defaultSize={8} withAlign />
    </Panel>
  );
}

function ApprovalZone({ value, onChange, disabled }: PanelProps) {
  const frame = effectiveReportFrame(value);
  const set = (change: Partial<ReportFrame>) => onChange({ ...value, frame: { ...frame, ...change } });
  const roles = frame.approvalRoles?.length ? frame.approvalRoles : defaultApprovalRoles;
  const columns = frame.approvalColumns?.length ? frame.approvalColumns : defaultApprovalColumns();
  const setColumn = (index: number, change: Partial<ReportApprovalColumn>) => set({ approvalColumns: columns.map((column, i) => (i === index ? { ...column, ...change } : column)) });
  return (
    <Panel title={tr(ZONE_TITLES.appr)} icon={<IconUserCheck className="h-4 w-4" />} toggle={<Toggle label={tr("Show approval block")} checked={frame.approval} disabled={disabled} onChange={(approval) => set({ approval })} />}>
      <p className="text-xs text-slate-500">
        {tr("A table for name, designation, signature and date, filled in when the report is printed: the lines below are its rows. On the last page. The electronic signature of a signed run is always shown in the footer of every page, whatever is set here.")}
      </p>
      <fieldset disabled={disabled || !frame.approval} className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <SectionLabel>{tr("Roles")}</SectionLabel>
          <AlignGroup label={tr("Roles")} value={frame.approvalStyle?.align} onChange={(align) => set({ approvalStyle: { ...(frame.approvalStyle ?? {}), align } })} disabled={disabled || !frame.approval} />
        </div>
        {roles.map((role, index) => (
          <div key={index} className="grid grid-cols-[1fr_auto] items-center gap-2">
            <Input aria-label={__ariaTrFormat("Approval line {v1}", { v1: index + 1 })} maxLength={40} value={role} onChange={(e) => set({ approvalRoles: roles.map((x, i) => (i === index ? e.target.value : x)) })} />
            <Button size="sm" variant="outline" aria-label={__ariaTrFormat("Remove approval line {v1}", { v1: index + 1 })} disabled={roles.length <= 1} onClick={() => set({ approvalRoles: roles.filter((_, i) => i !== index) })}>
              {tr("Remove")}
            </Button>
          </div>
        ))}
        <Button size="sm" variant="outline-emerald" disabled={roles.length >= 4} onClick={() => set({ approvalRoles: [...roles, ""] })}>
          {tr("Add approval line")}
        </Button>
      </fieldset>
      <fieldset disabled={disabled || !frame.approval} className="space-y-2">
        <SectionLabel>{tr("Columns")}</SectionLabel>
        {columns.map((column, index) => (
          <div key={index} className="grid grid-cols-[1fr_auto_auto] items-center gap-3">
            <Input aria-label={__ariaTrFormat("Approval column {v1}", { v1: index + 1 })} maxLength={30} value={column.label} onChange={(e) => setColumn(index, { label: e.target.value })} />
            <AlignGroup label={`Column ${index + 1}`} value={column.align} onChange={(align) => setColumn(index, { align })} disabled={disabled || !frame.approval} />
            <Switch checked={column.enabled !== false} onChange={(enabled) => setColumn(index, { enabled })} size="sm" disabled={disabled || !frame.approval} aria-label={__ariaTrFormat("Show approval column {v1}", { v1: index + 1 })} />
          </div>
        ))}
      </fieldset>
      <ReportTextStyleFields label={tr("Approval")} value={frame.approvalStyle} onChange={(approvalStyle) => set({ approvalStyle })} disabled={disabled || !frame.approval} reportFont={value.fontFamily ?? "NOTO_SANS"} defaultSize={9} />
    </Panel>
  );
}

function NotesZone({ value, onChange, disabled }: PanelProps) {
  const frame = effectiveReportFrame(value);
  const set = (change: Partial<ReportFrame>) => onChange({ ...value, frame: { ...frame, ...change } });
  return (
    <Panel title={tr(ZONE_TITLES.notes)} icon={<IconNote className="h-4 w-4" />} toggle={<Toggle label={tr("Show notes box")} checked={frame.notes} disabled={disabled} onChange={(notes) => set({ notes })} />}>
      <p className="text-xs text-slate-500">{tr("An empty box for handwritten notes, on the last page.")}</p>
      <FormField label={`Height: ${frame.notesHeight} points`}>
        <Slider label={tr("Notes box height")} value={frame.notesHeight} min={40} max={400} onChange={(notesHeight) => !disabled && frame.notes && set({ notesHeight })} />
      </FormField>
      <ReportTextStyleFields label={tr("Notes")} value={frame.notesStyle} onChange={(notesStyle) => set({ notesStyle })} disabled={disabled || !frame.notes} reportFont={value.fontFamily ?? "NOTO_SANS"} defaultSize={9} />
    </Panel>
  );
}

function WatermarkZone({ value, onChange, disabled }: PanelProps) {
  const watermark = value.watermarkStyle ?? defaultReportMark();
  const home = defaultReportMark();
  const moved = watermark.x !== home.x || watermark.y !== home.y || watermark.width !== home.width || watermark.rotation !== home.rotation;
  return (
    <Panel title={tr("Watermark")} icon={<IconDroplet className="h-4 w-4" />} toggle={<Toggle label={tr("Show watermark")} checked={value.watermarkEnabled} disabled={disabled} onChange={(watermarkEnabled) => onChange({ ...value, watermarkEnabled })} />}>
      <fieldset disabled={disabled} className="space-y-4">
        <WatermarkFields
          disabled={disabled}
          textHint={tr("Letters, digits and . , : ; / ( ) -")}
          opacityRange={[5, 50]}
          layerOptions={[
            { label: tr("Behind the content (text stays crisp)"), value: "BEHIND" },
            { label: tr("Above the content (always visible)"), value: "ABOVE" },
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
            if (key === "watermarkText") onChange({ ...value, watermark: String(next) });
            else {
              const style: Partial<ReportMark> = {};
              if (key === "watermarkColor") style.color = String(next);
              if (key === "watermarkOpacityPercent") style.opacity = Number(next);
              if (key === "watermarkPages") style.pages = next as ReportMark["pages"];
              if (key === "watermarkFontFamily") style.font = next as ReportMark["font"];
              if (key === "watermarkLayer") style.layer = next as ReportMark["layer"];
              onChange({ ...value, watermarkStyle: { ...watermark, ...style } });
            }
          }}
        />
        <p className="text-xs text-slate-500">{tr("Drag the watermark on the page to move it; its corners resize it and the upper handle rotates it.")}</p>
        {moved && (
          <Button size="sm" variant="outline-emerald" aria-label={tr("Reset Watermark Position")} onClick={() => onChange({ ...value, watermarkStyle: { ...watermark, x: home.x, y: home.y, width: home.width, rotation: home.rotation } })}>
            {tr("Reset Position")}
          </Button>
        )}
      </fieldset>
    </Panel>
  );
}

function StampZone({ value, onChange, disabled }: PanelProps) {
  const stamp = value.stampStyle ?? defaultReportStamp();
  return (
    <Panel title={tr("Stamp")} icon={<IconRubberStamp className="h-4 w-4" />} toggle={<Toggle label={tr("Show stamp")} checked={value.stampEnabled} disabled={disabled} onChange={(stampEnabled) => onChange({ ...value, stampEnabled })} />}>
      <ReportStampFields text={value.stamp} stamp={stamp} disabled={disabled} onText={(stampText) => onChange({ ...value, stamp: stampText })} onChange={(change) => onChange({ ...value, stampStyle: { ...stamp, ...change } })} />
      <p className="text-xs text-slate-500">{tr("A presentation stamp is not an electronic signature.")}</p>
    </Panel>
  );
}

interface PanelProps {
  zone: ZoneKey;
  value: ReportLayout;
  onChange: (value: ReportLayout) => void;
  disabled: boolean;
  onError: (message: string) => void;
  /** Choose another part of the page (the places of the header and of the footer are tabs of one panel). */
  onZone?: (zone: ZoneKey) => void;
}

/** The fields of one part of the page. */
export function ZonePanel(props: PanelProps) {
  switch (props.zone) {
    case "logo":
      return <LogoZone {...props} />;
    case "info":
      return <InfoZone {...props} />;
    case "appr":
      return <ApprovalZone {...props} />;
    case "notes":
      return <NotesZone {...props} />;
    case "wm":
      return <WatermarkZone {...props} />;
    case "stamp":
      return <StampZone {...props} />;
    case "cover":
      return <ReportCoverSection value={props.value} onChange={props.onChange} disabled={props.disabled} />;
    default:
      return <PlaceGroup {...props} />;
  }
}

