import React, { useLayoutEffect, useRef, useState } from "react";
import noResultImage from "@/assets/images/image-file/no_result.svg";
import { useLanguage } from "@/i18n";

export interface TableEmptyStateProps {
  /** Replaces the default "no result" illustration. */
  icon?: React.ReactNode;
  title?: string;
  description?: string;
}

/** Nearest ancestor that scrolls horizontally (the table's drag-scroll wrapper); null when the page itself scrolls. */
function findHorizontalScroller(el: HTMLElement): HTMLElement | null {
  for (let node = el.parentElement; node && node !== document.body; node = node.parentElement) {
    const overflowX = getComputedStyle(node).overflowX;
    if (overflowX === "auto" || overflowX === "scroll" || overflowX === "hidden") return node;
  }
  return null;
}

/**
 * Table Empty State Component
 * Hiển thị khi không có dữ liệu sau khi filter
 *
 * The empty state usually sits in a cell that spans every column. On a wide table that cell is
 * wider than the screen, so centred content would end up off-screen. The block is therefore pinned
 * to the left edge (sticky) and sized to the visible width of the scrolling wrapper, so it stays
 * centred in view however far the table is scrolled.
 *
 * @example
 * ```tsx
 * <TableEmptyState
 *   title="No Results Found"
 *   description="Try adjusting your filters"
 * />
 * ```
 */
export const TableEmptyState: React.FC<TableEmptyStateProps> = ({
  icon,
  title = "No Results Found",
  description = "We couldn't find any items matching your filters. Try adjusting your search criteria.",
}) => {
  const { tLabel } = useLanguage();
  const displayTitle = tLabel(title);
  const displayDescription = tLabel(description);
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const scroller = findHorizontalScroller(el);
    if (!scroller) return;
    const measure = () => setWidth(scroller.clientWidth);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(scroller);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={width ? { width } : undefined}
      className="animate-fade-in sticky left-0 flex w-full max-w-full flex-col items-center justify-center bg-white px-3 py-6 text-center sm:px-4 sm:py-10 md:py-12"
    >
      <div className="mb-2 flex w-full items-center justify-center sm:mb-3">
        {icon ?? (
          <img
            src={noResultImage}
            alt=""
            aria-hidden="true"
            draggable={false}
            className="h-auto w-36 max-w-full select-none sm:w-48 md:w-60 lg:w-64"
          />
        )}
      </div>
      <h3 className="mb-1 text-sm font-bold text-slate-900 sm:text-base md:text-lg">{displayTitle}</h3>
      <p className="mx-auto max-w-xs text-xs text-slate-500 sm:max-w-sm sm:text-sm md:text-base">{displayDescription}</p>
    </div>
  );
};
