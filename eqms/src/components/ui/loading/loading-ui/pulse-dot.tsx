// Adapted from turbostarter/loading-ui (MIT); see LICENSE.md and README.md.
import type * as React from "react";
import { cn } from "@/components/ui/utils";
import { tr } from "@/i18n";

function PulseDot({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <>
      
      <span
        role="status"
        className={cn("inline-block rounded-full bg-current", className)}
        style={{
          animation:
            "loading-ui-pulse-dot var(--duration, 1.2s) ease-in-out infinite",
        }}
        {...props}
      >
        <span className="sr-only">{tr("Loading")}</span>
      </span>
    </>
  );
}

export { PulseDot };
