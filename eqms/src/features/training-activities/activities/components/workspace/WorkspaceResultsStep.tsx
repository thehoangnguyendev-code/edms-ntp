import type { ReactNode } from "react";
import { Button } from "@/components/ui/button/Button";

/**
 * Step 5 of the session workspace: the result of each person. Sending to QA is done from the banner above or on Conduct Training.
 * A person who was absent is trained again in a make-up, and one who did not pass is retrained (SOP.0003 5.3.7): both are arranged from here, as a separate list under the same Training Number.
 */
export function WorkspaceResultsStep({ table, absent, failed, canArrange, onArrange }: {
  table: ReactNode;
  absent: number;
  failed: number;
  canArrange: boolean;
  onArrange: () => void;
}) {
  const waiting = absent + failed;
  return (
    <>
      {waiting > 0 && (
        <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="min-w-0">
            {[absent > 0 ? `${absent} absent` : "", failed > 0 ? `${failed} did not pass` : ""].filter(Boolean).join(" and ")}: they are trained again in a separate list under the same Training Number (SOP.0003 5.3.7).
          </p>
          {canArrange && <Button size="sm" variant="outline-emerald" className="whitespace-nowrap" onClick={onArrange}>Arrange supplementary training</Button>}
        </div>
      )}
      {table}
    </>
  );
}
