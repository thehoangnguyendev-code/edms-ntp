import React, { createContext, useContext, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/components/ui/utils";
import { CountUp } from "./CountUp";
import { DEFAULT_GRID, EASE, VisualBackdrop, VisualWash } from "./VisualParts";

/**
 * Animated card family (visual language from badtz-ui animated-card-1/2/3).
 * Differences from upstream: fluid width, light theme only, hover state shared via
 * context, a `tone` that tints the border/glow, and visuals that only draw real data.
 */

const HoverContext = createContext(false);

/** True while the pointer is over the surrounding AnimatedCard. */
export const useAnimatedCardHovered = () => useContext(HoverContext);

export interface AnimatedCardTone {
  main: string;
  secondary: string;
}

export const ANIMATED_CARD_TONES = {
  emerald: { main: "#10b981", secondary: "#5eead4" },
  amber: { main: "#f59e0b", secondary: "#fb923c" },
  blue: { main: "#3b82f6", secondary: "#818cf8" },
  violet: { main: "#8b5cf6", secondary: "#f0abfc" },
  indigo: { main: "#6366f1", secondary: "#a5b4fc" },
  red: { main: "#ef4444", secondary: "#fda4af" },
  slate: { main: "#64748b", secondary: "#94a3b8" },
} satisfies Record<string, AnimatedCardTone>;

export type AnimatedCardToneName = keyof typeof ANIMATED_CARD_TONES;

export const mix = (color: string, percent: number, into = "transparent") =>
  `color-mix(in srgb, ${color} ${percent}%, ${into})`;

export interface AnimatedCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Tints the hover border and the soft glow at the top edge. */
  tone?: AnimatedCardToneName;
}

export const AnimatedCard: React.FC<AnimatedCardProps> = ({
  className,
  style,
  tone,
  onMouseEnter,
  onMouseLeave,
  onMouseMove,
  children,
  ...props
}) => {
  const [hovered, setHovered] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const main = tone ? ANIMATED_CARD_TONES[tone].main : undefined;
  return (
    <HoverContext.Provider value={hovered}>
      <div
        ref={ref}
        className={cn(
          "group/animated-card relative isolate w-full min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-[box-shadow,border-color,transform] duration-300 hover:shadow-md",
          main && "hover:border-[var(--tone-border)]",
          className,
        )}
        style={main ? ({ "--tone-border": mix(main, 40, "#e2e8f0"), ...style } as React.CSSProperties) : style}
        onMouseEnter={(event) => {
          setHovered(true);
          onMouseEnter?.(event);
        }}
        onMouseLeave={(event) => {
          setHovered(false);
          onMouseLeave?.(event);
        }}
        onMouseMove={(event) => {
          const el = ref.current;
          if (el && main) {
            const box = el.getBoundingClientRect();
            el.style.setProperty("--mx", `${event.clientX - box.left}px`);
            el.style.setProperty("--my", `${event.clientY - box.top}px`);
          }
          onMouseMove?.(event);
        }}
        {...props}
      >
        {main && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 opacity-0 transition-opacity duration-500 group-hover/animated-card:opacity-100 motion-reduce:transition-none"
            style={{ background: `radial-gradient(260px circle at var(--mx, 50%) var(--my, 0%), ${mix(main, 16)}, transparent 70%)` }}
          />
        )}
        {children}
      </div>
    </HoverContext.Provider>
  );
};

export const CardVisual: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, ...props }) => (
  <div className={cn("relative h-[180px] w-full overflow-hidden", className)} {...props} />
);

export const CardBody: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, ...props }) => (
  <div className={cn("flex flex-col space-y-1.5 border-t border-slate-200 p-4", className)} {...props} />
);

export const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({ className, ...props }) => (
  <h3 className={cn("text-base font-semibold leading-tight tracking-tight text-slate-900", className)} {...props} />
);

export const CardDescription: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({ className, ...props }) => (
  <p className={cn("text-sm text-slate-500", className)} {...props} />
);

/** Icon in a tone-coloured box that lifts slightly when the card is hovered. */
export const ToneIcon: React.FC<{ icon: React.ReactNode; tone: AnimatedCardToneName; compact?: boolean; solid?: boolean; className?: string }> = ({
  icon,
  tone,
  compact,
  solid,
  className,
}) => {
  const { main, secondary } = ANIMATED_CARD_TONES[tone];
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-lg border transition-transform duration-300 group-hover/animated-card:-translate-y-0.5 group-hover/animated-card:scale-105 motion-reduce:transition-none",
        compact ? "h-7 w-7" : "h-9 w-9",
        className,
      )}
      style={
        solid
          ? { color: "white", backgroundImage: `linear-gradient(135deg, ${main}, ${secondary})`, borderColor: "transparent", boxShadow: `0 8px 16px -8px ${main}` }
          : { color: main, backgroundColor: mix(main, 10, "white"), borderColor: mix(main, 22, "white") }
      }
    >
      <span className={cn("inline-flex", compact ? "h-3.5 w-3.5" : "h-4 w-4")}>{icon}</span>
    </span>
  );
};

