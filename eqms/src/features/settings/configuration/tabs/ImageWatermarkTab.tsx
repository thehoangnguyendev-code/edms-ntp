import React, { useEffect, useRef, useState } from "react";
import { IconCamera, IconSignature } from "@tabler/icons-react";
import { WarningBanner } from "@/components/ui/banner/WarningBanner";
import { Button } from "@/components/ui/button/Button";
import { Checkbox } from "@/components/ui/checkbox/Checkbox";
import { FormSection } from "@/components/ui/form/FormSection";
import { Select } from "@/components/ui/select/Select";
import { Slider } from "@/components/ui/slider/Slider";
import { cn } from "@/components/ui/utils";
import { imageWatermarkApi, type ImageWatermarkPosition, type ImageWatermarkTarget } from "@/services/api/imageWatermark";
import type { GeneralConfig, ImageWatermarkSettings } from "../types";

/** The settings of a purpose that was never set up: evidence keeps the earlier behaviour (the system logo at the top left), a specimen signature is not stamped. */
export const WATERMARK_DEFAULTS: Record<ImageWatermarkTarget, Required<Omit<ImageWatermarkSettings, "logoData">>> = {
  controlledCopyEvidence: { enabled: true, showLogo: true, logoSource: "SYSTEM", showUploadedBy: false, showUploadedAt: false, position: "TOP_LEFT", sizePercent: 20, opacityPercent: 100, marginPercent: 3, textBackground: true },
  specimenSignature: { enabled: false, showLogo: true, logoSource: "SYSTEM", showUploadedBy: false, showUploadedAt: false, position: "TOP_LEFT", sizePercent: 20, opacityPercent: 100, marginPercent: 3, textBackground: true },
};

export const LOGO_MAX_BYTES = 2 * 1024 * 1024;
const PREVIEW_DELAY_MS = 400;

const POSITIONS: Array<{ value: ImageWatermarkPosition; label: string }> = [
  { value: "TOP_LEFT", label: "Top Left" },
  { value: "TOP_RIGHT", label: "Top Right" },
  { value: "BOTTOM_LEFT", label: "Bottom Left" },
  { value: "BOTTOM_RIGHT", label: "Bottom Right" },
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
  icon: React.ReactNode;
  value?: ImageWatermarkSettings;
  onChange: (value: ImageWatermarkSettings) => void;
}

