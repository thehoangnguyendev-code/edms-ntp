import { trFormat as __ariaTrFormat } from "@/i18n";
import { ColorPickerInput } from "@/components/ui/color-picker/ColorPickerInput";
import { Select } from "@/components/ui/select/Select";
import { Button } from "@/components/ui/button/Button";
import { Checkbox } from '@/components/ui/checkbox/Checkbox';
import { IconPlus, IconTrash, IconArrowLeft, IconArrowRight } from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Slider } from '@/components/ui/slider';
import { api } from '@/services/api/client';
import {
  DEFAULT_PAGE_BACKGROUND,
  pageBackgroundCss,
  type PageBackground,
  type PageBackgroundMode,
} from "@/config/page-background";
import { tr, trFormat } from "@/i18n";

const MODES: { label: string; value: PageBackgroundMode }[] = [
  { get label() { return tr("System default"); }, value: "default" },
  { get label() { return tr("Solid color"); }, value: "solid" },
  { get label() { return tr("Linear gradient"); }, value: "linear" },
  { get label() { return tr("Radial gradient"); }, value: "radial" },
  { get label() { return tr("Conic gradient"); }, value: "conic" },
];

/** What "System default" is, for the sign-in page and for the main layout alike: Tailwind's bg-gray-100/50 (gray-100, half transparent). Keep it in step with AUTH_UI.pageWrapper and MainLayout. */
export const DEFAULT_PAGE_BACKGROUND_COLOR = 'rgba(243, 244, 246, 0.5)';

const VIDEO_EXTENSIONS = /\.(mp4|mov|m4v|3gp|webm|mkv|avi|wmv|asf|flv|mpg|mpeg|ts|mts|ogv|ogg)$/i;

