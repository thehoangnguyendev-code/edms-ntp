import { useEffect, useRef } from "react";

/** The print button of the page header: what it runs (the data of the tab that is open) and whether it can run now. */
export interface PrintAction { run: () => void; disabled: boolean }
export type RegisterPrint = (action: PrintAction | null) => void;

/**
 * A tab hands the page its own print routine. The page shows one button in its header and the button prints whatever the open tab shows (its department, filters and search);
 * the tab keeps those, so the routine is read from a ref at the moment of the click and the page is not told again each time a filter changes.
 */
export function usePrintAction(register: RegisterPrint | undefined, enabled: boolean, run: () => void | Promise<void>) {
  const latest = useRef(run);
  latest.current = run;
  useEffect(() => {
    if (!register) return;
    register({ run: () => void latest.current(), disabled: !enabled });
    return () => register(null);
  }, [register, enabled]);
}
