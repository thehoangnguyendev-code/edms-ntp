// Adapted from turbostarter/loading-ui (MIT); see LICENSE.md and README.md.
import type * as React from "react";
import { cn } from "@/components/ui/utils";

function BouncingDots({
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
              animation:
                "loading-ui-bouncing-dots var(--duration, 1.4s) ease-in-out infinite",
              animationDelay: `calc(var(--delay, 0.2s) * ${index})`,
            }}
          />
        ))}
        <span className="sr-only">Loading</span>
      </span>
    </>
  );
}

export { BouncingDots };
