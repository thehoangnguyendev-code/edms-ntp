import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { gsap, prefersReducedMotion } from "@/lib/gsap";

/**
 * Shows the QR and the code when the check-in opens, and puts them away when it closes, with GSAP. The content marks the parts it wants to move:
 * `data-reveal="qr"` (the QR card: it is drawn from the top down, with a line of light that sweeps over it), `data-reveal="scan"` (that line) and `data-reveal="code"` (the countdown and the
 * code: they rise in one after the other). A check-in that is already open when the screen is drawn is shown at once; with "reduce motion" nothing moves.
 */
export function CheckInReveal({ open, shown, closed }: { open: boolean; shown: ReactNode; closed: ReactNode }) {
  // The content stays on screen while it leaves, so it is kept until the closing animation is over.
  const [mounted, setMounted] = useState(open);
  if (open && !mounted) setMounted(true);
  const wrap = useRef<HTMLDivElement>(null);
  const note = useRef<HTMLDivElement>(null);
  const visible = useRef(open);
  const running = useRef<gsap.core.Timeline | undefined>(undefined);

  useLayoutEffect(() => {
    if (open === visible.current) return undefined;
    visible.current = open;
    running.current?.kill();
    const el = wrap.current;
    if (prefersReducedMotion() || !el) {
      if (!open) setMounted(false);
      return undefined;
    }
    const parts = (name: string) => Array.from(el.querySelectorAll<HTMLElement>(`[data-reveal="${name}"]`));
    const qr = parts("qr");
    const scan = parts("scan");
    const code = parts("code");
    const frame = (inset: string) => `inset(${inset} round 12px)`;
    if (open) {
      const tl = gsap.timeline({ onComplete: () => { gsap.set([el, ...qr, ...scan, ...code], { clearProps: "all" }); } });
      gsap.set(el, { overflow: "hidden" });
      tl.fromTo(el, { height: 0, opacity: 0 }, { height: "auto", opacity: 1, duration: 0.5, ease: "power3.out" }, 0)
        .fromTo(qr, { clipPath: frame("0% 0% 100% 0%"), scale: 0.92, y: 14, filter: "blur(8px)" }, { clipPath: frame("0% 0% 0% 0%"), scale: 1, y: 0, filter: "blur(0px)", duration: 0.85, ease: "expo.out" }, 0.1)
        .fromTo(scan, { top: "0%", opacity: 1 }, { top: "100%", opacity: 0, duration: 0.85, ease: "power2.inOut" }, 0.1)
        .fromTo(code, { y: 12, opacity: 0 }, { y: 0, opacity: 1, duration: 0.45, stagger: 0.1, ease: "power2.out" }, 0.45);
      running.current = tl;
    } else {
      gsap.set(el, { overflow: "hidden" });
      const tl = gsap.timeline({ onComplete: () => setMounted(false) });
      tl.to(code, { y: -8, opacity: 0, duration: 0.22, stagger: 0.05, ease: "power2.in" }, 0)
        .to(qr, { clipPath: frame("100% 0% 0% 0%"), scale: 0.94, filter: "blur(6px)", duration: 0.45, ease: "power3.in" }, 0)
        .to(el, { height: 0, opacity: 0, duration: 0.4, ease: "power2.inOut" }, 0.3);
      running.current = tl;
    }
    return undefined;
  }, [open]);

  // The sentence that says what to do rises in once the code is gone.
  const firstRun = useRef(true);
  useLayoutEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    if (mounted || !note.current || prefersReducedMotion()) return;
    gsap.fromTo(note.current, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.35, ease: "power2.out", clearProps: "all" });
  }, [mounted]);

  useLayoutEffect(() => () => { running.current?.kill(); }, []);

  return mounted ? <div ref={wrap}>{shown}</div> : <div ref={note}>{closed}</div>;
}
