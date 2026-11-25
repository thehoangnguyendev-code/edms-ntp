// Adapted from turbostarter/loading-ui (MIT); see LICENSE.md and README.md.
import type * as React from "react";
import { cn } from "@/components/ui/utils";

function QuarterRing({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <>
      
      <span
        role="status"
        className={cn(
          "inline-block rounded-full border-t-[3px] border-r-[3px] border-t-current border-r-transparent",
          className,
        )}
        style={{
          animation:
            "loading-ui-quarter-ring-rotation var(--duration, 1s) linear infinite",
        }}
        {...props}
      >
        <span className="sr-only">Loading</span>
      </span>
    </>
  );
}

export { QuarterRing };
