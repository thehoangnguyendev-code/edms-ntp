// Adapted from turbostarter/loading-ui (MIT); see LICENSE.md and README.md.
import type * as React from "react";
import { cn } from "@/components/ui/utils";
import { tr } from "@/i18n";

const WAVE_BAR_HEIGHTS = ["50%", "75%", "100%", "75%", "50%"] as const;

function Wave({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <>
      
      <span
        role="status"
        className={cn("inline-flex items-center gap-[2.5%]", className)}
        {...props}
      >
        {WAVE_BAR_HEIGHTS.map((height, index) => (
          <span
            key={index}
            aria-hidden="true"
            className="inline-block rounded-full bg-current"
            style={{
              width: "12.5%",
              height,
              animation:
                "loading-ui-wave var(--duration, 1s) ease-in-out infinite",
              animationDelay: `calc(var(--delay, 100ms) * ${index})`,
            }}
          />
        ))}
        <span className="sr-only">{tr("Loading")}</span>
      </span>
    </>
  );
}

export { Wave };
