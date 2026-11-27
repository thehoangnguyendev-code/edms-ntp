import { tr as __ariaTr, trFormat as __ariaTrFormat } from "@/i18n";
import React, { useEffect, useRef, useState } from "react";
import { IconCamera, IconSignature } from "@tabler/icons-react";
import { WarningBanner } from "@/components/ui/banner/WarningBanner";
import { Button } from "@/components/ui/button/Button";
import { Checkbox } from "@/components/ui/checkbox/Checkbox";
import { Select } from "@/components/ui/select/Select";
import { Slider } from "@/components/ui/slider/Slider";
import { cn } from "@/components/ui/utils";
import { imageWatermarkApi, type ImageWatermarkPosition, type ImageWatermarkTarget } from "@/services/api/imageWatermark";
import type { GeneralConfig, ImageWatermarkSettings } from "../types";
import { ConfigTabs, HISTORY_TAB } from "./ConfigTabs";
import { ConfigHistory } from "./ConfigHistory";
import type { WatermarkTabId } from "./pageTabs";
import { tr, trFormat } from "@/i18n";

/** The settings of a purpose that was never set up: evidence keeps the earlier behaviour (the system logo at the top left), a specimen signature is not stamped. */
export const WATERMARK_DEFAULTS: Record<ImageWatermarkTarget, Required<Omit<ImageWatermarkSettings, "logoData">>> = {
  controlledCopyEvidence: { enabled: true, showLogo: true, logoSource: "SYSTEM", showUploadedBy: false, showUploadedAt: false, utcOffset: "+07:00", position: "TOP_LEFT", sizePercent: 20, opacityPercent: 100, marginPercent: 3, textBackground: true },
  specimenSignature: { enabled: false, showLogo: true, logoSource: "SYSTEM", showUploadedBy: false, showUploadedAt: false, utcOffset: "+07:00", position: "TOP_LEFT", sizePercent: 20, opacityPercent: 100, marginPercent: 3, textBackground: true },
};

export const LOGO_MAX_BYTES = 2 * 1024 * 1024;
const PREVIEW_DELAY_MS = 400;

/** Every time zone offset in use, as the server accepts it: -12:00 to +14:00. The label is how the stamp prints it. */
export const UTC_OFFSETS: Array<{ value: string; label: string }> = (() => {
  const list: Array<{ value: string; label: string }> = [];
  const zones = [-720, -660, -600, -570, -540, -480, -420, -360, -300, -270, -240, -210, -180, -120, -60, 0, 60, 120, 180, 210, 240, 270, 300, 330, 345, 360, 390, 420, 480, 525, 540, 570, 600, 630, 660, 720, 765, 780, 825, 840];
  for (const minutes of zones) {
    const hours = Math.floor(Math.abs(minutes) / 60);
    const rest = Math.abs(minutes) % 60;
    const sign = minutes < 0 ? "-" : "+";
    list.push({
      value: `${sign}${String(hours).padStart(2, "0")}:${String(rest).padStart(2, "0")}`,
      label: `UTC${sign}${hours}${rest ? `:${String(rest).padStart(2, "0")}` : ""}`,
    });
  }
  return list;
})();

const POSITIONS: Array<{ value: ImageWatermarkPosition; label: string }> = [
  { value: "TOP_LEFT", label: "Top Left" },
  { value: "TOP_RIGHT", label: "Top Right" },
  { value: "BOTTOM_LEFT", get label() { return tr("Bottom Left"); } },
  { value: "BOTTOM_RIGHT", get label() { return tr("Bottom Right"); } },
];

const readAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

/** Settings with the defaults filled in, as the server reads them. */
const resolved = (target: ImageWatermarkTarget, value?: ImageWatermarkSettings) => ({ ...WATERMARK_DEFAULTS[target], ...value });

interface CardProps {
  target: ImageWatermarkTarget;
  title: string;
  description: string;
  value?: ImageWatermarkSettings;
  onChange: (value: ImageWatermarkSettings) => void;
}

