import React, { useRef } from "react";
import { IconLayoutGrid, IconChevronRight } from "@tabler/icons-react";
import { cn } from "@/components/ui/utils";
import { useFitLevel } from "@/components/ui/useFitLevel";

// --- Types ---
export interface BreadcrumbItem {
  /** Display label */
  label: string;
  /** If provided, the item becomes clickable (button) */
  onClick?: () => void;
  /** Mark as the active/current page (last item styling) */
  isActive?: boolean;
}

interface BreadcrumbProps {
  /** Array of breadcrumb items from root to current page.
   *  The first item is always rendered as the Dashboard icon.
   *  The last item (or item with isActive) gets bold styling.
   *  Middle items collapse to "..." when the room is short, and the last one is cut with an ellipsis when it is still too long.
   */
  items: BreadcrumbItem[];
  /** Additional className for the root container */
  className?: string;
}

/**
 * Reusable Breadcrumb component.
 *
 * Usage:
 * ```tsx
 * import { Breadcrumb } from "@/components/ui/breadcrumb/Breadcrumb";
 * import { getBreadcrumbs } from "@/components/ui/breadcrumb/breadcrumbs.config";
 *
 * <Breadcrumb items={getBreadcrumbs("equipmentManagement")} />
 * ```
 */
const Breadcrumb: React.FC<BreadcrumbProps> = ({ items, className }) => {
  const safeItems = items.filter(Boolean) as BreadcrumbItem[];
  const rootRef = useRef<HTMLDivElement>(null);
  // The room, not the screen, decides: 0 = every label, 1 = the middle ones as "...", 2 = also the last one cut short.
  const level = useFitLevel(rootRef, 3, safeItems.map((item) => item.label).join("|"));
  const collapseMiddle = level >= 1;
  const cutLast = level >= 2;
  return (
    <div ref={rootRef} className={cn("flex w-full min-w-0 items-center gap-1 text-slate-500 mt-1 text-sm whitespace-nowrap overflow-hidden", className)}>
      {safeItems.map((item, index) => {
        const isFirst = index === 0;
        const isLast = index === safeItems.length - 1;
        const isActive = item.isActive || isLast;
        const isMiddle = !isFirst && !isActive;

        return (
          <React.Fragment key={index}>
            {/* Render item */}
            {isFirst ? (
              // First item: always Dashboard icon
              item.onClick ? (
                <button
                  onClick={item.onClick}
                  className={cn(
                    "transition-colors",
                    isActive ? "text-slate-600" : "hover:text-emerald-600"
                  )}
                  aria-label="Dashboard"
                >
                  <IconLayoutGrid className="h-4 w-4 shrink-0" />
                </button>
              ) : (
                <IconLayoutGrid className={cn("h-4 w-4 shrink-0", isActive && "text-slate-600")} />
              )
            ) : isActive ? (
              // Active/last item: bold & slate color
              <span title={item.label} className={cn("text-slate-600 font-medium", cutLast ? "min-w-0 shrink truncate" : "shrink-0")}>{item.label}</span>
            ) : isMiddle && item.onClick ? (
              // Middle clickable item
              <>
                {collapseMiddle ? (
                  <button onClick={item.onClick} title={item.label} className="shrink-0 hover:text-emerald-600 transition-colors">...</button>
                ) : (
                  <button onClick={item.onClick} className="shrink-0 hover:text-emerald-600 transition-colors">
                    {item.label}
                  </button>
                )}
              </>
            ) : (
              // Middle non-clickable item
              <>
                <span title={item.label} className="shrink-0">{collapseMiddle ? "..." : item.label}</span>
              </>
            )}

            {/* Separator */}
            {!isLast && (
              <IconChevronRight className="h-4 w-4 text-slate-400 shrink-0 mx-0.5" />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

export default Breadcrumb;
export { Breadcrumb };
