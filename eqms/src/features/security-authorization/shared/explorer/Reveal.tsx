import React, { useLayoutEffect, useRef, useState } from "react";
import { gsap, prefersReducedMotion } from "@/lib/gsap";

/**
 * Shows its children with a slide-and-fade (height and opacity, GSAP) when `show` becomes true, and slides them away when it becomes false; nothing is left in the page
 * (no padding, no border, no gap) while it is hidden. While it leaves, the last children it was given stay on screen, so the content does not change under the animation.
 * The first drawing and "reduce motion" do not animate.
 */
export const Reveal: React.FC<{ show: boolean; className?: string; children: React.ReactNode }> = ({ show, className, children }) => {
  const [rendered, setRendered] = useState(show);
  const el = useRef<HTMLDivElement>(null);
  const last = useRef<React.ReactNode>(children);
  const first = useRef(true);
  if (show) last.current = children;

  // A new reason to show: put it in the page first; the animation runs once it is there.
  useLayoutEffect(() => {
    if (show) setRendered(true);
  }, [show]);

  useLayoutEffect(() => {
    const node = el.current;
    if (first.current) {
      first.current = false;
      return undefined;
    }
    if (show) {
      if (!node) return undefined;
      gsap.killTweensOf(node);
      if (prefersReducedMotion()) {
        gsap.set(node, { height: "auto", opacity: 1, clearProps: "height,opacity" });
        return undefined;
      }
      // Slow and soft: the height opens over 0.7 s with an ease at both ends, and the content fades in a little behind it.
      gsap.fromTo(node, { height: 0, opacity: 0 }, { height: "auto", duration: 0.7, ease: "power2.inOut", clearProps: "height" });
      gsap.to(node, { opacity: 1, duration: 0.55, delay: 0.12, ease: "power1.out", clearProps: "opacity" });
      return () => { gsap.killTweensOf(node); };
    }
    if (!node) return undefined;
    gsap.killTweensOf(node);
    if (prefersReducedMotion()) {
      setRendered(false);
      return undefined;
    }
    // The content fades first, then the space closes after it.
    gsap.to(node, { opacity: 0, duration: 0.3, ease: "power1.in" });
    gsap.to(node, { height: 0, duration: 0.55, delay: 0.1, ease: "power2.inOut", onComplete: () => setRendered(false) });
    return () => { gsap.killTweensOf(node); };
  }, [show, rendered]);

  if (!show && !rendered) return null;
  return <div ref={el} className={className} style={{ overflow: "hidden" }}>{show ? children : last.current}</div>;
};
