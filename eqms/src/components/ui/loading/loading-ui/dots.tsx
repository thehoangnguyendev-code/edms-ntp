// Adapted from turbostarter/loading-ui (MIT); see LICENSE.md and README.md.
import type * as React from "react";
import { cn } from "@/components/ui/utils";
import { tr } from "@/i18n";

function Dots({
  className,
  dots = 3,
  ...props
}: React.ComponentProps<"span"> & { dots?: number }) {
  return (
    <>
      
      <span
        role="status"
        className={cn(
          "inline-flex items-center justify-center gap-[12%]",
          className,
        )}
        {...props}
      >
        {Array.from({ length: dots }, (_, index) => (
          <span
            key={index}
            data-slot="dot"
            aria-hidden="true"
            style={{
              animation:
                "loading-ui-dots-blink var(--duration, 1.4s) infinite both",
              animationDelay: `calc(var(--delay, 0.2s) * ${index})`,
            }}
            className="aspect-square grow rounded-full bg-current"
          />
        ))}
        <span className="sr-only">{tr("Loading")}</span>
      </span>
    </>
  );
}

export { Dots };
