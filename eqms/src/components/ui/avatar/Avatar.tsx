import React, { useEffect, useState } from 'react';
import { cn } from '@/components/ui/utils';
import { getInitials } from '@/utils/format';

export type AvatarTone = 'auto' | 'brand' | 'solid';

export interface AvatarProps {
  /** Display name — used for the initials fallback and the image `alt`. */
  name: string;
  /** Image URL. When missing, empty, or it fails to load, initials are shown instead. */
  src?: string | null;
  /**
   * Colour treatment for the initials fallback:
   * - `auto` (default): a stable pastel derived from `name`
   * - `brand`: emerald tint (matches the app header / user tables)
   * - `solid`: filled emerald with white text
   */
  tone?: AvatarTone;
  /** Extra classes on the container — use this for sizing (`h-8 w-8`), font size, ring, etc. */
  className?: string;
  /** Extra classes on the `<img>` element. */
  imgClassName?: string;
}

// -100 / -700 / -200 Tailwind triples that all read well as an initials chip.
const PALETTE: { bg: string; text: string; border: string }[] = [
  { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200' },
  { bg: 'bg-sky-100', text: 'text-sky-700', border: 'border-sky-200' },
  { bg: 'bg-violet-100', text: 'text-violet-700', border: 'border-violet-200' },
  { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200' },
  { bg: 'bg-rose-100', text: 'text-rose-700', border: 'border-rose-200' },
  { bg: 'bg-teal-100', text: 'text-teal-700', border: 'border-teal-200' },
  { bg: 'bg-indigo-100', text: 'text-indigo-700', border: 'border-indigo-200' },
  { bg: 'bg-fuchsia-100', text: 'text-fuchsia-700', border: 'border-fuchsia-200' },
];

function paletteFor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

/**
 * User avatar with a guaranteed graceful fallback: if `src` is absent or the image
 * errors, the person's initials are rendered instead of a broken-image icon.
 */
export const Avatar: React.FC<AvatarProps> = ({ name, src, tone = 'auto', className, imgClassName }) => {
  const [failed, setFailed] = useState(false);
  const safeSrc = typeof src === 'string' ? src.trim() : '';
  useEffect(() => setFailed(false), [safeSrc]);

  const safeName = name?.trim() || 'User';
  // A `data:image/...;base64,` URI whose payload is only a few bytes cannot be a real
  // image (e.g. just the 8-byte PNG signature) — treat it as absent.
  const isStubDataUri = (() => {
    const m = safeSrc.match(/^data:image\/[a-z.+-]+;base64,(.*)$/i);
    return !!m && m[1].length < 64;
  })();
  // Ignore empty strings, `"null"`/`"undefined"` placeholders and other non-http(s)/data junk.
  const usableSrc =
    safeSrc &&
    safeSrc !== 'null' &&
    safeSrc !== 'undefined' &&
    !safeSrc.startsWith('blob:null') &&
    !isStubDataUri
      ? safeSrc
      : '';
  const showImg = !!usableSrc && !failed;

  const toneClasses =
    tone === 'solid'
      ? 'bg-emerald-600 text-white border-emerald-100'
      : tone === 'brand'
        ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
        : (() => {
            const p = paletteFor(safeName);
            return `${p.bg} ${p.text} ${p.border}`;
          })();

  return (
    <div
      className={cn(
        'relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border text-xs font-semibold',
        toneClasses,
        className,
      )}
    >
      <span aria-hidden="true">{getInitials(safeName)}</span>
      {showImg && (
        <img
          src={usableSrc}
          alt={safeName}
          className={cn('absolute inset-0 h-full w-full object-cover', imgClassName)}
          onError={() => setFailed(true)}
          onLoad={(e) => {
            // A 200 response that isn't a real image (e.g. an SPA HTML fallback) never fires
            // onError in some browsers — catch it here so we still fall back to initials.
            if (e.currentTarget.naturalWidth === 0) setFailed(true);
          }}
        />
      )}
    </div>
  );
};
