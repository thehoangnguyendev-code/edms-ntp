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

const MODES: { label: string; value: PageBackgroundMode }[] = [
  { label: "System default", value: "default" },
  { label: "Solid color", value: "solid" },
  { label: "Linear gradient", value: "linear" },
  { label: "Radial gradient", value: "radial" },
  { label: "Conic gradient", value: "conic" },
];

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
      <h4 className="text-sm font-semibold text-slate-800">{title}</h4>
      <Select
        label={`${title} background style`}
        value={draft.mode}
        options={allowImage ? [...MODES, { label: 'Background image', value: 'image' }, { label: 'Background video', value: 'video' }] : MODES}
        onChange={(mode) => patch({ mode: mode as PageBackgroundMode })}
      />
      {draft.mode !== "default" && (
        <>
          {draft.mode === 'video' && <div className="space-y-3">
            <input ref={videoInput} aria-label="Authentication background video" type="file" accept=".mp4,.mov,.m4v,.3gp,.webm,.mkv,.avi,.wmv,.asf,.flv,.mpg,.mpeg,.ts,.mts,.ogv,.ogg,video/*" className="sr-only" onChange={(event) => { void uploadVideo(event.target.files?.[0]); event.target.value = ''; }} />
            <Button variant="outline-emerald" size="sm" loading={processing} loadingText="Processing video..." onClick={() => videoInput.current?.click()}>{draft.videoId ? 'Replace Video' : 'Upload Video'}</Button>
            <p className="text-xs text-slate-500">MP4, MOV, M4V, 3GP, WebM, MKV, AVI, WMV, FLV, MPG, TS or OGV; up to 30 MB and 15 seconds. Video is visible before sign-in.</p>
            {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
            <Checkbox label="Repeat video" checked={draft.videoLoop ?? true} onChange={(videoLoop) => patch({ videoLoop })} />
            <ColorPickerInput label="Overlay color" value={draft.overlayColor ?? '#000000'} onChange={(overlayColor) => patch({ overlayColor })} />
            <div className="text-sm text-slate-700">Overlay opacity ({draft.overlayOpacity ?? 20}%)<Slider label="Overlay opacity" value={draft.overlayOpacity ?? 20} onChange={(overlayOpacity) => patch({ overlayOpacity })} /></div>
            {videoPreview && <div className="relative h-32 overflow-hidden rounded-lg bg-slate-100"><video aria-label="Video preview" src={videoPreview} autoPlay muted playsInline loop={draft.videoLoop ?? true} className="h-full w-full object-cover" /><div className="pointer-events-none absolute inset-0" style={{ backgroundColor: draft.overlayColor ?? '#000000', opacity: (draft.overlayOpacity ?? 20) / 100 }} /></div>}
          </div>}
          {draft.mode === 'image' && <div className="space-y-3">
            <input ref={fileInput} aria-label="Authentication background image" type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(event) => { upload(event.target.files?.[0]); event.target.value = ''; }} />
            <Button variant="outline-emerald" size="sm" onClick={() => fileInput.current?.click()}>{draft.image ? 'Replace Image' : 'Upload Image'}</Button>
            <p className="text-xs text-slate-500">PNG, JPG or WebP, up to 1 MB. Image is visible on the sign-in page.</p>
            {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
            <Select label="Image display" value={draft.imageFit ?? 'cover'} options={[{label:'Fill',value:'cover'}, {label:'Fit',value:'contain'}, {label:'Tile',value:'repeat'}]} onChange={(imageFit) => patch({ imageFit: imageFit as 'cover' | 'contain' | 'repeat' })} />
            <ColorPickerInput label="Overlay color" value={draft.overlayColor ?? '#000000'} onChange={(overlayColor) => patch({ overlayColor })} />
            <div className="text-sm text-slate-700">Overlay opacity ({draft.overlayOpacity ?? 20}%)<Slider label="Overlay opacity" value={draft.overlayOpacity ?? 20} onChange={(overlayOpacity) => patch({ overlayOpacity })} /></div>
          </div>}
          {draft.mode !== 'image' && draft.mode !== 'video' && <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <AnimatePresence initial={false}>{(gradient ? draft.colors : draft.colors.slice(0, 1)).map(
              (color, index) => (
                <motion.div key={ids.current[index]} {...rowMotion} layout={!reduceMotion} className="flex min-w-0 items-end gap-2" draggable={gradient} onDragStart={() => setDragIndex(index)} onDragOver={(event) => { if (gradient) event.preventDefault(); }} onDrop={(event) => { event.preventDefault(); if (dragIndex !== null) reorder(dragIndex, index); setDragIndex(null); }} onDragEnd={() => setDragIndex(null)}>
                  <div className="min-w-0 flex-1">
                    <ColorPickerInput
                      label={gradient ? `Color ${index + 1}` : "Color"}
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
                      size="sm"
                      variant="destructive"
                      className="shrink-0 gap-2"
                      onClick={() => {
                        ids.current.splice(index, 1);
                        patch({
                          colors: draft.colors.filter((_, i) => i !== index), stops: stops.filter((_, i) => i !== index),
                        });
                      }}
                      aria-label={`Remove color ${index + 1}`}
                    >
                      <IconTrash className="h-4 w-4" aria-hidden="true" />
                      Remove
                    </Button>
                  )}
                </motion.div>
              ),
            )}</AnimatePresence>
          </div>}
          {gradient && <div className="space-y-3 sm:space-y-4"><AnimatePresence initial={false}>{draft.colors.map((color, index) => <motion.div key={ids.current[index]} {...rowMotion} layout={!reduceMotion} className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600 sm:flex-nowrap">
            <span className="w-16 shrink-0">Color {index + 1}</span><Slider label={`Color ${index + 1} position`} min={index ? stops[index - 1] : 0} max={index < stops.length - 1 ? stops[index + 1] : 100} value={stops[index]} onChange={(value) => patch({ stops: stops.map((stop, i) => i === index ? value : stop) })} className="min-w-[5rem] flex-1" /><span className="w-10 text-right tabular-nums">{stops[index]}%</span>
            <div className="ml-auto flex gap-1"><Button variant="ghost" size="icon-sm" aria-label={`Move color ${index + 1} left`} disabled={index === 0} onClick={() => reorder(index, index - 1)}><IconArrowLeft className="h-5 w-5" /></Button><Button variant="ghost" size="icon-sm" aria-label={`Move color ${index + 1} right`} disabled={index === draft.colors.length - 1} onClick={() => reorder(index, index + 1)}><IconArrowRight className="h-5 w-5" /></Button></div>
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
              Add Color
            </Button>
          )}
          {draft.mode === 'radial' && <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{(['centerX', 'centerY'] as const).map((key) => <div key={key} className="text-sm text-slate-700">{key === 'centerX' ? 'Center horizontal' : 'Center vertical'} ({draft[key] ?? 50}%)<Slider label={key === 'centerX' ? 'Center horizontal' : 'Center vertical'} value={draft[key] ?? 50} onChange={(value) => patch({ [key]: value })} /></div>)}</div>}
          {(draft.mode === "linear" || draft.mode === "conic") && (
            <label className="block text-xs font-medium text-slate-700 sm:text-sm">
              Angle (0–360°)
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
            aria-label={`${title} background preview`}
            className="h-20 rounded-lg border border-slate-200"
            style={{ background: pageBackgroundCss(draft) }}
          />}
        </>
      )}
    </div>
  );
}
