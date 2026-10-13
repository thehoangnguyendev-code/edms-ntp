import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Clock } from "lucide-react";
import { useMaintenance } from "./MaintenanceStatusProvider";
import { formatCountdown } from "./maintenanceStatus";

/**
 * The countdown in the header while a maintenance notice runs (SDS 11.5.4). It stays after the notice dialog is closed, is red and
 * blinks about once a second, and stops blinking for people who ask the system for reduced motion. It always has a clock icon and
 * the word "Maintenance", so colour is not the only signal.
 */
export const MaintenanceCountdownChip: React.FC = () => {
  const maintenance = useMaintenance();
  const reduceMotion = useReducedMotion();
  if (!maintenance || maintenance.status?.state !== "NOTICE" || maintenance.remaining === null) {
    return null;
  }
  const { remaining, openNotice, announcement } = maintenance;
  const label = `System maintenance in ${formatCountdown(remaining)}. Open the notice.`;

  return (
    <>
      <motion.button
        type="button"
        onClick={openNotice}
        aria-label={label}
        title={label}
        animate={reduceMotion ? undefined : { opacity: [1, 0.45, 1] }}
        transition={reduceMotion ? undefined : { duration: 1, repeat: Infinity, ease: "linear" }}
        className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2.5 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
      >
        <Clock className="h-3.5 w-3.5" aria-hidden="true" />
        <span>Maintenance</span>
        <span className="tabular-nums">{formatCountdown(remaining)}</span>
      </motion.button>
      {announcement && (
        <span className="sr-only" role="status" aria-live="polite">
          {announcement}
        </span>
      )}
    </>
  );
};
