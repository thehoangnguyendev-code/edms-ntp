import React from "react";
import { Button } from "@/components/ui/button/Button";
import type { SectionState } from "./useSection";

/** What a section shows while it loads, when it fails, and when the person may not see it; the content is drawn only from data the server returned. */
export function SectionBody<T>({
  state,
  reload,
  children,
  deniedText = "You do not have access to this section.",
}: {
  state: SectionState<T>;
  reload: () => void;
  children: (data: T) => React.ReactNode;
  deniedText?: string;
}) {
  if (state.status === "loading") {
    return (
      <p role="status" className="px-4 py-6 text-sm text-slate-500">
        Loading…
      </p>
    );
  }
  if (state.status === "error") {
    return (
      <div role="alert" className="flex flex-wrap items-center justify-between gap-3 px-4 py-5 text-sm text-red-700">
        <span>This section could not be loaded. The figures are not shown rather than shown wrong.</span>
        <Button size="sm" variant="outline" onClick={reload}>
          Retry
        </Button>
      </div>
    );
  }
  if (state.status === "denied") {
    return <p className="px-4 py-6 text-sm text-slate-500">{deniedText}</p>;
  }
  return <>{children(state.data)}</>;
}
