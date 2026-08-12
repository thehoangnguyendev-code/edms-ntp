import React from "react";
import { cn } from "@/components/ui/utils";
import { AlertTriangle, AlertCircle, Info, CheckCircle2 } from "lucide-react";

export type BannerVariant = "warning" | "error" | "info" | "success";

export interface WarningBannerProps {
  /** The variant of the banner determining the color scheme. Default: 'warning' */
  variant?: BannerVariant;
  /** Title text shown above the description */
  title?: string;
  /** Main message text or paragraph content */
  description?: React.ReactNode;
  /** Custom icon to override the default variant icon */
  icon?: React.ReactNode;
  /** Additional wrapper className */
  className?: string;
  /** Optional content rendered below the title and description */
  children?: React.ReactNode;
}

/**
 * Reusable and responsive warning/alert banner component adhering to the Emerald design system.
 */
export const WarningBanner: React.FC<WarningBannerProps> = ({
  variant = "warning",
  title,
  description,
  icon,
  className,
  children,
}) => {
  // Define color tokens based on the variant
  const variantStyles = {
    warning: {
      wrapper: "bg-amber-50 border-amber-200 text-amber-900",
      iconWrapper: "text-amber-600",
      titleColor: "text-amber-900",
      descColor: "text-amber-800",
      defaultIcon: <AlertTriangle className="h-5 w-5 sm:h-6 sm:w-6" />,
    },
    error: {
      wrapper: "bg-red-50 border-red-200 text-red-900",
      iconWrapper: "text-red-600",
      titleColor: "text-red-900",
      descColor: "text-red-800",
      defaultIcon: <AlertCircle className="h-5 w-5 sm:h-6 sm:w-6" />,
    },
    info: {
      wrapper: "bg-blue-50 border-blue-200 text-blue-900",
      iconWrapper: "text-blue-600",
      titleColor: "text-blue-900",
      descColor: "text-blue-800",
      defaultIcon: <Info className="h-5 w-5 sm:h-6 sm:w-6" />,
    },
    success: {
      wrapper: "bg-emerald-50 border-emerald-200 text-emerald-900",
      iconWrapper: "text-emerald-600",
      titleColor: "text-emerald-900",
      descColor: "text-emerald-800",
      defaultIcon: <CheckCircle2 className="h-5 w-5 sm:h-6 sm:w-6" />,
    },
  }[variant];

  return (
    <div
      className={cn(
        "border rounded-xl p-3 sm:p-4 md:p-5 transition-all",
        variantStyles.wrapper,
        className
      )}
    >
      <div className="flex items-start gap-2.5 sm:gap-3.5">
        <div className="flex-1 min-w-0">
          {title && (
            <h3 className={cn("text-sm sm:text-base font-semibold leading-snug mb-1", variantStyles.titleColor)}>
              {title}
            </h3>
          )}
          {description && (
            <div className={cn("text-xs sm:text-sm font-normal leading-relaxed", variantStyles.descColor)}>
              {description}
            </div>
          )}
          {children && (
            <div className="mt-3">
              {children}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