/** One purpose: its settings on the left, and on the right the picture as the server would stamp it with them, before they are saved. */
export const ImageWatermarkCard: React.FC<CardProps> = ({ target, title, description, icon, value, onChange }) => {
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
    <FormSection title={title} icon={icon}>
      <div className="space-y-4">
        <div>
          <Checkbox id={`watermark-${target}-enabled`} label="Add a watermark to every picture uploaded here" checked={settings.enabled} onChange={(enabled) => set({ enabled })} />
          <p className="ml-7 mt-0.5 text-xs text-slate-500">{description}</p>
        </div>

        {settings.enabled && (
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <div className="space-y-4">
              <div>
                <Checkbox id={`watermark-${target}-logo`} label="Logo" checked={settings.showLogo} onChange={(showLogo) => set({ showLogo })} />
                {settings.showLogo && (
                  <div className="ml-7 mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Select
                      label="Logo Source"
                      value={settings.logoSource}
                      enableSearch={false}
                      onChange={(logoSource) => set({ logoSource: logoSource as "SYSTEM" | "CUSTOM" })}
                      options={[{ label: "System Logo", value: "SYSTEM" }, { label: "Custom Logo", value: "CUSTOM" }]}
                    />
                    {settings.logoSource === "CUSTOM" && (
                      <div>
                        <p className="mb-1.5 block text-xs font-medium text-slate-700 sm:text-sm">Custom Logo</p>
                        <div className="flex flex-wrap items-center gap-2">
                          {value?.logoData && <img src={value.logoData} alt="Custom watermark logo" className="h-9 max-w-24 rounded border border-slate-200 bg-white object-contain p-0.5" />}
                          <Button type="button" size="sm" variant="outline-emerald" onClick={() => logoInput.current?.click()}>{value?.logoData ? "Replace Logo" : "Upload Logo"}</Button>
                        </div>
                        <input ref={logoInput} type="file" accept="image/png,image/jpeg" className="hidden" aria-label={`Upload ${title} watermark logo`} onChange={(e) => { void pickLogo(e.target.files?.[0]); e.currentTarget.value = ""; }} />
                        <p className="mt-1 text-xs text-slate-500">PNG or JPEG, up to 2 MB.</p>
                      </div>
                    )}
                    {settings.logoSource === "SYSTEM" && <p className="self-end text-xs text-slate-500">The logo set in General. A logo that is not a PNG or JPEG is left out.</p>}
                  </div>
                )}
                {logoError && <p role="alert" className="ml-7 mt-1 text-xs text-red-600">{logoError}</p>}
              </div>

              <div>
                <p className="mb-2 text-xs font-medium text-slate-700 sm:text-sm">Text</p>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  <Checkbox id={`watermark-${target}-by`} label="Uploaded by" checked={settings.showUploadedBy} onChange={(showUploadedBy) => set({ showUploadedBy })} />
                  <Checkbox id={`watermark-${target}-at`} label="Upload time" checked={settings.showUploadedAt} onChange={(showUploadedAt) => set({ showUploadedAt })} />
                </div>
                <p className="mt-1.5 text-xs text-slate-500">The server writes the name of the signed-in user and its own clock, so neither can be changed by the person who uploads.</p>
                {(settings.showUploadedBy || settings.showUploadedAt) && (
                  <div className="mt-2">
                    <Checkbox id={`watermark-${target}-bg`} label="Light panel behind the text" checked={settings.textBackground} onChange={(textBackground) => set({ textBackground })} />
                  </div>
                )}
              </div>

              <div>
                <p className="mb-2 text-xs font-medium text-slate-700 sm:text-sm">Position</p>
                <div role="radiogroup" aria-label="Watermark position" className="grid grid-cols-2 gap-2 sm:max-w-sm">
                  {POSITIONS.map((position) => (
                    <button
                      key={position.value}
                      type="button"
                      role="radio"
                      aria-checked={settings.position === position.value}
                      onClick={() => set({ position: position.value })}
                      className={cn(
                        "rounded-lg border px-3 py-2 text-left text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40",
                        settings.position === position.value ? "border-emerald-500 bg-emerald-50 font-medium text-emerald-800" : "border-slate-200 bg-white text-slate-700 hover:border-emerald-300",
                      )}
                    >
                      {position.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
                <div>
                  <p className="flex justify-between text-xs font-medium text-slate-700 sm:text-sm"><span>Size</span><span className="text-slate-500">{settings.sizePercent}% of the picture width</span></p>
                  <Slider label="Watermark size" min={5} max={40} value={settings.sizePercent} onChange={(sizePercent) => set({ sizePercent })} />
                </div>
                <div>
                  <p className="flex justify-between text-xs font-medium text-slate-700 sm:text-sm"><span>Opacity</span><span className="text-slate-500">{settings.opacityPercent}%</span></p>
                  <Slider label="Watermark opacity" min={10} max={100} value={settings.opacityPercent} onChange={(opacityPercent) => set({ opacityPercent })} />
                </div>
                <div>
                  <p className="flex justify-between text-xs font-medium text-slate-700 sm:text-sm"><span>Distance from the edge</span><span className="text-slate-500">{settings.marginPercent}%</span></p>
                  <Slider label="Watermark margin" min={0} max={10} value={settings.marginPercent} onChange={(marginPercent) => set({ marginPercent })} />
                </div>
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-medium text-slate-700 sm:text-sm">Preview</p>
              <div className="relative grid min-h-[260px] place-items-center overflow-hidden rounded-xl border border-dashed border-slate-300 bg-slate-100 p-2" aria-busy={loading}>
                {nothingToStamp && <p className="px-6 text-center text-sm text-amber-700">Choose at least one thing to stamp: the logo, the uploader or the upload time.</p>}
                {!nothingToStamp && needsLogo && <p className="px-6 text-center text-sm text-amber-700">Upload the custom logo to see the preview.</p>}
                {!nothingToStamp && !needsLogo && preview && <img src={showOriginal && original ? original : preview.url} alt={showOriginal && original ? `${title} original picture` : `${title} watermark preview`} className={cn("max-h-[420px] w-full rounded object-contain transition-opacity", loading && "opacity-60")} />}
                {!nothingToStamp && !needsLogo && !preview && !previewError && <p className="text-sm text-slate-500">Making the preview…</p>}
                {previewError && <p role="alert" className="px-6 text-center text-sm text-red-700">{previewError}</p>}
              </div>
              {preview && !preview.applied && !nothingToStamp && !needsLogo && <p className="mt-1.5 text-xs text-amber-700">Not stamped: {preview.note ?? "the server returned the picture as it is"}.</p>}
              {preview?.applied && preview.note && <p className="mt-1.5 text-xs text-amber-700">{preview.note}.</p>}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Button type="button" size="sm" variant="outline-emerald" onClick={() => pictureInput.current?.click()}>Try With Your Own Picture</Button>
                <Button type="button" size="sm" variant="outline-emerald" disabled={nothingToStamp || needsLogo} aria-pressed={showOriginal} onClick={() => setShowOriginal((value) => !value)}>{showOriginal ? "Show With Watermark" : "Show Original"}</Button>
                {picture && <Button type="button" size="sm" variant="ghost" onClick={() => setPicture(null)}>Back To The Sample Picture</Button>}
                <span className="min-w-0 truncate text-xs text-slate-500">{picture ? picture.name : "A sample picture is shown."}</span>
                <input ref={pictureInput} type="file" accept="image/png,image/jpeg" className="hidden" aria-label={`Choose a picture to preview the ${title} watermark`} onChange={(e) => { setPicture(e.target.files?.[0] ?? null); e.currentTarget.value = ""; }} />
              </div>
              <p className="mt-1 text-xs text-slate-500">Made by the server with the settings on this screen, before they are saved. The picture is not stored. The name and time shown are yours and now.</p>
            </div>
          </div>
        )}
      </div>
    </FormSection>
  );
};

interface TabProps {
  config: GeneralConfig;
  onChange: (config: GeneralConfig) => void;
}

/** Settings > Configuration > Image Watermark: the stamp the server puts on a picture when it comes in as evidence of a destroyed copy or as a specimen signature. */
export const ImageWatermarkTab: React.FC<TabProps> = ({ config, onChange }) => {
  const watermark = config.imageWatermark ?? {};
  const setTarget = (target: ImageWatermarkTarget, value: ImageWatermarkSettings) => onChange({ ...config, imageWatermark: { ...watermark, [target]: value } });
  return (
    <div className="space-y-4 p-4 md:p-5">
      <WarningBanner
        variant="info"
        title="How the watermark works"
        description="The server stamps the picture when it receives it, and keeps the picture as it was uploaded beside the stamped one. People see the stamped picture; the original can be opened by those who compare it, and each opening is written to the Audit Trail. A change here applies to the pictures uploaded after it is saved: pictures already stored are not stamped again. Only PNG and JPEG pictures are accepted."
      />
      <ImageWatermarkCard
        target="controlledCopyEvidence"
        title="Controlled Copy Destruction Evidence"
        icon={<IconCamera className="h-4 w-4" />}
        description="Evidence photos of a damaged controlled copy. Stamped from the moment this was set up with the system logo at the top left."
        value={watermark.controlledCopyEvidence}
        onChange={(value) => setTarget("controlledCopyEvidence", value)}
      />
      <ImageWatermarkCard
        target="specimenSignature"
        title="Specimen Signature"
        icon={<IconSignature className="h-4 w-4" />}
        description="The two pictures of a specimen signature. They are compared by their strokes, so keep the stamp small and faint, in a corner; the original stays available."
        value={watermark.specimenSignature}
        onChange={(value) => setTarget("specimenSignature", value)}
      />
    </div>
  );
};
