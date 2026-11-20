import React, { useRef } from "react";
import { Star } from "lucide-react";
import { gsap, prefersReducedMotion, useGSAP } from "@/lib/gsap";

const RAYS = 8;
/** How far a ray flies from the middle of the star, in pixels. */
const RAY_REACH = 15;

interface FavouriteStarProps {
  starred: boolean;
  onToggle: () => void;
  ariaLabel: string;
  title: string;
  /** Classes of the button (its position, colour and visibility rules belong to the row it sits in). */
  className: string;
}

/**
 * The star that puts a menu entry among the favourites.
 *
 * Pressing it to ADD plays a short celebration (GSAP): the star hops up and lands with a little bounce while eight rays fly out of it and fade.
 * - It is driven by the press, not by the `starred` flag: favourites that arrive from storage when the sidebar loads, or that another tab changed, must not
 *   burst. Removing a favourite is quiet.
 * - With "reduce motion" nothing moves. The rays are decoration (`aria-hidden`, no pointer events) and the tweens leave no inline style behind.
 */
export const FavouriteStar: React.FC<FavouriteStarProps> = ({ starred, onToggle, ariaLabel, title, className }) => {
  const root = useRef<HTMLButtonElement>(null);
  const { contextSafe } = useGSAP({ scope: root });

  const celebrate = contextSafe(() => {
    const element = root.current;
    if (!element || prefersReducedMotion()) return;
    const icon = element.querySelector<HTMLElement>("[data-star-icon]");
    const rays = Array.from(element.querySelectorAll<HTMLElement>("[data-star-ray]"));
    if (!icon) return;
    gsap.killTweensOf([icon, ...rays]);

    const timeline = gsap.timeline({ onComplete: () => { gsap.set([icon, ...rays], { clearProps: "all" }); } });
    timeline
      .to(icon, { y: -6, scale: 1.3, rotation: -14, duration: 0.14, ease: "power2.out" })
      .to(icon, { y: 0, scale: 1, rotation: 0, duration: 0.5, ease: "elastic.out(1, 0.45)" });
    rays.forEach((ray, index) => {
      const angle = (index / RAYS) * Math.PI * 2 - Math.PI / 2;
      timeline.fromTo(
        ray,
        { x: Math.cos(angle) * 10, y: Math.sin(angle) * 10, rotation: (angle * 180) / Math.PI + 90, scale: 1, opacity: 1 },
        { x: Math.cos(angle) * RAY_REACH, y: Math.sin(angle) * RAY_REACH, scale: 0.3, opacity: 0, duration: 0.5, ease: "power2.out" },
        0.06,
      );
    });
  });

  return (
    <button
      ref={root}
      type="button"
      onClick={() => {
        if (!starred) celebrate();
        onToggle();
      }}
      aria-pressed={starred}
      aria-label={ariaLabel}
      title={title}
      className={className}
    >
      <span data-star-icon className="inline-flex">
        <Star className={starred ? "h-4 w-4 fill-amber-400" : "h-4 w-4"} />
      </span>
      <span aria-hidden="true" className="pointer-events-none absolute inset-0">
        {Array.from({ length: RAYS }, (_, index) => (
          <span key={index} data-star-ray className={`absolute left-1/2 top-1/2 -ml-px -mt-[3px] h-1.5 w-0.5 rounded-full opacity-0 ${index % 2 === 0 ? "bg-amber-400" : "bg-amber-500"}`} />
        ))}
      </span>
    </button>
  );
};
