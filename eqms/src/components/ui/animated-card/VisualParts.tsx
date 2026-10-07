import React from "react";
import { cn } from "@/components/ui/utils";

export interface VisualColors {
  mainColor?: string;
  secondaryColor?: string;
  gridColor?: string;
}

export interface VisualChip {
  label: string;
  tone?: "main" | "secondary";
}

export const DEFAULT_MAIN = "#10b981";
export const DEFAULT_SECONDARY = "#5eead4";
export const DEFAULT_GRID = "#80808015";

export const EASE = "ease-[cubic-bezier(0.6,0.6,0,1)]";

/** Radial glow + masked grid that fill the whole (fluid) visual. */
export const VisualBackdrop: React.FC<{ color: string; gridColor: string }> = ({ color, gridColor }) => (
  <>
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-[5]"
      style={{
        background: `radial-gradient(ellipse 60% 55% at 50% 54%, color-mix(in srgb, ${color} 25%, transparent), color-mix(in srgb, ${color} 15%, transparent) 34%, transparent 100%)`,
      }}
    />
    <div
      aria-hidden
      style={{ "--grid-color": gridColor } as React.CSSProperties}
      className="pointer-events-none absolute inset-0 z-[4] bg-[linear-gradient(to_right,var(--grid-color)_1px,transparent_1px),linear-gradient(to_bottom,var(--grid-color)_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,#000_60%,transparent_100%)] bg-[size:20px_20px] bg-center opacity-70"
    />
  </>
);

/** Shown instead of a chart when there is nothing real to draw. */
export const VisualEmpty: React.FC<{ label: string }> = ({ label }) => (
  <div className="absolute inset-0 z-[8] flex items-center justify-center text-xs text-slate-400">{label}</div>
);

/** Soft color wash that rises from the bottom on hover. */
export const VisualWash: React.FC<{ color: string }> = ({ color }) => (
  <div
    aria-hidden
    className={cn(
      "pointer-events-none absolute inset-0 z-[6] translate-y-full opacity-0 transition-all duration-500 motion-reduce:transition-none group-hover/animated-card:translate-y-0 group-hover/animated-card:opacity-100",
      EASE,
    )}
    style={{ background: `linear-gradient(to bottom, transparent 35%, color-mix(in srgb, ${color} 30%, transparent))` }}
  />
);

export const VisualChipPill: React.FC<{ color: string; label: string; className?: string; style?: React.CSSProperties }> = ({ color, label, className, style }) => (
  <div style={style} className={cn("flex max-w-full shrink-0 items-center rounded-full border border-slate-200 bg-white/60 px-1.5 py-0.5 backdrop-blur-sm", className)}>
    <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
    <span className="ml-1 truncate text-[10px] text-slate-900">{label}</span>
  </div>
);

/** Chip row that fades out when the card is hovered. */
export const VisualChipRow: React.FC<{
  chips: VisualChip[];
  main: string;
  secondary: string;
  position: "left" | "right";
}> = ({ chips, main, secondary, position }) => (
  <div className={cn("absolute top-4 z-[8] flex max-w-[calc(100%-2rem)] items-center gap-1", position === "left" ? "left-4" : "right-4")}>
    {chips.map((chip) => (
      <VisualChipPill
        key={chip.label}
        label={chip.label}
        color={chip.tone === "secondary" ? secondary : main}
        className="transition-opacity duration-300 ease-in-out group-hover/animated-card:opacity-0"
      />
    ))}
  </div>
);

export interface VisualInfo {
  title: string;
  text?: string;
}

/** Caption card that slides in from the top or bottom edge while the card is hovered. */
export const VisualInfoPanel: React.FC<{ info: VisualInfo; color: string; from: "top" | "bottom" }> = ({ info, color, from }) => (
  <div
    className={cn(
      "pointer-events-none absolute inset-0 z-[7] flex items-start justify-start p-4 transition-transform duration-500 motion-reduce:transition-none group-hover/animated-card:translate-y-0",
      from === "top" ? "-translate-y-full" : "translate-y-full",
      EASE,
    )}
  >
    <div className="max-w-full rounded-md border border-slate-200 bg-white/60 p-1.5 opacity-0 backdrop-blur-sm transition-opacity duration-500 group-hover/animated-card:opacity-100">
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
        <p className="truncate text-xs font-semibold text-slate-900">{info.title}</p>
      </div>
      {info.text && <p className="mt-1 text-xs text-slate-500">{info.text}</p>}
    </div>
  </div>
);
