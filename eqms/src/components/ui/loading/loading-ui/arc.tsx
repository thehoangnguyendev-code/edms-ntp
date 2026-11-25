// Adapted from turbostarter/loading-ui (MIT); see LICENSE.md and README.md.
import type * as React from "react";
import { cn } from "@/components/ui/utils";

function Arc({ className, style, ...props }: React.ComponentProps<"span">) {
  return (
    <>
      
      <span
        className={cn(
          "rounded-full border-[5px] border-current/10 border-t-current",
          className,
        )}
        style={{
          animationName: "loading-ui-arc-spin",
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

export { Arc };
