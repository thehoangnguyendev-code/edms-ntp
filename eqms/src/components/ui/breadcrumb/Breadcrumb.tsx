import React from "react";
import { IconLayoutGrid, IconChevronRight } from "@tabler/icons-react";
import { cn } from "@/components/ui/utils";

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
   *  Middle items collapse to "..." on small screens.
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
  return (
    <div className={cn("flex items-center gap-1 text-slate-500 mt-1 text-sm whitespace-nowrap overflow-x-auto", className)}>
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
                  <IconLayoutGrid className="h-4 w-4" />
                </button>
              ) : (
                <IconLayoutGrid className={cn("h-4 w-4", isActive && "text-slate-600")} />
              )
            ) : isActive ? (
              // Active/last item: bold & slate color
              <span className="text-slate-600 font-medium">{item.label}</span>
            ) : isMiddle && item.onClick ? (
              // Middle clickable item
              <>
                <button
                  onClick={item.onClick}
                  className="hidden lg:inline hover:text-emerald-600 transition-colors"
                >
                  {item.label}
                </button>
                <span className="lg:hidden">...</span>
              </>
            ) : (
              // Middle non-clickable item
              <>
                <span className="hidden lg:inline">{item.label}</span>
                <span className="lg:hidden">...</span>
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
