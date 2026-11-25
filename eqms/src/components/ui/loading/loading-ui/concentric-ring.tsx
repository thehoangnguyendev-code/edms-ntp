// Adapted from turbostarter/loading-ui (MIT); see LICENSE.md and README.md.
import type * as React from "react";
import { cn } from "@/components/ui/utils";

function ConcentricRing({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <>
      
      <span
        role="status"
        className={cn("relative inline-block", className)}
        style={{
          animation:
            "loading-ui-concentric-ring-rotation var(--duration, 1s) linear infinite",
        }}
        {...props}
      >
        <span
          aria-hidden="true"
          className="absolute inset-0 rounded-full border-2 border-current"
          style={{ opacity: 0.25 }}
        />
        <span
          aria-hidden="true"
          className="absolute top-1/2 left-1/2 rounded-full border-2 border-transparent border-b-current"
          style={{
            width: "83.333%",
            height: "83.333%",
            transform: "translate(-50%, -50%)",
          }}
        />
        <span className="sr-only">Loading</span>
      </span>
    </>
  );
}

export { ConcentricRing };
