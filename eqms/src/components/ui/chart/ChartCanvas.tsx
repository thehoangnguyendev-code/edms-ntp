import React, { useEffect, useRef } from "react";
import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  DoughnutController,
  Filler,
  Legend,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
  type ChartConfiguration,
  type Plugin,
} from "chart.js";

// Only what the application draws is registered, so that the bundle holds just those parts of Chart.js.
Chart.register(ArcElement, BarController, BarElement, CategoryScale, DoughnutController, Filler, Legend, LineController, LineElement, LinearScale, PointElement, Tooltip);
Chart.defaults.font.family = 'Inter, "Segoe UI", system-ui, sans-serif';
Chart.defaults.color = "#475569";

export const hexWithAlpha = (hex: string, alpha: number) => {
  const value = hex.replace("#", "");
  const full = value.length === 3 ? value.split("").map((c) => c + c).join("") : value;
  const n = parseInt(full, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
};

/** Draws the value of each bar above it (the column charts of the dashboards). */
export const barValueLabels: Plugin<"bar"> = {
  id: "barValueLabels",
  afterDatasetsDraw(chart, _args, options: { color?: string; size?: number }) {
    const meta = chart.getDatasetMeta(0);
    const dataset = chart.data.datasets[0];
    if (!meta || !dataset) return;
    const { ctx } = chart;
    ctx.save();
    ctx.font = `${options.size ?? 12}px ${Chart.defaults.font.family}`;
    ctx.fillStyle = options.color ?? "#475569";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    meta.data.forEach((bar, index) => {
      const value = dataset.data[index];
      if (value === null || value === undefined) return;
      const { x, y } = bar.tooltipPosition(true);
      // A bar that is not drawn (hidden, or outside the scale) has no position: it gets no label.
      if (x === null || y === null) return;
      ctx.fillText(String(value), x, y - 4);
    });
    ctx.restore();
  },
};

/**
 * The mark under the pointer stays at full strength while the others soften. `colors` are the full colours of the marks, in order; `index` is the one under the pointer
 * (null when none). Redraws without animation, so the hover answers at once.
 */
export function emphasize(chart: Chart, index: number | null, colors: string[], alpha: number) {
  const dataset = chart.data.datasets[0];
  dataset.backgroundColor = colors.map((color, i) => (index === null || i === index ? color : hexWithAlpha(color, alpha)));
  chart.update("none");
}

export interface ChartCanvasProps {
  /** The Chart.js configuration. Keep its identity while the data is unchanged: a new one draws the chart again and plays its entrance again. */
  config: ChartConfiguration;
  /** Text for a screen reader: what the chart shows. */
  ariaLabel: string;
  className?: string;
  /** Called with the chart once it is drawn (to reach its hover state, for example). */
  onReady?: (chart: Chart) => void;
}

/**
 * One Chart.js chart on a canvas that fills its box (the box gives the size). Responsive: it follows the width and the height of its parent. The charts of the reports
 * are not drawn here: they are drawn on the server (REPORT-CHARTJS-2026-11-15); this is for the live charts of the dashboards and the settings screens.
 */
export const ChartCanvas: React.FC<ChartCanvasProps> = ({ config, ariaLabel, className, onReady }) => {
  const canvas = useRef<HTMLCanvasElement>(null);
  const ready = useRef(onReady);
  ready.current = onReady;

  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    let chart: Chart | undefined;
    try {
      chart = new Chart(element, { ...config, options: { responsive: true, maintainAspectRatio: false, ...config.options } });
    } catch {
      // A browser that cannot draw on a canvas shows the box and the text for a screen reader, not a broken page.
      return;
    }
    ready.current?.(chart);
    return () => chart?.destroy();
  }, [config]);

  return (
    <div className={className ?? "relative h-full w-full"}>
      <canvas ref={canvas} role="img" aria-label={ariaLabel} />
    </div>
  );
};
