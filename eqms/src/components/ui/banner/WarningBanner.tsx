import React from "react";
import { cn } from "@/components/ui/utils";

export type BannerVariant = "warning" | "error" | "info" | "success";

export interface WarningBannerProps {
  /** The variant of the banner determining the color scheme. Default: 'warning' */
  variant?: BannerVariant;
  /** Title text shown above the description */
  title?: string;
  /** Main message text or paragraph content */
  description?: React.ReactNode;
  /** Retained for backwards compatibility; banners intentionally do not render icons. */
  icon?: React.ReactNode;
  /** Additional wrapper className */
  className?: string;
  /** Optional content rendered below the title and description */
  children?: React.ReactNode;
}

/**
 * Compact inline callout shared across the application.
 */
export const WarningBanner: React.FC<WarningBannerProps> = ({
  variant = "warning",
  title,
  description,
  className,
  children,
}) => {
  const variantStyles = {
    warning: {
      wrapper: "border-amber-200 bg-amber-50 text-amber-800",
    },
    error: {
      wrapper: "border-red-200 bg-red-50 text-red-800",
    },
    info: {
      wrapper: "border-blue-200 bg-blue-50 text-blue-800",
    },
    success: {
      wrapper: "border-emerald-200 bg-emerald-50 text-emerald-800",
    },
  }[variant];

  return (
    <div
      className={cn(
        "rounded-lg border px-4 py-2.5 text-xs leading-relaxed",
        variantStyles.wrapper,
        className
      )}
    >
      {title && <span className="font-semibold">{title}</span>}
      {title && description && " "}
      {description}
      {children && <div className={cn(description ? "mt-2" : title ? "mt-1" : undefined)}>{children}</div>}
    </div>
  );
};
