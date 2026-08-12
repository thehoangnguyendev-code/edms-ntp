import React, { useEffect, useMemo } from "react";
import type { BreadcrumbItem } from "@/components/ui/breadcrumb/Breadcrumb";
import { cn } from "@/components/ui/utils";
import { ArrowLeft } from "lucide-react";
import { useBreadcrumb } from "@/contexts/BreadcrumbContext";
import { useBranding } from "@/components/branding/BrandLogo";
import { resolveConfiguredNavigationLabel } from "@/app/navigation";

interface PageHeaderProps {
  /** Main page title */
  title: string;
  /** Breadcrumb items. Use breadcrumbs.config.ts factory functions. */
  breadcrumbItems: BreadcrumbItem[];
  /** Action buttons rendered on the right side */
  actions?: React.ReactNode;
  /** Optional back button callback */
  onBack?: () => void;
  /** Additional className for the root container */
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  breadcrumbItems,
  actions,
  onBack,
  className,
}) => {
  const { setBreadcrumbs, clearBreadcrumbs } = useBreadcrumb();
  const { navigationLabelOverrides } = useBranding();
  const resolvedBreadcrumbItems = useMemo(
    () => breadcrumbItems.map((item) => ({
      ...item,
      label: resolveConfiguredNavigationLabel(item.label, navigationLabelOverrides),
    })),
    [breadcrumbItems, navigationLabelOverrides],
  );
  const resolvedTitle = resolveConfiguredNavigationLabel(title, navigationLabelOverrides);

  // Push breadcrumbs to header context; clear on unmount
  useEffect(() => {
    setBreadcrumbs(resolvedBreadcrumbItems);
    return () => clearBreadcrumbs();
  }, [resolvedBreadcrumbItems, setBreadcrumbs, clearBreadcrumbs]);

  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row flex-wrap items-start sm:items-end justify-between gap-4 md:gap-5",
        className
      )}
    >
      {/* Title + Breadcrumb */}
      <div className="w-full sm:w-auto sm:flex-1 min-w-0 overflow-hidden flex items-start gap-3">
        {onBack && (
          <button 
            type="button"
            onClick={onBack}
            className="mt-1 flex-shrink-0 h-8 w-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:text-emerald-600 hover:border-emerald-100 hover:bg-emerald-50 transition-all shadow-sm"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        )}
        <div className="min-w-0 overflow-hidden">
          <h1 className="text-[clamp(1.05rem,2.5vw,1.25rem)] md:text-xl lg:text-2xl font-bold tracking-tight text-slate-900 whitespace-normal sm:whitespace-nowrap leading-tight overflow-hidden text-ellipsis">
            {resolvedTitle}
          </h1>
        </div>
      </div>

      {/* Actions */}
      {actions && (
        <div className="flex items-center flex-wrap gap-2 w-full sm:w-auto justify-start sm:justify-end">
          {actions}
        </div>
      )}
    </div>
  );
};
