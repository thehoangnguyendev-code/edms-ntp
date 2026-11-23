import type { ReactNode } from "react";
import { tr, trFormat } from "@/i18n";

/**
 * Step 5 of the session workspace: the result of each person. Sending to QA is done from the banner above or on Conduct Training.
 * A person who was absent is trained again in a make-up, and one who did not pass is retrained (SOP.0003 5.3.7): both are arranged once the activity is Completed (from its details), as a separate list under the same Training Number.
 */
export function WorkspaceResultsStep({ table, absent, failed }: {
  table: ReactNode;
  absent: number;
  failed: number;
}) {
  const waiting = absent + failed;
  return (
    <>
      {table}
      {waiting > 0 && (
        <div role="status" className="flex flex-col gap-3 rounded-lg border-l-4 border-amber-400 bg-amber-50 px-4 py-3 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between">
          <p className="min-w-0">
            {[absent > 0 ? trFormat("{count} absent", { count: absent }) : "", failed > 0 ? trFormat("{count} did not pass", { count: failed }) : ""].filter(Boolean).join(` ${tr("and")} `)}{tr(": after the training is Completed they are trained again in a separate list under the same Training Number (SOP.0003 5.3.7).")}
          </p>
        </div>
      )}
    </>
  );
}
