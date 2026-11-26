// Adapted from turbostarter/loading-ui (MIT); see LICENSE.md and README.md.
import type * as React from "react";
import { cn } from "@/components/ui/utils";
import { tr } from "@/i18n";

function ClockRing({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <>
      
      <span
        role="status"
        className={cn(
          "relative inline-block rounded-full border-2 border-current",
          className,
        )}
        style={{
          animation:
            "loading-ui-clock-ring-rotation var(--duration, 1.5s) linear infinite",
        }}
        {...props}
      >
        <span
          aria-hidden="true"
          className="absolute top-0 left-1/2 bg-current"
          style={{
            width: "6.25%",
            height: "50%",
            transform: "translateX(-50%)",
          }}
        />
        <span className="sr-only">{tr("Loading")}</span>
      </span>
    </>
  );
}

export { ClockRing };
