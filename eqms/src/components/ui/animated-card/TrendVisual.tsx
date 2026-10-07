import React, { useId } from "react";
import { cn } from "@/components/ui/utils";
import {
  DEFAULT_GRID,
  DEFAULT_MAIN,
  DEFAULT_SECONDARY,
  EASE,
  VisualBackdrop,
  VisualChipRow,
  VisualEmpty,
  VisualInfoPanel,
  type VisualChip,
  type VisualColors,
  type VisualInfo,
} from "./VisualParts";

export interface TrendPoint {
  label: string;
  value: number;
}

export interface TrendVisualProps extends VisualColors {
  /** Real series, oldest first, evenly spaced. Needs at least two points to draw a line. */
  points: TrendPoint[];
  chips?: VisualChip[];
  /** Caption shown on hover; defaults to the real peak of the series. */
  info?: VisualInfo;
  emptyLabel?: string;
}

const HEIGHT = 180;
const TOP = 52;
const BOTTOM = 30;

/**
 * badtz-ui animated-card-1: the series is first drawn as bars; on hover the bars slide
 * out to the left while a white wipe uncovers the same series as an area chart.
 */
export const TrendVisual: React.FC<TrendVisualProps> = ({
  points,
  chips,
  info,
  emptyLabel = "No data",
  mainColor = DEFAULT_MAIN,
  secondaryColor = DEFAULT_SECONDARY,
  gridColor = DEFAULT_GRID,
}) => {
  const fillId = useId();
  const hasLine = points.length >= 2 && points.some((point) => point.value > 0);
  if (!hasLine) {
    return (
      <div className="absolute inset-0 overflow-hidden">
        <VisualEmpty label={emptyLabel} />
        <VisualBackdrop color={mainColor} gridColor={gridColor} />
      </div>
    );
  }

  const max = Math.max(...points.map((point) => point.value));
  const peak = points.reduce((best, point) => (point.value > best.value ? point : best), points[0]);
  const span = HEIGHT - TOP - BOTTOM;
  const line = points.map((point, index) => `${index},${(HEIGHT - BOTTOM - (point.value / max) * span).toFixed(2)}`).join(" ");
  const last = points.length - 1;
  const caption = info ?? { title: `Peak ${peak.value.toLocaleString()}`, text: peak.label };

  return (
    <div role="img" aria-label={`Trend from ${points[0].label} to ${points[last].label}, peak ${peak.value} on ${peak.label}`} className="absolute inset-0 overflow-hidden">
      <div className="absolute inset-0">
        <svg className="h-full w-full" viewBox={`0 0 ${last} ${HEIGHT}`} preserveAspectRatio="none" fill="none">
          <defs>
            <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={mainColor} stopOpacity="0.38" />
              <stop offset="1" stopColor={mainColor} stopOpacity="0.02" />
            </linearGradient>
          </defs>
          <polygon points={`${line} ${last},${HEIGHT} 0,${HEIGHT}`} fill={`url(#${fillId})`} />
          <polyline points={line} stroke={mainColor} strokeWidth="1.5" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        </svg>
        <div
          className={cn(
            "absolute inset-0 z-[3] bg-gradient-to-r from-transparent from-0% to-white to-15% transition-transform duration-500 motion-reduce:transition-none group-hover/animated-card:translate-x-full",
            EASE,
          )}
        />
      </div>

      <div
        className={cn(
          "absolute left-0 top-0 z-[6] h-full w-[200%] transition-transform duration-500 motion-reduce:transition-none group-hover/animated-card:translate-x-[-50%]",
          EASE,
        )}
      >
        <div className="flex h-full w-1/2 items-end gap-[3px] px-4" style={{ paddingTop: TOP, paddingBottom: BOTTOM }}>
          {points.map((point, index) => (
            <div
              key={`${point.label}-${index}`}
              title={`${point.label}: ${point.value}`}
              className="min-w-[2px] flex-1 rounded-t-[3px]"
              style={{
                height: `${Math.max(2, (point.value / max) * 100)}%`,
                backgroundColor: point === peak ? secondaryColor : mainColor,
              }}
            />
          ))}
        </div>
      </div>

      <VisualInfoPanel info={caption} color={mainColor} from="top" />
      {chips && <VisualChipRow chips={chips} main={mainColor} secondary={secondaryColor} position="right" />}
      <div className="pointer-events-none absolute inset-x-4 bottom-2 z-[8] flex items-center justify-between text-[10px] tabular-nums text-slate-500">
        <span className="truncate">{points[0].label}</span>
        <span className="truncate">{points[last].label}</span>
      </div>
      <VisualBackdrop color={mainColor} gridColor={gridColor} />
    </div>
  );
};
