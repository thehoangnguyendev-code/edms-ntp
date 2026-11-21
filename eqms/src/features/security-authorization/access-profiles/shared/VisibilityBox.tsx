import React, { useRef, useState } from "react";
import { ChevronDown, Eye } from "lucide-react";
import { cn } from "@/components/ui/utils";
import { gsap, prefersReducedMotion, useGSAP } from "@/lib/gsap";

/**
 * The frame of a record-visibility picker, shown at the top of the permissions of its module (Document Control, Training Management, Reports): a title, the
 * choice (the children), and a "Details" line that opens the long explanation in place and closes again. The details are closed by default so that the
 * permissions of the module stay on the screen.
 */
export const VisibilityBox: React.FC<{
  title: string;
  description: string;
  testId: string;
  /** The long explanation: shown only when the person opens "Details". */
  details?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}> = ({ title, description, testId, details, className, children }) => {
  const [open, setOpen] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const first = useRef(true);

  // The explanation slides open and closed (height and fade, GSAP). It stays in the page while closed (display none), so the text is not rebuilt each time. With "reduce
  // motion" it just appears and disappears. The first render does not animate.
  useGSAP(() => {
    const el = panel.current;
    if (!el) return;
    if (first.current) {
      first.current = false;
      gsap.set(el, { display: "none", height: 0, opacity: 0 });
      return;
    }
    gsap.killTweensOf(el);
    if (prefersReducedMotion()) {
      gsap.set(el, open ? { display: "block", height: "auto", opacity: 1 } : { display: "none", height: 0, opacity: 0 });
      return;
    }
    if (open) {
      gsap.set(el, { display: "block" });
      gsap.fromTo(el, { height: 0, opacity: 0 }, { height: "auto", opacity: 1, duration: 0.32, ease: "power2.out", clearProps: "height" });
    } else {
      gsap.to(el, { height: 0, opacity: 0, duration: 0.24, ease: "power2.in", onComplete: () => { gsap.set(el, { display: "none" }); } });
    }
  }, { scope: panel, dependencies: [open] });

  return (
    <section className={cn("rounded-xl border border-slate-300 bg-slate-100 p-3 sm:p-4", className)} data-testid={testId}>
      <div className="flex items-start gap-2">
        <Eye className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          <p className="text-xs text-slate-500">{description}</p>
        </div>
        {details && (
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
            className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-emerald-700 hover:text-emerald-800"
          >
            Details
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
          </button>
        )}
      </div>
      <div className="mt-2.5 space-y-2.5">{children}</div>
      {details && (
        <div ref={panel} data-details data-open={open} aria-hidden={!open} className="overflow-hidden" style={{ display: "none" }}>
          <div className="mt-3 border-t border-dashed border-slate-300 pt-2 text-xs leading-relaxed text-slate-600">{details}</div>
        </div>
      )}
    </section>
  );
};

/** The bullets inside "Details": a bold lead and the sentence. */
export const DetailList: React.FC<{ items: readonly { lead: string; text: string }[] }> = ({ items }) => (
  <ul className="list-disc space-y-1 pl-4">
    {items.map((item) => (
      <li key={item.lead}>
        <b>{item.lead}</b> {item.text}
      </li>
    ))}
  </ul>
);
