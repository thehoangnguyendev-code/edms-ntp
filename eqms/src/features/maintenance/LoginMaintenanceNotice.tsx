import React, { useEffect, useState } from "react";
import { fetchMaintenanceStatus, formatCountdown, pollIntervalMs, remainingSeconds, type MaintenanceStatus } from "./maintenanceStatus";

/**
 * Shown on the sign-in page while a maintenance notice is running (SDS 11.5.4). It counts down on the server's clock, so a wrong
 * browser clock does not change it. Nothing is shown in any other state, and a failed read keeps the page as it was.
 */
export const LoginMaintenanceNotice: React.FC = () => {
  const [status, setStatus] = useState<MaintenanceStatus | null>(null);
  const [offsetMs, setOffsetMs] = useState(0);
  const [, setTick] = useState(0);

  useEffect(() => {
    let live = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = async () => {
      let nextDelay = 15000;
      try {
        const next = await fetchMaintenanceStatus();
        if (!live) return;
        const offset = Date.parse(next.serverNow) - Date.now();
        setOffsetMs(offset);
        setStatus(next);
        nextDelay = pollIntervalMs(next.state, remainingSeconds(next.endsAt, offset, Date.now()));
      } catch {
        // keep the last status shown; the next read tries again
      }
      if (live) timer = setTimeout(load, nextDelay);
    };
    void load();
    return () => {
      live = false;
      if (timer) clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (status?.state !== "NOTICE") return;
    const tick = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(tick);
  }, [status?.state]);

  if (!status || status.state !== "NOTICE") return null;
  const remaining = remainingSeconds(status.endsAt, offsetMs, Date.now());
  if (remaining === null || remaining <= 0) return null;

  return (
    <div role="status" className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <p className="font-semibold">System maintenance starts in {formatCountdown(remaining)}.</p>
      <p className="mt-1">Save your work and sign out before then. When the window starts, users are signed out and ordinary sign-in is closed until it is reopened.</p>
    </div>
  );
};
