// Adapted from turbostarter/loading-ui (MIT); see LICENSE.md and README.md.
import type * as React from "react";
import { cn } from "@/components/ui/utils";

function DualArc({ className, style, ...props }: React.ComponentProps<"span">) {
  return (
    <>
      
      <span
        className={cn(
          "rounded-full border-[5px] border-transparent border-y-current",
          className,
        )}
        style={{
          animationName: "loading-ui-dual-arc-spin",
          animationDuration: "var(--duration, 1s)",
          animationTimingFunction: "linear",
          animationIterationCount: "infinite",
          ...style,
        }}
        {...props}
      />
    </>
  );
}

export { DualArc };
