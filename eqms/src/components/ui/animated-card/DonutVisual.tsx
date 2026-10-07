import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/components/ui/utils";
import { useAnimatedCardHovered } from "./AnimatedCard";
import {
  DEFAULT_GRID,
  DEFAULT_MAIN,
  DEFAULT_SECONDARY,
  EASE,
  VisualBackdrop,
  VisualChipPill,
  VisualWash,
  type VisualColors,
  type VisualInfo,
} from "./VisualParts";

/** Orbit slots alternate left/right so a short list stays balanced. */
const ORBIT_SLOTS: ReadonlyArray<readonly [number, number]> = [
  [-125, 0], [125, 0], [-100, -50], [100, 50], [-100, 50], [100, -50],
];

const RADIUS = 40;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export interface DonutVisualProps extends VisualColors {
  /** 0-100 share drawn on the ring. */
  percent: number;
  /** Text in the ring centre; defaults to `${percent}%`. */
  centerLabel?: string;
  /** Up to six labels that fan out around the ring on hover. */
  orbit?: string[];
  /** Caption shown while the card is idle; it slides away on hover. */
  info?: VisualInfo;
}

/**
 * badtz-ui animated-card-2: the ring rests half-hidden under the caption; on hover it
 * rises and grows while labels fan out around it. The ring always shows the real share.
 */
export const DonutVisual: React.FC<DonutVisualProps> = ({
  mainColor = DEFAULT_MAIN,
  secondaryColor = DEFAULT_SECONDARY,
  gridColor = DEFAULT_GRID,
  percent,
  centerLabel,
  orbit = [],
  info,
}) => {
  const hovered = useAnimatedCardHovered();
  const reduceMotion = useReducedMotion();
  const clamped = Math.min(100, Math.max(0, Math.round(percent)));
  const offset = CIRCUMFERENCE - (clamped / 100) * CIRCUMFERENCE;

  return (
    <div
      role="img"
      aria-label={[centerLabel ?? `${clamped}%`, info?.title, info?.text, ...orbit].filter(Boolean).join(", ")}
      className="absolute inset-0 overflow-hidden"
    >
      <div
        className={cn(
          "absolute inset-x-0 top-0 z-[7] flex h-[360px] items-center justify-center transition-transform duration-500 motion-reduce:transition-none group-hover/animated-card:-translate-y-[90px] group-hover/animated-card:scale-110",
          EASE,
        )}
      >
        <div className="relative h-[120px] w-[120px]">
          <svg width="120" height="120" viewBox="0 0 100 100" className="-rotate-90">
            <circle cx="50" cy="50" r={RADIUS} stroke={mainColor} strokeOpacity={0.16} strokeWidth="10" fill="transparent" />
            {clamped > 0 && (
              <motion.circle
                cx="50"
                cy="50"
                r={RADIUS}
                stroke={mainColor}
                strokeWidth="12"
                strokeLinecap="round"
                fill="transparent"
                strokeDasharray={CIRCUMFERENCE}
                initial={reduceMotion ? false : { strokeDashoffset: CIRCUMFERENCE }}
                animate={{ strokeDashoffset: offset }}
                transition={{ duration: reduceMotion ? 0 : 0.9, ease: [0.6, 0.6, 0, 1], delay: 0.1 }}
              />
            )}
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xl font-bold tabular-nums text-slate-900">{centerLabel ?? `${clamped}%`}</span>
          </div>
        </div>
      </div>

      {info && (
        <div
          className={cn(
            "absolute inset-0 z-[6] flex items-start justify-center p-4 transition-transform duration-500 motion-reduce:transition-none group-hover/animated-card:translate-y-full",
            EASE,
          )}
        >
          <div className="max-w-full rounded-md border border-slate-200 bg-white/60 px-2 py-1.5 backdrop-blur-sm transition-opacity duration-500 group-hover/animated-card:opacity-0">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: mainColor }} />
              <p className="truncate text-xs font-semibold text-slate-900">{info.title}</p>
            </div>
            {info.text && <p className="mt-1 text-xs text-slate-500">{info.text}</p>}
          </div>
        </div>
      )}

      <VisualWash color={mainColor} />

      <div className="pointer-events-none absolute inset-0 z-[7] flex items-center justify-center">
        {orbit.slice(0, ORBIT_SLOTS.length).map((label, index) => {
          const [x, y] = ORBIT_SLOTS[index];
          return (
            <VisualChipPill
              key={label}
              label={label}
              color={index % 2 === 0 ? mainColor : secondaryColor}
              className={cn("absolute opacity-0 transition-all duration-500 motion-reduce:transition-none group-hover/animated-card:opacity-100", EASE)}
              style={{ transform: hovered ? `translate(${x}px, ${y}px)` : "translate(0px, 0px)" }}
            />
          );
        })}
      </div>

      <VisualBackdrop color={mainColor} gridColor={gridColor} />
    </div>
  );
};
