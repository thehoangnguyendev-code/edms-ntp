import React from "react";
import { cn } from "../utils";
import { motion } from "framer-motion";

export interface ProgressProps {
  /** The progress value (0 to max) */
  value: number;
  /** Maximum value (default is 100) */
  max?: number;
  /** Custom class for the track container */
  className?: string;
  /** Custom class for the progress indicator bar */
  indicatorClassName?: string;
  /** Visual variant of the progress bar */
  variant?: "default" | "success" | "warning" | "error" | "info" | "blue" | "emerald" | "purple";
  /** Size of the progress bar */
  size?: "xs" | "sm" | "md" | "lg";
  /** Whether to animate the progress change */
  animated?: boolean;
  /**
   * No real incremental value to report (e.g. a single synchronous action with no partial
   * progress signal from the backend) -- shows a bar continuously sliding back and forth instead
   * of a value-based fill, so it never sits frozen at 0% while work is actually happening.
   * `value`/`max` are ignored while this is set.
   */
  indeterminate?: boolean;
}

const variantStyles = {
  default: "bg-emerald-500",
  success: "bg-emerald-500",
  emerald: "bg-emerald-500",
  warning: "bg-amber-500",
  error: "bg-red-500",
  info: "bg-blue-500",
  blue: "bg-blue-500",
  purple: "bg-purple-500",
};

const sizeStyles = {
  xs: "h-1",
  sm: "h-1.5",
  md: "h-2",
  lg: "h-3",
};

export const Progress: React.FC<ProgressProps> = ({
  value,
  max = 100,
  className,
  indicatorClassName,
  variant = "default",
  size = "md",
  animated = true,
  indeterminate = false,
}) => {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));

  return (
    <div
      className={cn(
        "w-full bg-slate-100 rounded-full overflow-hidden",
        sizeStyles[size],
        className
      )}
      role="progressbar"
      aria-valuemin={indeterminate ? undefined : 0}
      aria-valuemax={indeterminate ? undefined : max}
      aria-valuenow={indeterminate ? undefined : value}
    >
      {indeterminate ? (
        <motion.div
          className={cn("h-full w-1/3 rounded-full", variantStyles[variant], indicatorClassName)}
          animate={{ x: ["-100%", "300%"] }}
          transition={{ repeat: Infinity, duration: 1.2, ease: "easeInOut" }}
        />
      ) : animated ? (
        <motion.div
          className={cn(
            "h-full rounded-full relative overflow-hidden",
            variantStyles[variant],
            indicatorClassName
          )}
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        >
          {percentage < 100 && (
            <motion.div
              className="absolute inset-0 bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.35)_50%,transparent_100%)]"
              animate={{ x: ["-100%", "100%"] }}
              transition={{
                repeat: Infinity,
                duration: 1.6,
                ease: "linear",
              }}
            />
          )}
        </motion.div>
      ) : (
        <div
          className={cn(
            "h-full rounded-full transition-all",
            variantStyles[variant],
            indicatorClassName
          )}
          style={{ width: `${percentage}%` }}
        />
      )}
    </div>
  );
};
