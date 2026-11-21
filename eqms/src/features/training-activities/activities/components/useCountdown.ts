import { useEffect, useState } from "react";

const secondsTo = (deadline: number) => Math.max(0, Math.ceil((deadline - Date.now()) / 1000));

/**
 * The whole seconds left until `deadline` (a time in milliseconds; 0 means no countdown), read from the clock each time and never counted down: the next reading is planned
 * for the moment the seconds change, so the number goes 60, 59, 58 without a skipped second or a second that lasts twice as long, whatever the load of the page or a tab that was in
 * the background (it reads again when the tab is shown). It stops at 0.
 */
export function useCountdown(deadline: number): number | null {
  const [left, setLeft] = useState<number | null>(() => (deadline ? secondsTo(deadline) : null));

  useEffect(() => {
    if (!deadline) {
      setLeft(null);
      return undefined;
    }
    let timer: number | undefined;
    const tick = () => {
      window.clearTimeout(timer);
      const ms = deadline - Date.now();
      setLeft(Math.max(0, Math.ceil(ms / 1000)));
      if (ms <= 0) return;
      // a little after the instant the shown second ends, so the new second is already due when the page reads it
      timer = window.setTimeout(tick, (ms % 1000 || 1000) + 15);
    };
    const onVisible = () => { if (document.visibilityState === "visible") tick(); };
    tick();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [deadline]);

  return left;
}
