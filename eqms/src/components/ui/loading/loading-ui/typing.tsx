// Adapted from turbostarter/loading-ui (MIT); see LICENSE.md and README.md.
import type * as React from "react";
import { cn } from "@/components/ui/utils";
import { tr } from "@/i18n";

function Typing({
  className,
  dots = 3,
  ...props
}: React.ComponentProps<"span"> & { dots?: number }) {
  return (
    <>
      
      <span
        role="status"
        className={cn("inline-flex items-center gap-[12%]", className)}
        {...props}
      >
        {Array.from({ length: dots }, (_, index) => (
          <span
            key={index}
            aria-hidden="true"
            className="inline-block aspect-square grow rounded-full bg-current"
            style={{
              animation: "loading-ui-typing var(--duration, 1s) infinite",
              animationDelay: `calc(var(--delay, 160ms) * ${index})`,
            }}
          />
        ))}
        <span className="sr-only">{tr("Loading")}</span>
      </span>
    </>
  );
}

export { Typing };
