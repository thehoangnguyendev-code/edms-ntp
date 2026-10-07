import React from "react";
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
  VisualWash,
  type VisualChip,
  type VisualColors,
  type VisualInfo,
} from "./VisualParts";

export interface BarDatum {
  label: string;
  value: number;
  /** Drawn in the main colour; other bars are muted until the card is hovered. */
  accent?: boolean;
}

export interface BarsVisualProps extends VisualColors {
  /** Real values; bar height is value / max(value). */
  bars: BarDatum[];
  chips?: VisualChip[];
  /** Caption that slides up from the bottom edge on hover. */
  info?: VisualInfo;
  emptyLabel?: string;
}

const MAX_BARS = 12;
const LABEL_LIMIT = 6;

/**
 * badtz-ui animated-card-3: muted bars with accented ones; on hover the whole group grows,
 * the muted bars take the secondary colour, a wash rises and the caption slides in.
 */
export const BarsVisual: React.FC<BarsVisualProps> = ({
  bars,
  chips,
  info,
  emptyLabel = "No data",
  mainColor = DEFAULT_MAIN,
  secondaryColor = DEFAULT_SECONDARY,
  gridColor = DEFAULT_GRID,
}) => {
  const shown = bars.slice(0, MAX_BARS);
  const max = Math.max(0, ...shown.map((bar) => bar.value));
  if (shown.length === 0 || max === 0) {
    return (
      <div className="absolute inset-0 overflow-hidden">
        <VisualEmpty label={emptyLabel} />
        <VisualBackdrop color={mainColor} gridColor={gridColor} />
      </div>
    );
  }
  const showLabels = shown.length <= LABEL_LIMIT;

  return (
    <div
      role="img"
      aria-label={shown.map((bar) => `${bar.label}: ${bar.value}`).join(", ")}
      className="absolute inset-0 overflow-hidden"
    >
      <div
        className={cn(
          "absolute inset-x-4 bottom-3 top-12 z-[8] mx-auto flex max-w-[232px] origin-bottom items-end transition-transform duration-500 motion-reduce:transition-none group-hover/animated-card:scale-[1.3]",
          showLabels ? "gap-3" : "gap-1.5",
          EASE,
        )}
      >
        {shown.map((bar) => (
          <div key={bar.label} title={`${bar.label}: ${bar.value}`} className="flex h-full min-w-0 flex-1 flex-col justify-end">
            <div className="flex min-h-0 flex-1 flex-col justify-end">
              <span className="mb-0.5 text-center text-[11px] font-semibold tabular-nums text-slate-700">{bar.value.toLocaleString()}</span>
              <div
                className={cn(
                  "rounded-t-md transition-colors duration-500",
                  !bar.accent && "bg-[var(--muted)] group-hover/animated-card:bg-[var(--hover)]",
                )}
                style={
                  {
                    height: `${Math.max(4, (bar.value / max) * 100)}%`,
                    "--muted": "rgb(148 163 184 / 0.45)",
                    "--hover": secondaryColor,
                    ...(bar.accent ? { backgroundColor: mainColor } : {}),
                  } as React.CSSProperties
                }
              />
            </div>
            {showLabels && <span className="mt-1 truncate text-center text-[10px] text-slate-500">{bar.label}</span>}
          </div>
        ))}
      </div>

      <VisualWash color={mainColor} />
      {info && <VisualInfoPanel info={info} color={mainColor} from="bottom" />}
      {chips && <VisualChipRow chips={chips} main={mainColor} secondary={secondaryColor} position="left" />}
      <VisualBackdrop color={mainColor} gridColor={gridColor} />
    </div>
  );
};
