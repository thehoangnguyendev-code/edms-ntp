// Adapted from turbostarter/loading-ui (MIT); see LICENSE.md and README.md.
import type * as React from "react";
import { cn } from "@/components/ui/utils";

function Pulse({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <>
      
      <span
        role="status"
        className={cn("relative inline-block shrink-0", className)}
        {...props}
      >
        <span
          aria-hidden="true"
          className="absolute inset-0 rounded-full border-2 border-current"
          style={{
            animation:
              "loading-ui-thin-pulse var(--duration, 1.5s) ease-in-out infinite",
          }}
        />
        <span className="sr-only">Loading</span>
      </span>
    </>
  );
}

export { Pulse };
