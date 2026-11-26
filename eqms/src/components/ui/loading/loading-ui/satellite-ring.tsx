// Adapted from turbostarter/loading-ui (MIT); see LICENSE.md and README.md.
import type * as React from "react";
import { cn } from "@/components/ui/utils";
import { tr } from "@/i18n";

function SatelliteRing({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <>
      
      <span
        role="status"
        className={cn(
          "relative inline-block rounded-full border-2 border-current/25",
          className,
        )}
        style={{
          animation:
            "loading-ui-satellite-ring-rotation var(--duration, 1.5s) linear infinite",
        }}
        {...props}
      >
        <span
          aria-hidden="true"
          className="absolute top-0 left-0 rounded-full bg-current"
          style={{
            width: "33.333%",
            height: "33.333%",
            transform: "translate(-50%, 50%)",
          }}
        />
        <span className="sr-only">{tr("Loading")}</span>
      </span>
    </>
  );
}

export { SatelliteRing };
