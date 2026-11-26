// Adapted from turbostarter/loading-ui (MIT); see LICENSE.md and README.md.
import type * as React from "react";
import { cn } from "@/components/ui/utils";
import { tr } from "@/i18n";

function Bars({
  className,
  bars = 3,
  ...props
}: React.ComponentProps<"span"> & { bars?: number }) {
  return (
    <>
      
      <span
        role="status"
        className={cn("inline-flex items-stretch gap-[5%]", className)}
        {...props}
      >
        {Array.from({ length: bars }, (_, index) => (
          <span
            key={index}
            aria-hidden="true"
            className="inline-block h-full rounded-[1px] bg-current"
            style={{
              width: `${100 / bars}%`,
              animation:
                "loading-ui-wave-bars var(--duration, 1.2s) ease-in-out infinite",
              animationDelay: `calc(var(--delay, 0.2s) * ${index})`,
            }}
          />
        ))}
        <span className="sr-only">{tr("Loading")}</span>
      </span>
    </>
  );
}

export { Bars };
