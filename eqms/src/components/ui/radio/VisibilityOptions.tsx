import React, { useCallback, useLayoutEffect, useRef } from "react";
import { cn } from "@/components/ui/utils";
import { gsap, prefersReducedMotion } from "@/lib/gsap";

export interface VisibilityOption {
  value: string;
  label: string;
  description: string;
  /** An optional icon drawn at the left of the card. */
  icon?: React.ReactNode;
  disabled?: boolean;
}

/**
 * The levels of a record-visibility choice side by side, one compact card each (the name and one line under it), so that three levels take one row
 * instead of three tall cards. A real radio input sits inside each card, so the keyboard and screen readers work as for any radio group.
 *
 * The emerald frame of the chosen card is one element that travels from card to card (GSAP): it only moves (it never changes size), runs a little past the new card and settles back
 * on it, like something with weight. It is put on the chosen card at once when the group is first drawn, whenever the layout of the cards changes, and with "reduce motion"; the cards
 * themselves never carry the frame, so a card is never drawn as chosen before the frame has arrived.
 */
export const VisibilityOptions: React.FC<{
  name: string;
  value: string;
  options: readonly VisibilityOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
}> = ({ name, value, options, onChange, disabled = false }) => {
  const group = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const cards = useRef(new Map<string, HTMLLabelElement>());
  /** The box the frame was last put on (null while it has not been placed). */
  const placed = useRef<{ x: number; y: number; width: number; height: number } | null>(null);
  const valueRef = useRef(value);
  valueRef.current = value;

  /** Where the frame belongs: the box of the chosen card inside the group. */
  const boxOf = useCallback(() => {
    const card = cards.current.get(valueRef.current);
    const root = group.current;
    if (!card || !root) return null;
    // Layout measures (offset*), not getBoundingClientRect: inside a dialog that is still scaling in, or any transformed parent, the rectangle on screen is scaled and shifted,
    // and the frame (which lives in the group's own coordinates) would be put on the wrong box. The group is the cards' offsetParent (it is "relative").
    return { x: card.offsetLeft, y: card.offsetTop, width: card.offsetWidth, height: card.offsetHeight };
  }, []);

  /** Puts the frame on the chosen card: at once, or (when it was already on another card) by running there and a little past it. */
  const place = useCallback((travel: boolean) => {
    const el = frame.current;
    if (!el) return;
    const box = boxOf();
    gsap.killTweensOf(el);
    if (!box) {
      gsap.set(el, { autoAlpha: 0 });
      placed.current = null;
      return;
    }
    const before = placed.current;
    placed.current = box;
    if (!travel || !before || prefersReducedMotion()) {
      gsap.set(el, { ...box, autoAlpha: 1 });
      return;
    }
    // The frame only moves: its size is the size of the card, which it takes at once (the cards of a group are alike), so it never swells or shrinks on the way.
    // It runs a little past the card, in the direction it was travelling, and comes back to it: the distance past is small (3 to 6.6 px) and about the same for a short move and a long one.
    gsap.set(el, { width: box.width, height: box.height, autoAlpha: 1 });
    const fromX = Number(gsap.getProperty(el, "x"));
    const fromY = Number(gsap.getProperty(el, "y"));
    const dx = box.x - fromX;
    const dy = box.y - fromY;
    const distance = Math.hypot(dx, dy) || 1;
    const past = Math.min(6.6, Math.max(3, distance * 0.018));
    gsap.timeline()
      .to(el, { x: box.x + (dx / distance) * past, y: box.y + (dy / distance) * past, duration: 0.34, ease: "power3.out" })
      .to(el, { x: box.x, y: box.y, duration: 0.36, ease: "power2.inOut" });
  }, [boxOf]);

  // A new choice moves the frame; the first drawing puts it on the chosen card at once.
  useLayoutEffect(() => {
    place(true);
  }, [value, place]);

  // The cards can change size or place after they are drawn (the style of the columns arrives a moment later, the window or the sidebar changes size, a font arrives late): the frame follows at once,
  // without the swing, so it is never left on the box of an earlier layout. An observer also reports once when it starts, so only a real change is followed.
  useLayoutEffect(() => {
    const root = group.current;
    if (!root || typeof ResizeObserver === "undefined") return undefined;
    const follow = () => {
      const box = boxOf();
      const el = frame.current;
      if (!box || !el || !placed.current) return;
      // Compared with where the frame really is, not with where it was last put: the first drawing can happen before the page's styles have reached the cards (the cards are then
      // stacked and wide), and the frame must not stay on that early box.
      const sizeOff = Math.abs(box.width - el.offsetWidth) + Math.abs(box.height - el.offsetHeight) > 1;
      if (gsap.isTweening(el) && !sizeOff) return; // the swing only moves the frame; a wrong size is never part of it
      const placeOff = Math.abs(box.x - Number(gsap.getProperty(el, "x"))) + Math.abs(box.y - Number(gsap.getProperty(el, "y"))) > 1;
      if (sizeOff || placeOff) place(false);
    };
    // Styles that arrive a moment after the first drawing do not always resize anything the observer sees, so the first second is also checked frame by frame.
    let frames = 0;
    let raf = 0;
    const settle = () => {
      follow();
      if (++frames < 60) raf = requestAnimationFrame(settle);
    };
    raf = requestAnimationFrame(settle);
    const observer = new ResizeObserver(follow);
    observer.observe(root);
    cards.current.forEach((card) => observer.observe(card));
    window.addEventListener("resize", follow);
    void document.fonts?.ready.then(follow);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      window.removeEventListener("resize", follow);
    };
  }, [boxOf, place, options.length]);

  return (
    <div ref={group} role="radiogroup" className={cn("relative grid grid-cols-1 gap-2", options.length === 2 ? "md:grid-cols-2" : "md:grid-cols-3")}>
      {options.map((option) => {
        const checked = value === option.value;
        const off = disabled || option.disabled;
        return (
          <label
            key={option.value}
            ref={(node) => {
              if (node) cards.current.set(option.value, node);
              else cards.current.delete(option.value);
            }}
            className={cn(
              "relative flex min-w-0 cursor-pointer flex-col gap-0.5 rounded-lg border border-slate-200 bg-white px-3 py-2.5 pr-10 transition-colors",
              !checked && "hover:border-emerald-400",
              off && "cursor-default opacity-70 hover:border-slate-200",
            )}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={checked}
              aria-disabled={off || undefined}
              tabIndex={off ? -1 : undefined}
              onChange={() => { if (!off) onChange(option.value); }}
              className="peer sr-only"
            />
            {option.icon ? (
              <>
                <span className={cn("mb-3 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors duration-200", checked ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500")}>{option.icon}</span>
                <span className="text-sm font-medium text-slate-900">{option.label}</span>
                <span className="text-xs leading-snug text-slate-500">{option.description}</span>
              </>
            ) : (
              <>
                <span className="text-sm font-medium text-slate-900">{option.label}</span>
                <span className="text-xs leading-snug text-slate-500">{option.description}</span>
              </>
            )}
            <svg viewBox="0 0 20 20" aria-hidden="true" className={cn("absolute right-3 top-3 block h-5 w-5 shrink-0 transition-colors duration-200", checked ? "text-emerald-600" : "text-slate-300")}>
              <circle cx="10" cy="10" r="9" fill="white" stroke="currentColor" strokeWidth="2" />
              {checked && <circle cx="10" cy="10" r="5" fill="currentColor" />}
            </svg>
          </label>
        );
      })}
      <div
        ref={frame}
        aria-hidden="true"
        data-testid="visibility-frame"
        className="pointer-events-none absolute left-0 top-0 z-10 rounded-lg border border-emerald-500 ring-1 ring-emerald-500/20"
        style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none", opacity: 0, visibility: "hidden" }}
      />
    </div>
  );
};
