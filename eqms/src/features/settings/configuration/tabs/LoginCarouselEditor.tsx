import { trFormat as __ariaTrFormat } from "@/i18n";
import React from 'react';
import { Reorder, useDragControls } from 'framer-motion';
import { ArrowDown, ArrowUp, GripVertical, ImagePlus, RefreshCw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button/Button';
import { useToast } from '@/components/ui/toast/Toast';
import { LOGIN_CAROUSEL_LIMITS, type LoginCarouselConfig, type LoginCarouselSlide } from '@/services/api/branding';
import { readSlideImage, SLIDE_MAX_UPLOAD } from './readSlideImage';
import { LoginScreenPreview } from './LoginScreenPreview';
import { tr, trFormat } from "@/i18n";

interface LoginCarouselEditorProps {
  value?: LoginCarouselConfig | null;
  onChange: (value: LoginCarouselConfig | null) => void;
  /** The logo of the system, drawn in the preview. */
  logo?: string;
}

const fieldClass = 'w-full px-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500';
const { maxSlides, minSeconds, maxSeconds, defaultSeconds, maxTitle, maxSubtitle } = LOGIN_CAROUSEL_LIMITS;

let nextId = 0;
const newId = () => `slide-${(nextId += 1)}`;

interface SlideRowProps {
  id: string;
  index: number;
  count: number;
  slide: LoginCarouselSlide;
  busy: boolean;
  onPatch: (change: Partial<LoginCarouselSlide>) => void;
  onMove: (by: -1 | 1) => void;
  onRemove: () => void;
  onReplace: () => void;
}

/** One slide of the list. It is dragged by its handle, so the fields and the buttons keep working as usual. */
const SlideRow: React.FC<SlideRowProps> = ({ id, index, count, slide, busy, onPatch, onMove, onRemove, onReplace }) => {
  const controls = useDragControls();
  return (
    <Reorder.Item
      as="li"
      value={id}
      dragListener={false}
      dragControls={controls}
      whileDrag={{ scale: 1.01, boxShadow: '0 10px 30px rgba(15,23,42,0.15)' }}
      className="relative flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-3 sm:flex-row"
    >
      <div className="relative w-full shrink-0 self-start overflow-hidden rounded-lg bg-slate-100 sm:w-44">
        <img src={slide.image} alt={`Slide ${index + 1}`} draggable={false} className="aspect-[4/3] w-full object-cover" />
        <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-2xs font-medium text-white">{index + 1}</span>
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        <div>
          <label htmlFor={`login-slide-title-${id}`} className="mb-1 block text-xs font-medium text-slate-700">{tr("Title")}</label>
          <input
            id={`login-slide-title-${id}`}
            type="text"
            value={slide.title}
            maxLength={maxTitle}
            onChange={(e) => onPatch({ title: e.target.value.replace(/[\r\n\t]+/g, ' ').slice(0, maxTitle) })}
            className={`${fieldClass} h-9`}
            placeholder={tr("Keep your quality processes under control.")}
          />
        </div>
        <div>
          <label htmlFor={`login-slide-subtitle-${id}`} className="mb-1 block text-xs font-medium text-slate-700">{tr("Subtitle")}</label>
          <textarea
            id={`login-slide-subtitle-${id}`}
            value={slide.subtitle}
            maxLength={maxSubtitle}
            rows={2}
            onChange={(e) => onPatch({ subtitle: e.target.value.replace(/[\r\n\t]+/g, ' ').slice(0, maxSubtitle) })}
            className={`${fieldClass} resize-none py-2`}
            placeholder={tr("One short sentence under the title.")}
          />
          <p className="mt-0.5 text-right text-2xs tabular-nums text-slate-400">{slide.title.length}/{maxTitle} · {slide.subtitle.length}/{maxSubtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" variant="outline-emerald" disabled={busy} onClick={onReplace}>
            <RefreshCw className="mr-1.5 h-4 w-4" aria-hidden="true" />
            {tr("Change picture")}
          </Button>
          <Button type="button" size="sm" variant="ghost" aria-label={__ariaTrFormat("Move slide {v1} up", { v1: index + 1 })} disabled={index === 0} onClick={() => onMove(-1)}><ArrowUp className="h-4 w-4" aria-hidden="true" /></Button>
          <Button type="button" size="sm" variant="ghost" aria-label={__ariaTrFormat("Move slide {v1} down", { v1: index + 1 })} disabled={index === count - 1} onClick={() => onMove(1)}><ArrowDown className="h-4 w-4" aria-hidden="true" /></Button>
          <Button type="button" size="sm" variant="ghost" className="ml-auto text-red-600 hover:text-red-700" onClick={onRemove}>
            <Trash2 className="mr-1.5 h-4 w-4" aria-hidden="true" />
            {tr("Remove")}
          </Button>
        </div>
      </div>
      {count > 1 && (
        <button
          type="button"
          aria-label={__ariaTrFormat("Drag slide {v1} to change its place", { v1: index + 1 })}
          title={tr("Drag to change the order")}
          onPointerDown={(event) => controls.start(event)}
          className="absolute right-2 top-2 flex h-8 w-8 cursor-grab touch-none items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 active:cursor-grabbing sm:static sm:self-start"
        >
          <GripVertical className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
    </Reorder.Item>
  );
};

/**
 * The pictures, titles, subtitles and speed of the right-hand panel of the Split sign-in screen. Every slide has a picture from the moment it exists
 * (the picture is what the slide is made of), so the list can always be saved. With no slides the sign-in screen draws its product preview. Beside the list
 * the sign-in screen is drawn as it would be with the slides as they are now, saved or not. The slides are put in order by dragging a handle, or with the arrows.
 */
export const LoginCarouselEditor: React.FC<LoginCarouselEditorProps> = ({ value, onChange, logo }) => {
  const { showToast } = useToast();
  const slides = value?.slides ?? [];
  const seconds = value?.intervalSeconds ?? defaultSeconds;
  const addInput = React.useRef<HTMLInputElement>(null);
  const replaceInput = React.useRef<HTMLInputElement>(null);
  const replaceIndex = React.useRef(0);
  const [busy, setBusy] = React.useState(false);

  // a stable id for each slide, so a slide keeps its place in the list (and its focus) while the list is reordered
  const ids = React.useRef<string[]>([]);
  if (ids.current.length !== slides.length) ids.current = slides.map((_, i) => ids.current[i] ?? newId());

  const commit = (nextSlides: LoginCarouselSlide[], nextSeconds = seconds) =>
    onChange(nextSlides.length === 0 ? null : { intervalSeconds: nextSeconds, slides: nextSlides });
  const patch = (index: number, change: Partial<LoginCarouselSlide>) => commit(slides.map((slide, i) => (i === index ? { ...slide, ...change } : slide)));
  const reorder = (order: string[]) => {
    const previous = ids.current;
    ids.current = order;
    commit(order.map((id) => slides[previous.indexOf(id)]));
  };
  const move = (index: number, by: -1 | 1) => {
    const target = index + by;
    if (target < 0 || target >= slides.length) return;
    const order = ids.current.slice();
    [order[index], order[target]] = [order[target], order[index]];
    reorder(order);
  };
  const remove = (index: number) => {
    ids.current = ids.current.filter((_, i) => i !== index);
    commit(slides.filter((_, i) => i !== index));
  };

  const pick = async (file: File | undefined, apply: (image: string) => void) => {
    if (!file) return;
    if (!file.type.startsWith('image/') || file.type === 'image/svg+xml' || file.type === 'image/gif') {
      showToast({ type: 'error', title: tr('Invalid file'), message: 'Choose a PNG, JPG or WebP picture.' });
      return;
    }
    if (file.size > SLIDE_MAX_UPLOAD) {
      showToast({ type: 'error', title: tr('File too large'), message: `The picture must be smaller than ${Math.round(SLIDE_MAX_UPLOAD / 1024 / 1024)} MB.` });
      return;
    }
    setBusy(true);
    try {
      apply(await readSlideImage(file));
    } catch {
      showToast({ type: 'error', title: tr('Picture not used'), message: 'The picture could not be read or made small enough. Try another one.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-5 grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,540px)]">
      <div className="min-w-0">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-800">{tr("Right-hand panel slides")}</p>
            <p className="mt-0.5 text-xs text-slate-500">
              {trFormat("Pictures with a title and a subtitle that change by themselves on the sign-in screens. Up to {count} slides; PNG, JPG or WebP, reduced to fit automatically. With no slides the screen shows the product preview.", { count: maxSlides })}
            </p>
          </div>
          <Button type="button" size="sm" variant="outline-emerald" disabled={busy || slides.length >= maxSlides} onClick={() => addInput.current?.click()}>
            <ImagePlus className="mr-1.5 h-4 w-4" aria-hidden="true" />
            {tr("Add slide")}
          </Button>
        </div>

        <input
          ref={addInput}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.currentTarget.value = '';
            void pick(file, (image) => {
              ids.current = [...ids.current, newId()];
              commit([...slides, { title: '', subtitle: '', image }]);
            });
          }}
        />
        <input
          ref={replaceInput}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.currentTarget.value = '';
            const index = replaceIndex.current;
            void pick(file, (image) => patch(index, { image }));
          }}
        />

        <div className="mt-4 max-w-md">
          <div className="flex items-center justify-between">
            <label htmlFor="login-carousel-seconds" className="text-xs sm:text-sm font-medium text-slate-700">{tr("Time per slide")}</label>
            <span className="text-sm font-medium tabular-nums text-slate-800">{seconds} {tr("s")}</span>
          </div>
          <input
            id="login-carousel-seconds"
            type="range"
            min={minSeconds}
            max={maxSeconds}
            step={1}
            value={seconds}
            disabled={slides.length < 2}
            onChange={(e) => commit(slides, Number(e.target.value))}
            className="mt-1.5 w-full accent-emerald-700 disabled:opacity-50"
          />
          <p className="mt-1 text-xs text-slate-500">{slides.length < 2 ? 'Add a second slide to set the speed.' : `Each slide stays ${seconds} seconds (${minSeconds} to ${maxSeconds}). It rests while someone points at it.`}</p>
        </div>

        {slides.length === 0 ? (
          <div className="mt-4 rounded-lg border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-500">
            {tr("No slides yet. Use “Add slide” to choose the first picture.")}
          </div>
        ) : (
          <Reorder.Group as="ol" axis="y" values={ids.current} onReorder={reorder} className="mt-4 space-y-3">
            {ids.current.map((id, index) => (
              <SlideRow
                key={id}
                id={id}
                index={index}
                count={slides.length}
                slide={slides[index]}
                busy={busy}
                onPatch={(change) => patch(index, change)}
                onMove={(by) => move(index, by)}
                onRemove={() => remove(index)}
                onReplace={() => { replaceIndex.current = index; replaceInput.current?.click(); }}
              />
            ))}
          </Reorder.Group>
        )}
      </div>

      <div className="min-w-0">
        <div className="xl:sticky xl:top-4">
          <p className="mb-2 text-sm font-semibold text-slate-800">{tr("Preview")}</p>
          <LoginScreenPreview carousel={value} logo={logo} />
          <p className="mt-2 text-xs text-slate-500">{tr("The sign-in screen as it is with the slides above, before you save. The slides move at the speed you set.")}</p>
        </div>
      </div>
    </div>
  );
};