export interface AnimatedPanelProps {
  title: string;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: AnimatedCardToneName;
  /** Content aligned to the right of the header (badges, selects, buttons). */
  actions?: React.ReactNode;
  /** Smaller header and padding for dense widgets. */
  compact?: boolean;
  className?: string;
  /** Replaces the default body padding. */
  bodyClassName?: string;
  children: React.ReactNode;
}

/**
 * Titled card for charts, lists and widgets. Its header is a small stage in the same
 * language as the animated cards: masked grid, tone glow, and a wash that rises on hover.
 */
export const AnimatedPanel: React.FC<AnimatedPanelProps> = ({
  title,
  subtitle,
  icon,
  tone = "emerald",
  actions,
  compact,
  className,
  bodyClassName,
  children,
}) => {
  const { main } = ANIMATED_CARD_TONES[tone];
  return (
    <AnimatedCard tone={tone} className={cn("flex flex-col", className)}>
      <header className={cn("relative isolate overflow-hidden border-b border-slate-100", compact ? "px-3 py-2.5 md:px-4" : "px-4 py-3 md:px-5 md:py-4")}>
        <VisualBackdrop color={main} gridColor={DEFAULT_GRID} />
        <VisualWash color={main} />
        <div className="relative z-[8] flex items-center gap-3">
          {icon && <ToneIcon icon={icon} tone={tone} compact={compact} className="group-hover/animated-card:-rotate-6" />}
          <div className="min-w-0 flex-1">
            <h3 className={cn("truncate font-bold text-slate-900", compact ? "text-sm" : "text-base")}>{title}</h3>
            {subtitle && <p className={cn("truncate text-slate-500", compact ? "text-2xs md:text-xs" : "text-sm")}>{subtitle}</p>}
          </div>
          {actions && <div className="shrink-0">{actions}</div>}
        </div>
      </header>
      <div className={cn("min-h-0 flex-1", bodyClassName ?? (compact ? "p-3 md:p-4" : "p-4 md:p-5"))}>{children}</div>
    </AnimatedCard>
  );
};

export interface AnimatedStatCardProps {
  icon: React.ReactNode;
  label: string;
  /** Numbers count up to their exact value; pass a string for pre-formatted values. */
  value: number | string;
  detail?: React.ReactNode;
  tone?: AnimatedCardToneName;
  /** 0-100 share drawn as a thin bar; pass only a real ratio. */
  progress?: number;
  className?: string;
}

/**
 * KPI card in the animated-card layout: a stage (grid, glow, big value, icon) above a
 * titled body. On hover the value lifts, the icon tilts and a tone wash rises.
 */
export const AnimatedStatCard: React.FC<AnimatedStatCardProps> = ({ icon, label, value, detail, tone = "emerald", progress, className }) => {
  const { main, secondary } = ANIMATED_CARD_TONES[tone];
  const reduceMotion = useReducedMotion();
  const pct = progress === undefined ? undefined : Math.min(100, Math.max(0, Math.round(progress)));
  return (
    <AnimatedCard tone={tone} className={cn("flex flex-col hover:-translate-y-0.5", className)}>
      <div className="relative h-[104px] shrink-0 overflow-hidden">
        <VisualBackdrop color={main} gridColor={DEFAULT_GRID} />
        <VisualWash color={main} />
        <div className="absolute inset-0 z-[8] flex items-end justify-between p-4">
          <p
            className={cn(
              "origin-bottom-left text-4xl font-bold leading-none tracking-tight text-slate-900 transition-transform duration-500 motion-reduce:transition-none group-hover/animated-card:-translate-y-1 group-hover/animated-card:scale-105",
              EASE,
            )}
          >
            {typeof value === "number" ? <CountUp value={value} /> : <span className="tabular-nums">{value}</span>}
          </p>
          <ToneIcon icon={icon} tone={tone} solid className={cn("self-start duration-500 group-hover/animated-card:-translate-y-1 group-hover/animated-card:rotate-6 group-hover/animated-card:scale-110", EASE)} />
        </div>
        {pct !== undefined && (
          <div className="absolute inset-x-0 bottom-0 z-[9] h-1 bg-slate-100/80" role="img" aria-label={`${label}: ${pct}%`}>
            <motion.div
              className="h-full"
              style={{ backgroundImage: `linear-gradient(to right, ${main}, ${secondary})` }}
              initial={reduceMotion ? false : { width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: reduceMotion ? 0 : 0.9, ease: [0.2, 0.8, 0.3, 1], delay: 0.15 }}
            />
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col space-y-1 border-t border-slate-200 px-4 py-3">
        <h3 className="text-sm font-semibold leading-tight text-slate-900">{label}</h3>
        {detail && <p className="text-xs text-slate-500">{detail}</p>}
      </div>
    </AnimatedCard>
  );
};