export function PageBackgroundEditor({
  title,
  value,
  onChange,
  allowImage = false,
}: {
  title: string;
  value?: PageBackground | null;
  onChange: (value: PageBackground) => void;
  allowImage?: boolean;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [processing, setProcessing] = useState(false);
  const [videoPreview, setVideoPreview] = useState<string>();
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const draft = value ?? DEFAULT_PAGE_BACKGROUND;
  useEffect(() => {
    if (draft.mode !== 'video' || !draft.videoId) { setVideoPreview(undefined); return; }
    let active = true, url: string | undefined;
    api.get<Blob>(`/settings/system/auth-background-video/${draft.videoId}`, { responseType: 'blob' }).then(({ data }) => {
      if (active) { url = URL.createObjectURL(data); setVideoPreview(url); }
    }).catch(() => { if (active) setVideoPreview(undefined); });
    return () => { active = false; if (url) URL.revokeObjectURL(url); };
  }, [draft.mode, draft.videoId]);
  const reduceMotion = useReducedMotion();
  const nextId = useRef(0);
  const ids = useRef<number[]>([]);
  while (ids.current.length < draft.colors.length) ids.current.push(nextId.current++);
  if (ids.current.length > draft.colors.length) ids.current.length = draft.colors.length;
  const rowMotion = reduceMotion ? {} : { initial: { opacity: 0, y: -6 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -6 }, transition: { duration: 0.2, ease: 'easeOut' as const } };
  const patch = (next: Partial<PageBackground>) =>
    onChange({ ...draft, ...next });
  const gradient =
    draft.mode === "linear" ||
    draft.mode === "radial" ||
    draft.mode === "conic";
  const stops = draft.stops ?? draft.colors.map((_, i) => Math.round(i * 100 / (draft.colors.length - 1)));
  const reorder = (from: number, to: number) => {
    if (from === to) return;
    const colors = [...draft.colors];
    const [color] = colors.splice(from, 1);
    colors.splice(to, 0, color);
    const [id] = ids.current.splice(from, 1);
    ids.current.splice(to, 0, id);
    patch({ colors, stops });
  };
  const upload = (file?: File) => {
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 1048576) {
      setError('Choose a PNG, JPG or WebP image up to 1 MB.');
      return;
    }
    setError('');
    const reader = new FileReader();
    reader.onload = () => patch({ image: String(reader.result), mode: 'image', imageFit: draft.imageFit ?? 'cover', overlayColor: draft.overlayColor ?? '#000000', overlayOpacity: draft.overlayOpacity ?? 20 });
    reader.onerror = () => setError('Could not read the image. Please try again.');
    reader.readAsDataURL(file);
  };
  const uploadVideo = async (file?: File) => {
    if (!file) return;
    if (file.size > 30 * 1024 * 1024 || !VIDEO_EXTENSIONS.test(file.name)) { setError('Choose an MP4, MOV, M4V, 3GP, WebM, MKV, AVI, WMV, FLV, MPG, TS or OGV video up to 30 MB.'); return; }
    setError(''); setProcessing(true);
    try {
      const body = new FormData(); body.append('video', file);
      const result = await api.post<{ id: string }>('/settings/system/auth-background-video', body, { timeout: 150000 });
      patch({ mode: 'video', videoId: result.data.id, videoLoop: draft.videoLoop ?? true, overlayColor: draft.overlayColor ?? '#000000', overlayOpacity: draft.overlayOpacity ?? 20 });
    } catch { setError('Video could not be processed. Check the file and the 15-second limit, then try again.'); }
    finally { setProcessing(false); }
  };
  return (
    <div className="space-y-3 rounded-lg border border-slate-200 p-4">
      <h4 className="text-sm font-semibold text-slate-800">{tr(title)}</h4>
      <Select
        label={`${tr(title)} ${tr("background style")}`}
        value={draft.mode}
        options={(allowImage ? [...MODES, { label: tr('Background image'), value: 'image' }, { label: tr('Background video'), value: 'video' }] : MODES).map((option) => ({ ...option, label: tr(option.label) }))}
        onChange={(mode) => patch({ mode: mode as PageBackgroundMode })}
      />
      {draft.mode !== "default" && (
        <>
          {draft.mode === 'video' && <div className="space-y-3">
            <input ref={videoInput} aria-label={tr("Authentication background video")} type="file" accept=".mp4,.mov,.m4v,.3gp,.webm,.mkv,.avi,.wmv,.asf,.flv,.mpg,.mpeg,.ts,.mts,.ogv,.ogg,video/*" className="sr-only" onChange={(event) => { void uploadVideo(event.target.files?.[0]); event.target.value = ''; }} />
            <Button variant="outline-emerald" size="sm" loading={processing} loadingText={tr("Processing video...")} onClick={() => videoInput.current?.click()}>{draft.videoId ? tr('Replace Video') : tr('Upload Video')}</Button>
            <p className="text-xs text-slate-500">{tr("MP4, MOV, M4V, 3GP, WebM, MKV, AVI, WMV, FLV, MPG, TS or OGV; up to 30 MB and 15 seconds. Video is visible before sign-in.")}</p>
            {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
            <Checkbox label={tr("Repeat video")} checked={draft.videoLoop ?? true} onChange={(videoLoop) => patch({ videoLoop })} />
            <ColorPickerInput label={tr("Overlay color")} value={draft.overlayColor ?? '#000000'} onChange={(overlayColor) => patch({ overlayColor })} />
                <div className="text-sm text-slate-700">{tr("Overlay opacity")} ({draft.overlayOpacity ?? 20}%)<Slider label={tr("Overlay opacity")} value={draft.overlayOpacity ?? 20} onChange={(overlayOpacity) => patch({ overlayOpacity })} /></div>
            {videoPreview && <div className="relative h-32 overflow-hidden rounded-lg bg-slate-100"><video aria-label={tr("Video preview")} src={videoPreview} autoPlay muted playsInline loop={draft.videoLoop ?? true} className="h-full w-full object-cover" /><div className="pointer-events-none absolute inset-0" style={{ backgroundColor: draft.overlayColor ?? '#000000', opacity: (draft.overlayOpacity ?? 20) / 100 }} /></div>}
          </div>}
          {draft.mode === 'image' && <div className="space-y-3">
            <input ref={fileInput} aria-label={tr("Authentication background image")} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(event) => { upload(event.target.files?.[0]); event.target.value = ''; }} />
            <Button variant="outline-emerald" size="sm" onClick={() => fileInput.current?.click()}>{draft.image ? tr('Replace Image') : tr('Upload Image')}</Button>
            <p className="text-xs text-slate-500">{tr("PNG, JPG or WebP, up to 1 MB. Image is visible on the sign-in page.")}</p>
            {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
            <Select label={tr("Image display")} value={draft.imageFit ?? 'cover'} options={[{label:tr('Fill'),value:'cover'}, {label:tr('Fit'),value:'contain'}, {label:tr('Tile'),value:'repeat'}]} onChange={(imageFit) => patch({ imageFit: imageFit as 'cover' | 'contain' | 'repeat' })} />
            <ColorPickerInput label={tr("Overlay color")} value={draft.overlayColor ?? '#000000'} onChange={(overlayColor) => patch({ overlayColor })} />
                <div className="text-sm text-slate-700">{tr("Overlay opacity")} ({draft.overlayOpacity ?? 20}%)<Slider label={tr("Overlay opacity")} value={draft.overlayOpacity ?? 20} onChange={(overlayOpacity) => patch({ overlayOpacity })} /></div>
          </div>}
          {draft.mode !== 'image' && draft.mode !== 'video' && <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <AnimatePresence initial={false}>{(gradient ? draft.colors : draft.colors.slice(0, 1)).map(
              (color, index) => (
                <motion.div key={ids.current[index]} {...rowMotion} layout={!reduceMotion} className="flex min-w-0 items-end gap-2" draggable={gradient} onDragStart={() => setDragIndex(index)} onDragOver={(event) => { if (gradient) event.preventDefault(); }} onDrop={(event) => { event.preventDefault(); if (dragIndex !== null) reorder(dragIndex, index); setDragIndex(null); }} onDragEnd={() => setDragIndex(null)}>
                  <div className="min-w-0 flex-1">
                    <ColorPickerInput
                      label={gradient ? trFormat("Color {number}", { number: index + 1 }) : tr("Color")}
                      value={color}
                      onChange={(next) =>
                        patch({
                          colors: draft.colors.map((old, i) =>
                            i === index ? next : old,
                          ),
                        })
                      }
                    />
                  </div>
                  {gradient && draft.colors.length > 2 && (
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="destructive"
                      title={`Remove color ${index + 1}`}
                      className="h-9 w-9 shrink-0 md:h-9 md:w-9"
                      onClick={() => {
                        ids.current.splice(index, 1);
                        patch({
                          colors: draft.colors.filter((_, i) => i !== index), stops: stops.filter((_, i) => i !== index),
                        });
                      }}
                      aria-label={__ariaTrFormat("Remove color {v1}", { v1: index + 1 })}
                    >
                      <IconTrash className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  )}
                </motion.div>
              ),
            )}</AnimatePresence>
          </div>}
          {gradient && <div className="space-y-3 sm:space-y-4"><AnimatePresence initial={false}>{draft.colors.map((color, index) => <motion.div key={ids.current[index]} {...rowMotion} layout={!reduceMotion} className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600 sm:flex-nowrap">
            <span className="w-16 shrink-0">{tr("Color")} {index + 1}</span><Slider label={`Color ${index + 1} position`} min={index ? stops[index - 1] : 0} max={index < stops.length - 1 ? stops[index + 1] : 100} value={stops[index]} onChange={(value) => patch({ stops: stops.map((stop, i) => i === index ? value : stop) })} className="min-w-[5rem] flex-1" /><span className="w-10 text-right tabular-nums">{stops[index]}%</span>
            <div className="ml-auto flex gap-1"><Button variant="outline" size="icon-sm" className="h-9 w-9 md:h-9 md:w-9" title={`Move color ${index + 1} left`} aria-label={__ariaTrFormat("Move color {v1} left", { v1: index + 1 })} disabled={index === 0} onClick={() => reorder(index, index - 1)}><IconArrowLeft className="h-4 w-4" /></Button><Button variant="outline" size="icon-sm" className="h-9 w-9 md:h-9 md:w-9" title={`Move color ${index + 1} right`} aria-label={__ariaTrFormat("Move color {v1} right", { v1: index + 1 })} disabled={index === draft.colors.length - 1} onClick={() => reorder(index, index + 1)}><IconArrowRight className="h-4 w-4" /></Button></div>
          </motion.div>)}</AnimatePresence></div>}
          {gradient && draft.colors.length < 5 && (
            <Button
              type="button"
              size="sm"
              variant="default"
              className="gap-2"
              onClick={() => patch({ colors: [...draft.colors, "#FFFFFF"], stops: [...stops, 100] })}
            >
              <IconPlus className="h-4 w-4" aria-hidden="true" />
              {tr("Add Color")}
            </Button>
          )}
          {draft.mode === 'radial' && <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{(['centerX', 'centerY'] as const).map((key) => <div key={key} className="text-sm text-slate-700">{key === 'centerX' ? 'Center horizontal' : 'Center vertical'} ({draft[key] ?? 50}%)<Slider label={key === 'centerX' ? 'Center horizontal' : 'Center vertical'} value={draft[key] ?? 50} onChange={(value) => patch({ [key]: value })} /></div>)}</div>}
          {(draft.mode === "linear" || draft.mode === "conic") && (
            <label className="block text-xs font-medium text-slate-700 sm:text-sm capitalize">
              {tr("Angle (0–360°)")}
              <input
                type="number"
                min={0}
                max={360}
                step={1}
                value={draft.angle}
                onChange={(event) =>
                  patch({
                    angle: Math.min(
                      360,
                      Math.max(0, Math.trunc(Number(event.target.value) || 0)),
                    ),
                  })
                }
                className="mt-1.5 block h-9 w-full rounded-lg border border-slate-200 px-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </label>
          )}
          {draft.mode !== 'video' && <div
            aria-label={__ariaTrFormat("{v1} background preview", { v1: title })}
            className="h-20 rounded-lg border border-slate-200"
            style={{ background: pageBackgroundCss(draft) }}
          />}
        </>
      )}
      {draft.mode === "default" && (
        <div className="space-y-1.5">
          <div
            aria-label={__ariaTrFormat("{v1} background preview", { v1: title })}
            className="h-20 rounded-lg border border-slate-200 bg-white"
            style={{ background: DEFAULT_PAGE_BACKGROUND_COLOR }}
          />
          <p className="text-xs text-slate-500">
            {allowImage
              ? tr("The built-in Authentication background: light grey (bg-gray-100/50). Choose another style to replace it.")
              : tr("The built-in Main Layout background: light grey (bg-gray-100/50). Choose another style to replace it.")}
          </p>
        </div>
      )}
    </div>
  );
}