/** One purpose: its settings on the left, and on the right the picture as the server would stamp it with them, before they are saved. */
export const ImageWatermarkCard: React.FC<CardProps> = ({ target, title, description, value, onChange }) => {
  const settings = resolved(target, value);
  const set = (patch: ImageWatermarkSettings) => onChange({ ...(value ?? {}), ...patch });
  const logoInput = useRef<HTMLInputElement>(null);
  const pictureInput = useRef<HTMLInputElement>(null);
  const [picture, setPicture] = useState<File | null>(null);
  const [logoError, setLogoError] = useState("");
  const [preview, setPreview] = useState<{ url: string; applied: boolean; note?: string } | null>(null);
  const [previewError, setPreviewError] = useState("");
  const [loading, setLoading] = useState(false);
  // The same picture without the stamp, to compare with the stamped one.
  const [showOriginal, setShowOriginal] = useState(false);
  const [original, setOriginal] = useState<string | null>(null);

  const nothingToStamp = settings.enabled && !settings.showLogo && !settings.showUploadedBy && !settings.showUploadedAt;
  const needsLogo = settings.enabled && settings.showLogo && settings.logoSource === "CUSTOM" && !value?.logoData;
  const draftKey = JSON.stringify(value ?? {});

  // The server draws the preview with the code of a real upload, so it is asked again a moment after the last change.
  useEffect(() => {
    if (!settings.enabled || nothingToStamp || needsLogo) { setPreviewError(""); return; }
    let live = true;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const result = await imageWatermarkApi.configPreview(target, { ...settings, logoData: value?.logoData ?? null }, picture);
        if (!live) return;
        setPreview((previous) => {
          if (previous) URL.revokeObjectURL(previous.url);
          return { url: URL.createObjectURL(result.blob), applied: result.applied, note: result.note };
        });
        setPreviewError("");
      } catch {
        if (live) setPreviewError("The preview could not be made. Check the settings, then try again.");
      } finally {
        if (live) setLoading(false);
      }
    }, PREVIEW_DELAY_MS);
    return () => { live = false; window.clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey, picture, target, settings.enabled, nothingToStamp, needsLogo]);

  // The original is asked from the server with the watermark switched off: for the sample that is the only way to get it, and for a chosen picture it is the same picture re-encoded as the server would keep it.
  useEffect(() => {
    if (!showOriginal || !settings.enabled) return;
    let live = true;
    let url: string | undefined;
    imageWatermarkApi.configPreview(target, { ...settings, enabled: false, logoData: value?.logoData ?? null }, picture).then((result) => {
      if (!live) return;
      url = URL.createObjectURL(result.blob);
      setOriginal(url);
    }).catch(() => { if (live) setShowOriginal(false); });
    return () => { live = false; setOriginal(null); if (url) URL.revokeObjectURL(url); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showOriginal, picture, target, settings.enabled]);

  useEffect(() => () => { setPreview((previous) => { if (previous) URL.revokeObjectURL(previous.url); return null; }); }, []);

  const pickLogo = async (file?: File) => {
    if (!file) return;
    if (!["image/png", "image/jpeg"].includes(file.type)) { setLogoError("Use a PNG or JPEG picture."); return; }
    if (file.size > LOGO_MAX_BYTES) { setLogoError("The logo is larger than 2 MB."); return; }
    setLogoError("");
    set({ logoData: await readAsDataUrl(file), logoSource: "CUSTOM" });
  };

  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold text-slate-900">{title}</h3>
      <div className="space-y-4">
        <div>
          <Checkbox id={`watermark-${target}-enabled`} label={tr("Add a watermark to every picture uploaded here")} checked={settings.enabled} onChange={(enabled) => set({ enabled })} />
          <p className="ml-7 mt-0.5 text-xs text-slate-500">{description}</p>
        </div>

        {settings.enabled && (
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <div className="space-y-4">
              <div>
                <Checkbox id={`watermark-${target}-logo`} label={tr("Logo")} checked={settings.showLogo} onChange={(showLogo) => set({ showLogo })} />
                {settings.showLogo && (
                  <div className="ml-7 mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Select
                      label={tr("Logo Source")}
                      value={settings.logoSource}
                      enableSearch={false}
                      onChange={(logoSource) => set({ logoSource: logoSource as "SYSTEM" | "CUSTOM" })}
                      options={[{ label: tr("System Logo"), value: "SYSTEM" }, { label: tr("Custom Logo"), value: "CUSTOM" }]}
                    />
                    {settings.logoSource === "CUSTOM" && (
                      <div>
                        <p className="mb-1.5 block text-xs font-medium text-slate-700 sm:text-sm">{tr("Custom Logo")}</p>
                        <div className="flex flex-wrap items-center gap-2">
                          {value?.logoData && <img src={value.logoData} alt="Custom watermark logo" className="h-9 max-w-24 rounded border border-slate-200 bg-white object-contain p-0.5" />}
                          <Button type="button" size="sm" variant="outline-emerald" onClick={() => logoInput.current?.click()}>{value?.logoData ? tr("Replace Logo") : tr("Upload Logo")}</Button>
                        </div>
                        <input ref={logoInput} type="file" accept="image/png,image/jpeg" className="hidden" aria-label={__ariaTrFormat("Upload {v1} watermark logo", { v1: title })} onChange={(e) => { void pickLogo(e.target.files?.[0]); e.currentTarget.value = ""; }} />
                        <p className="mt-1 text-xs text-slate-500">{tr("PNG or JPEG, up to 2 MB.")}</p>
                      </div>
                    )}
                  </div>
                )}
                {logoError && <p role="alert" className="ml-7 mt-1 text-xs text-red-600">{logoError}</p>}
              </div>

              <div>
                <p className="mb-2 text-xs font-medium text-slate-700 sm:text-sm">{tr("Text")}</p>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  <Checkbox id={`watermark-${target}-by`} label={tr("Uploaded by")} checked={settings.showUploadedBy} onChange={(showUploadedBy) => set({ showUploadedBy })} />
                  <Checkbox id={`watermark-${target}-at`} label={tr("Upload time")} checked={settings.showUploadedAt} onChange={(showUploadedAt) => set({ showUploadedAt })} />
                </div>
                <p className="mt-1.5 text-xs text-slate-500">{tr("The server writes the name of the signed-in user and its own clock, so neither can be changed by the person who uploads.")}</p>
                {settings.showUploadedAt && (
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                    <Select
                      label={tr("Upload Time Zone")}
                      value={settings.utcOffset}
                      enableSearch={false}
                      onChange={(utcOffset) => set({ utcOffset: String(utcOffset) })}
                      options={UTC_OFFSETS}
                    />
                    <p className="mt-1.5 text-xs text-slate-500">{trFormat("Printed with the time, for example 02/11/2026 11:20:43 ({zone}).", { zone: UTC_OFFSETS.find((zone) => zone.value === settings.utcOffset)?.label ?? "UTC+7" })}</p>
                    </div>
                  </div>
                )}
                {(settings.showUploadedBy || settings.showUploadedAt) && (
                  <div className="mt-2">
                    <Checkbox id={`watermark-${target}-bg`} label={tr("Light panel behind the text")} checked={settings.textBackground} onChange={(textBackground) => set({ textBackground })} />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Select
                  label={tr("Position")}
                  value={settings.position}
                  enableSearch={false}
                  onChange={(position) => set({ position: position as ImageWatermarkPosition })}
                  options={POSITIONS}
                />
              </div>

              <div className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
                <div>
                  <p className="flex justify-between text-xs font-medium text-slate-700 sm:text-sm"><span>{tr("Size")}</span><span className="text-slate-500">{settings.sizePercent}{tr("% of the picture width")}</span></p>
                  <Slider label={tr("Watermark size")} min={5} max={40} value={settings.sizePercent} onChange={(sizePercent) => set({ sizePercent })} />
                </div>
                <div>
                  <p className="flex justify-between text-xs font-medium text-slate-700 sm:text-sm"><span>{tr("Opacity")}</span><span className="text-slate-500">{settings.opacityPercent}%</span></p>
                  <Slider label={tr("Watermark opacity")} min={10} max={100} value={settings.opacityPercent} onChange={(opacityPercent) => set({ opacityPercent })} />
                </div>
                <div>
                  <p className="flex justify-between text-xs font-medium text-slate-700 sm:text-sm"><span>{tr("Distance from the edge")}</span><span className="text-slate-500">{settings.marginPercent}%</span></p>
                  <Slider label={tr("Watermark margin")} min={0} max={10} value={settings.marginPercent} onChange={(marginPercent) => set({ marginPercent })} />
                </div>
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-medium text-slate-700 sm:text-sm">{tr("Preview")}</p>
              <div className="relative grid min-h-[260px] place-items-center overflow-hidden rounded-xl border border-dashed border-slate-300 bg-slate-100 p-2" aria-busy={loading}>
                {nothingToStamp && <p className="px-6 text-center text-sm text-amber-700">{tr("Choose at least one thing to stamp: the logo, the uploader or the upload time.")}</p>}
                {!nothingToStamp && needsLogo && <p className="px-6 text-center text-sm text-amber-700">{tr("Upload the custom logo to see the preview.")}</p>}
                {!nothingToStamp && !needsLogo && preview && <img src={showOriginal && original ? original : preview.url} alt={showOriginal && original ? `${title} original picture` : `${title} watermark preview`} className={cn("max-h-[420px] w-full rounded object-contain transition-opacity", loading && "opacity-60")} />}
                {!nothingToStamp && !needsLogo && !preview && !previewError && <p className="text-sm text-slate-500">{tr("Making the preview…")}</p>}
                {previewError && <p role="alert" className="px-6 text-center text-sm text-red-700">{previewError}</p>}
              </div>
              {preview && !preview.applied && !nothingToStamp && !needsLogo && <p className="mt-1.5 text-xs text-amber-700">{tr("Not stamped:")} {preview.note ?? tr("the server returned the picture as it is")}.</p>}
              {preview?.applied && preview.note && <p className="mt-1.5 text-xs text-amber-700">{preview.note}.</p>}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Button type="button" size="sm" variant="outline-emerald" onClick={() => pictureInput.current?.click()}>{tr("Try With Your Own Picture")}</Button>
                <Button type="button" size="sm" variant="outline-emerald" disabled={nothingToStamp || needsLogo} aria-pressed={showOriginal} onClick={() => setShowOriginal((value) => !value)}>{showOriginal ? "Show With Watermark" : "Show Original"}</Button>
                {picture && <Button type="button" size="sm" variant="ghost" onClick={() => setPicture(null)}>{tr("Back To The Sample Picture")}</Button>}
                <span className="min-w-0 truncate text-xs text-slate-500">{picture ? picture.name : "A sample picture is shown."}</span>
                <input ref={pictureInput} type="file" accept="image/png,image/jpeg" className="hidden" aria-label={__ariaTrFormat("Choose a picture to preview the {v1} watermark", { v1: title })} onChange={(e) => { setPicture(e.target.files?.[0] ?? null); e.currentTarget.value = ""; }} />
              </div>
              <p className="mt-1 text-xs text-slate-500">{tr("Made by the server with the settings on this screen, before they are saved. The picture is not stored. The name and time shown are yours and now.")}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const TABS = [
  { id: "controlled-copy", get label() { return tr("Controlled Copy Destruction Evidence"); }, icon: IconCamera },
  { id: "specimen-signature", get label() { return tr("Specimen Signature"); }, icon: IconSignature },
  HISTORY_TAB,
] as const;

const TARGET_OF_TAB: Record<Exclude<WatermarkTabId, "history">, ImageWatermarkTarget> = {
  "controlled-copy": "controlledCopyEvidence",
  "specimen-signature": "specimenSignature",
};

interface TabProps {
  config: GeneralConfig;
  onChange: (config: GeneralConfig) => void;
  /** The tab that is open. When the page keeps it (in the address), it is given here with onTabChange; otherwise the tab keeps its own. */
  activeTab?: WatermarkTabId;
  onTabChange?: (tab: WatermarkTabId) => void;
  /** What was last saved, to mark the tabs that hold a change that is not saved yet. */
  savedConfig?: GeneralConfig | null;
}

/** Settings > Configuration > Image Watermark: the stamp the server puts on a picture when it comes in as evidence of a destroyed copy or as a specimen signature. */
export const ImageWatermarkTab: React.FC<TabProps> = ({ config, onChange, activeTab: activeTabProp, onTabChange, savedConfig }) => {
  const [ownTab, setOwnTab] = useState<WatermarkTabId>("controlled-copy");
  const activeTab = activeTabProp ?? ownTab;
  const selectTab = (tab: WatermarkTabId) => { setOwnTab(tab); onTabChange?.(tab); };
  const watermark = config.imageWatermark ?? {};
  const changed = React.useMemo(() => {
    const set = new Set<WatermarkTabId>();
    if (!savedConfig) return set;
    (Object.keys(TARGET_OF_TAB) as Array<keyof typeof TARGET_OF_TAB>).forEach((tab) => {
      const target = TARGET_OF_TAB[tab];
      if (JSON.stringify(watermark[target] ?? null) !== JSON.stringify(savedConfig.imageWatermark?.[target] ?? null)) set.add(tab);
    });
    return set;
  }, [watermark, savedConfig]);
  const setTarget = (target: ImageWatermarkTarget, value: ImageWatermarkSettings) => onChange({ ...config, imageWatermark: { ...watermark, [target]: value } });
  const revert = (tab: keyof typeof TARGET_OF_TAB) => {
    const target = TARGET_OF_TAB[tab];
    const savedValue = savedConfig?.imageWatermark?.[target];
    const next = { ...watermark } as Record<string, unknown>;
    if (savedValue === undefined) delete next[target];
    else next[target] = JSON.parse(JSON.stringify(savedValue));
    onChange({ ...config, imageWatermark: next as typeof watermark });
  };
  return (
    <ConfigTabs
      tabs={TABS}
      activeTab={activeTab}
      onChange={selectTab}
      changed={changed}
      onReset={savedConfig ? (tab) => { if (tab !== "history") revert(tab); } : undefined}
      ariaLabel={__ariaTr("Image watermark sections")}
      idPrefix="image-watermark"
    >
      {activeTab === "controlled-copy" && (
        <ImageWatermarkCard
          target="controlledCopyEvidence"
          title={tr("Controlled Copy Destruction Evidence")}
          description={tr("Evidence photos of a damaged controlled copy. Stamped from the moment this was set up with the system logo at the top left.")}
          value={watermark.controlledCopyEvidence}
          onChange={(value) => setTarget("controlledCopyEvidence", value)}
        />
      )}
      {activeTab === "specimen-signature" && (
        <ImageWatermarkCard
          target="specimenSignature"
          title={tr("Specimen Signature")}
          description={tr("The two pictures of a specimen signature. They are compared by their strokes, so keep the stamp small and faint, in a corner; the original stays available.")}
          value={watermark.specimenSignature}
          onChange={(value) => setTarget("specimenSignature", value)}
        />
      )}
      {activeTab === "history" && <ConfigHistory page="image-watermark" />}
    </ConfigTabs>
  );
};
